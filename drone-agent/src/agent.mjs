/**
 * Field agent loop.
 *
 * Polls the server for approved camera commands, re-validates each one, executes it
 * through the adapter, and reports the result. It has no other job: it does not fly
 * the aircraft and it does not decide what to do next.
 *
 * Order matters and is deliberate:
 *   1. fetch only commands the server marked `approved`
 *   2. re-validate locally (mission, expiry, capability, parameters)
 *   3. confirm the adapter still reports the capability
 *   4. execute once
 *   5. report the outcome, including refusals
 *
 * Step 5 matters as much as step 4: a command the agent refuses must be reported as
 * refused, or the operator sees a pending approval that will never resolve.
 */
import { validateCommand, CommandRejected } from "./command-contract.mjs";

/** Commands the server has approved and this agent has not yet reported. */
const PENDING_QUERY = "status=eq.approved&order=expires_at.asc&limit=5";

export class FieldAgent {
  /**
   * @param {object} options
   * @param {import("./adapters/adapter.mjs").CameraAdapter} options.adapter
   * @param {{ listApproved: Function, report: Function, heartbeat: Function }} options.api
   * @param {string} options.missionId
   * @param {(msg: string) => void} [options.log]
   * @param {number} [options.pollIntervalMs]
   */
  constructor({
    adapter,
    api,
    missionId,
    log = console.log,
    pollIntervalMs = 2000,
  }) {
    this.adapter = adapter;
    this.api = api;
    this.missionId = missionId;
    this.log = log;
    this.pollIntervalMs = pollIntervalMs;
    this.running = false;
    this.executed = new Set();
  }

  async start() {
    await this.adapter.connect();
    this.running = true;

    const status = await this.adapter.getStatus();
    const capabilities = await this.adapter.getCapabilities();
    this.log(
      `[agent] connected=${status.connected} battery=${status.batteryPercent ?? "?"}% caps=${capabilities.join(",") || "none"}`,
    );

    // Announce the agent even with no commands pending: the server uses this to tell
    // "connected but idle" from "offline", and the operator needs that distinction
    // before approving anything.
    await this.api.heartbeat({
      missionId: this.missionId,
      connected: status.connected,
      cameraReady: status.cameraReady,
      batteryPercent: status.batteryPercent ?? null,
      capabilities,
    });

    while (this.running) {
      await this.tick();
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  async stop() {
    this.running = false;
    await this.adapter.disconnect();
  }

  /** One poll cycle. Exposed so tests can drive it without timers. */
  async tick() {
    let commands = [];
    try {
      commands = await this.api.listApproved(this.missionId);
    } catch (error) {
      this.log(`[agent] poll failed: ${error.message}`);
      return;
    }

    for (const raw of commands) {
      // The same command must never be executed twice, even if the server keeps
      // returning it because the previous report did not land.
      if (this.executed.has(raw.id)) continue;
      this.executed.add(raw.id);

      await this.handle(raw);
    }
  }

  async handle(raw) {
    const capabilities = await this.adapter.getCapabilities();

    let command;
    try {
      command = validateCommand(raw, {
        missionId: this.missionId,
        capabilities,
      });
    } catch (error) {
      if (error instanceof CommandRejected) {
        this.log(`[agent] refused ${raw.id}: ${error.code} — ${error.message}`);
        await this.reportSafely(
          commandResult(raw, "rejected", error.code, error.message),
        );
        return;
      }
      throw error;
    }

    // Ask the adapter again. Capabilities can change between the poll and this call
    // (camera unplugged, firmware reset); the server's approval is not evidence that
    // the hardware is still ready.
    const nowCapabilities = await this.adapter.getCapabilities();
    if (!nowCapabilities.includes(command.commandType)) {
      this.log(
        `[agent] refused ${command.id}: camera no longer offers ${command.commandType}`,
      );
      await this.reportSafely(
        commandResult(
          command,
          "unsupported",
          "UNSUPPORTED",
          "capability disappeared",
        ),
      );
      return;
    }

    this.log(`[agent] executing ${command.commandType} for ${command.id}`);
    const result = await this.adapter.executeCameraCommand(
      command.commandType,
      command.parameters,
    );

    await this.reportSafely({
      commandId: command.id,
      status: result.success
        ? "completed"
        : result.code === "unsupported"
          ? "unsupported"
          : "failed",
      code: result.code,
      message: result.message,
      mediaId: result.mediaId,
      durationMs: result.durationMs,
    });
  }

  async reportSafely(payload) {
    try {
      await this.api.report(payload);
    } catch (error) {
      // A failed report must not stop the loop, but it must be visible: the operator
      // will otherwise see a command stuck in "approved".
      this.log(
        `[agent] report failed for ${payload.commandId}: ${error.message}`,
      );
    }
  }
}

function commandResult(raw, status, code, message) {
  return {
    commandId: raw.id,
    status,
    code,
    message,
    mediaId: null,
    durationMs: null,
  };
}

export { PENDING_QUERY };
