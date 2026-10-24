/**
 * Tests for the command contract and the agent loop.
 *
 * The property under test throughout: nothing reaches the adapter unless the server
 * approved it, it is still valid, and the vehicle still reports the capability.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { validateCommand, CommandRejected, CAMERA_COMMANDS } from "../src/command-contract.mjs";
import { FieldAgent } from "../src/agent.mjs";
import { SimulatedCameraAdapter } from "../src/adapters/simulated.mjs";

const MISSION = "33f7b635-4bff-465d-bf41-1f4789bc3ea9";
const OTHER_MISSION = "5dd5b7b7-8295-4d46-a0e8-6e48163a8525";
const CMD_ID = "df78ff58-01e9-4992-9a24-2656ba44403f";

function approved(overrides = {}) {
  return {
    id: CMD_ID,
    missionId: MISSION,
    commandType: "camera.capture_photo",
    parameters: {},
    status: "approved",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

const ALL_CAPS = ["camera.capture_photo", "camera.start_video", "camera.stop_video", "camera.zoom"];

// --- contract ------------------------------------------------------------

test("accepts an approved photo command for this mission", () => {
  const cmd = validateCommand(approved(), { missionId: MISSION, capabilities: ALL_CAPS });
  assert.equal(cmd.commandType, "camera.capture_photo");
  assert.equal(cmd.missionId, MISSION);
});

test("rejects a command for another mission", () => {
  assert.throws(
    () => validateCommand(approved({ missionId: OTHER_MISSION }), { missionId: MISSION, capabilities: ALL_CAPS }),
    (e) => e instanceof CommandRejected && e.code === "WRONG_MISSION",
  );
});

test("rejects an expired command even when the server says approved", () => {
  const expired = approved({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  assert.throws(
    () => validateCommand(expired, { missionId: MISSION, capabilities: ALL_CAPS }),
    (e) => e.code === "EXPIRED",
  );
});

test("rejects zoom when the vehicle has no zoom", () => {
  const zoom = approved({ commandType: "camera.zoom", parameters: { level: 3 } });
  assert.throws(
    () => validateCommand(zoom, { missionId: MISSION, capabilities: ["camera.capture_photo"] }),
    (e) => e.code === "UNSUPPORTED",
  );
});

test("rejects an unapproved command", () => {
  assert.throws(
    () => validateCommand(approved({ status: "pending_approval" }), { missionId: MISSION, capabilities: ALL_CAPS }),
    (e) => e.code === "MALFORMED",
  );
});

test("rejects a zoom level outside 1..5", () => {
  for (const level of [0, 6, -1, 2.5]) {
    const zoom = approved({ commandType: "camera.zoom", parameters: { level } });
    assert.throws(
      () => validateCommand(zoom, { missionId: MISSION, capabilities: ALL_CAPS }),
      (e) => e.code === "BAD_PARAMETERS",
      `level ${level} should be rejected`,
    );
  }
});

test("rejects unexpected parameters", () => {
  const cmd = approved({ parameters: { level: 2 } });
  assert.throws(
    () => validateCommand(cmd, { missionId: MISSION, capabilities: ALL_CAPS }),
    (e) => e.code === "BAD_PARAMETERS",
  );
});

test("rejects a flight command: the contract has no such type", () => {
  for (const type of ["flight.goto", "flight.land", "flight.takeoff", "action.arm", "flight.velocity"]) {
    assert.throws(
      () => validateCommand(approved({ commandType: type }), { missionId: MISSION, capabilities: ALL_CAPS }),
      (e) => e.code === "MALFORMED",
      `${type} must not be representable`,
    );
  }
  // The exported list is the proof: it has four camera entries and nothing else.
  assert.deepEqual([...CAMERA_COMMANDS], ALL_CAPS);
});

// --- agent loop ----------------------------------------------------------

function makeApi(commands) {
  const reports = [];
  const heartbeats = [];
  return {
    reports,
    heartbeats,
    api: {
      listApproved: async () => commands,
      report: async (payload) => reports.push(payload),
      heartbeat: async (payload) => heartbeats.push(payload),
    },
  };
}

test("agent executes an approved command once", async () => {
  const adapter = new SimulatedCameraAdapter({ connected: true });
  const { api, reports } = makeApi([approved()]);
  const agent = new FieldAgent({ adapter, api, missionId: MISSION, log: () => {} });

  await agent.tick();

  assert.equal(adapter.executed.length, 1);
  assert.equal(adapter.executed[0].type, "camera.capture_photo");
  assert.equal(reports.length, 1);
  assert.equal(reports[0].status, "completed");
});

test("agent does not execute the same command twice across polls", async () => {
  const adapter = new SimulatedCameraAdapter({ connected: true });
  const { api } = makeApi([approved()]);
  const agent = new FieldAgent({ adapter, api, missionId: MISSION, log: () => {} });

  await agent.tick();
  await agent.tick();

  assert.equal(adapter.executed.length, 1, "the second poll must be a no-op");
});

test("agent reports a refusal instead of executing it", async () => {
  const adapter = new SimulatedCameraAdapter({ connected: true, capabilities: ["camera.capture_photo"] });
  const { api, reports } = makeApi([approved({ commandType: "camera.zoom", parameters: { level: 2 } })]);
  const agent = new FieldAgent({ adapter, api, missionId: MISSION, log: () => {} });

  await agent.tick();

  assert.equal(adapter.executed.length, 0, "nothing may reach the adapter");
  assert.equal(reports.length, 1);
  assert.equal(reports[0].status, "rejected");
  assert.equal(reports[0].code, "UNSUPPORTED");
});

test("agent reports an expiry refusal", async () => {
  const adapter = new SimulatedCameraAdapter({ connected: true });
  const { api, reports } = makeApi([approved({ expiresAt: new Date(Date.now() - 1).toISOString() })]);
  const agent = new FieldAgent({ adapter, api, missionId: MISSION, log: () => {} });

  await agent.tick();

  assert.equal(adapter.executed.length, 0);
  assert.equal(reports[0].code, "EXPIRED");
});

test("agent reports a hardware failure as failed, not completed", async () => {
  const adapter = new SimulatedCameraAdapter({ connected: true, failing: true });
  const { api, reports } = makeApi([approved()]);
  const agent = new FieldAgent({ adapter, api, missionId: MISSION, log: () => {} });

  await agent.tick();

  assert.equal(reports[0].status, "failed");
});

test("a failed report does not stop the loop", async () => {
  const adapter = new SimulatedCameraAdapter({ connected: true });
  const { api } = makeApi([approved()]);
  api.report = async () => {
    throw new Error("network down");
  };
  const agent = new FieldAgent({ adapter, api, missionId: MISSION, log: () => {} });

  await assert.doesNotReject(() => agent.tick());
  assert.equal(adapter.executed.length, 1);
});

test("a disconnected adapter executes nothing", async () => {
  const adapter = new SimulatedCameraAdapter({ connected: false });
  const { api, reports } = makeApi([approved()]);
  const agent = new FieldAgent({ adapter, api, missionId: MISSION, log: () => {} });

  await agent.tick();

  assert.equal(adapter.executed.length, 0);
  assert.equal(reports[0].status, "rejected");
});
