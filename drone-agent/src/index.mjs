/**
 * Field agent entry point.
 *
 * Connects the camera adapter, then hands control to the loop. Two modes:
 *
 *   --simulate        use SimulatedCameraAdapter (no vehicle, no MAVSDK needed).
 *                     This is the default so a fresh checkout can be exercised
 *                     without PX4 installed.
 *   --url udp://:14540  talk to PX4 SITL (or a real vehicle) through the Python bridge.
 *                     Requires `pip install mavsdk`.
 *
 * The API client is deliberately thin: three calls, all to the Supabase RPC/REST
 * surface that already exists (0002/0003). No new endpoints are invented here.
 *
 * Environment
 *   SUPABASE_URL              project URL
 *   SUPABASE_SERVICE_ROLE_KEY server-side key (never in a browser)
 *   AGENT_MISSION_ID          the mission this field station is serving
 *   AGENT_POLL_MS             poll interval, default 2000
 */
import { createClient } from "@supabase/supabase-js";

import { FieldAgent } from "./agent.mjs";
import { MavsdkCameraAdapter } from "./adapters/mavlink.mjs";
import { SimulatedCameraAdapter } from "./adapters/simulated.mjs";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const missionId = arg("--mission", process.env.AGENT_MISSION_ID);
const url = arg("--url", null);
const simulate = process.argv.includes("--simulate") || !url;

if (!missionId) {
  console.error("[agent] refusing to start: --mission or AGENT_MISSION_ID is required");
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[agent] refusing to start: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * The three calls the loop needs. Kept explicit rather than generic so the agent
 * cannot reach any other table by accident.
 */
const api = {
  /** Approved commands for this mission, oldest expiry first. */
  async listApproved(mission) {
    const { data, error } = await supabase
      .from("drone_commands")
      .select("id, mission_id, command_type, parameters, status, expires_at")
      .eq("mission_id", mission)
      .eq("status", "approved")
      .order("expires_at", { ascending: true })
      .limit(5);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      missionId: row.mission_id,
      commandType: row.command_type,
      parameters: row.parameters ?? {},
      status: row.status,
      expiresAt: row.expires_at,
    }));
  },

  /** Write the outcome and the audit entry in one round trip each. */
  async report({ commandId, status, code, message, mediaId, durationMs }) {
    const { error } = await supabase
      .from("drone_commands")
      .update({
        status: status === "completed" ? "completed" : status === "unsupported" ? "unsupported" : "failed",
        result: { code, message, mediaId, durationMs },
        updated_at: new Date().toISOString(),
      })
      .eq("id", commandId);
    if (error) throw new Error(error.message);

    const { error: auditError } = await supabase.from("drone_audit_logs").insert({
      mission_id: missionId,
      actor_id: null,
      event_type: `camera.command.${status}`,
      details: { commandId, code, message, mediaId, durationMs },
    });
    if (auditError) throw new Error(auditError.message);
  },

  /** Signals "agent is alive" so the operator can tell idle from offline. */
  async heartbeat({ missionId: mission, connected, cameraReady, batteryPercent, capabilities }) {
    const { error } = await supabase.from("drone_audit_logs").insert({
      mission_id: mission,
      actor_id: null,
      event_type: "agent.heartbeat",
      details: { connected, cameraReady, batteryPercent, capabilities },
    });
    if (error) throw new Error(error.message);
  },
};

const adapter = simulate
  ? new SimulatedCameraAdapter({ connected: true })
  : new MavsdkCameraAdapter({ url });

const modeLabel = simulate ? "simulate" : "mavsdk " + url;
console.log(`[agent] mission=${missionId} mode=${modeLabel}`);

const agent = new FieldAgent({
  adapter,
  api,
  missionId,
  pollIntervalMs: Number(process.env.AGENT_POLL_MS ?? 2000),
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    console.log(`[agent] ${signal}, disconnecting`);
    await agent.stop();
    process.exit(0);
  });
}

agent.start().catch((error) => {
  console.error("[agent] fatal:", error.message);
  process.exit(1);
});
