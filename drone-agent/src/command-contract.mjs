/**
 * Camera-only command contract.
 *
 * The field agent may take pictures and record video. It may not arm, take off, move,
 * change altitude or speed, or run a mission. That restriction is enforced here by the
 * type of command the agent can even represent: there is no "goto" or "land" variant,
 * so no code path can build one.
 *
 * Strictness on the wire matters because the command arrives from the server, and the
 * server's own checks (approval, mission active, capability, expiry) are the authority.
 * The agent re-checks them anyway: a compromised or buggy server must not be able to
 * turn a stale approval into a physical action.
 */
import { z } from "zod";

/** The four operations the MVP exposes. Anything else is rejected before dispatch. */
export const CAMERA_COMMANDS = [
  "camera.capture_photo",
  "camera.start_video",
  "camera.stop_video",
  "camera.zoom",
];

export const CameraCommandType = z.enum(CAMERA_COMMANDS);

/**
 * Parameter schemas per command.
 *
 * `zoom` carries a level because the camera needs one; 0002_drone_camera_command
 * enforces 1..5 server-side and this mirrors it so an out-of-range value is rejected
 * before the adapter is called.
 */
export const COMMAND_PARAMS = {
  "camera.capture_photo": z.object({}).strict(),
  "camera.start_video": z.object({}).strict(),
  "camera.stop_video": z.object({}).strict(),
  "camera.zoom": z.object({ level: z.number().int().min(1).max(5) }).strict(),
};

/**
 * A command as it arrives from the server.
 *
 * Fields beyond the operation itself are what make the re-check possible:
 *   status     must be 'approved' — 'pending_approval' means a human has not decided
 *   expiresAt  the approval window; past this instant the command is dead
 *   missionId  used to confirm the agent is working the mission it thinks it is
 */
export const InboundCommand = z.object({
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  commandType: CameraCommandType,
  parameters: z.record(z.string(), z.unknown()).default({}),
  status: z.literal("approved"),
  expiresAt: z.string().datetime(),
});

export class CommandRejected extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CommandRejected";
    this.code = code;
  }
}

/**
 * Validate a command immediately before execution.
 *
 * @param {unknown} raw            parsed JSON from the server
 * @param {object} ctx
 * @param {string} ctx.missionId   the mission this agent is currently attached to
 * @param {string[]} ctx.capabilities what the vehicle reported
 * @param {number} [ctx.now]
 * @returns {{ id: string, missionId: string, commandType: string, parameters: object }}
 */
export function validateCommand(raw, { missionId, capabilities, now = Date.now() }) {
  const parsed = InboundCommand.safeParse(raw);
  if (!parsed.success) {
    throw new CommandRejected("MALFORMED", `invalid command: ${parsed.error.issues[0]?.message}`);
  }
  const cmd = parsed.data;

  // A command for a different mission is not this agent's business. Without this the
  // server could hand an agent a command approved for another mission.
  if (cmd.missionId !== missionId) {
    throw new CommandRejected("WRONG_MISSION", "command belongs to another mission");
  }

  // Expiry is checked after schema validation so a clock-skewed ISO string cannot slip
  // through as "approved".
  if (new Date(cmd.expiresAt).getTime() <= now) {
    throw new CommandRejected("EXPIRED", `command expired at ${cmd.expiresAt}`);
  }

  // The vehicle may not support what the server approved. 0002 checks this too, but a
  // capability list that changed after approval is a real possibility (camera
  // disconnected, firmware downgraded).
  if (!capabilities.includes(cmd.commandType)) {
    throw new CommandRejected("UNSUPPORTED", `${cmd.commandType} is not in the vehicle capabilities`);
  }

  const params = COMMAND_PARAMS[cmd.commandType].safeParse(cmd.parameters);
  if (!params.success) {
    throw new CommandRejected("BAD_PARAMETERS", `invalid parameters: ${params.error.issues[0]?.message}`);
  }

  return {
    id: cmd.id,
    missionId: cmd.missionId,
    commandType: cmd.commandType,
    parameters: params.data,
  };
}
