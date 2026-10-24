/**
 * MAVSDK camera adapter.
 *
 * Why this shells out to a Python bridge instead of calling MAVSDK directly
 *   MAVSDK is a C++ library (with C# and Python bindings); the Node ecosystem has no
 *   maintained MAVSDK port. The original plan assumed "MAVSDK Python", and that is
 *   what this adapter drives: a small Python process owns the MAVLink connection and
 *   this module talks to it over stdin/stdout with newline-delimited JSON.
 *
 *   The alternative — spawning `mavsdk_server` and speaking gRPC — adds a protobuf
 *   toolchain for four camera calls. NDJSON over a pipe is enough here and keeps the
 *   Node side dependency-free.
 *
 * What the bridge is allowed to do
 *   Only the camera plugin. The Python bridge imports mavsdk.Camera and nothing that
 *   can arm, take off, or set position. That is the same restriction as the command
 *   contract, enforced a second time on the other side of the process boundary —
 *   deliberately, because this is the code that touches the aircraft.
 *
 * SITL first
 *   `--url udp://:14540` is the PX4 SITL default. Nothing in this file distinguishes
 *   simulation from hardware; the difference is the URL and whether a camera plugin
 *   answers get_capabilities().
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { BaseCameraAdapter } from "./adapter.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(HERE, "mavsdk_bridge.py");

export class MavsdkCameraAdapter extends BaseCameraAdapter {
  vendor = "mavlink";

  constructor({
    url = "udp://:14540",
    requestTimeoutMs = 8000,
    pythonBin = "python3",
  } = {}) {
    super();
    this.url = url;
    this.requestTimeoutMs = requestTimeoutMs;
    this.pythonBin = pythonBin;
    this.child = null;
    this.pending = new Map();
    this.nextId = 1;
    this.buffer = "";
    this.connected = false;
  }

  async connect() {
    if (this.child) return;

    this.child = spawn(this.pythonBin, [BRIDGE, "--url", this.url], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.#onData(chunk));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (line) => {
      // The bridge logs diagnostics to stderr; keep them visible but out of the protocol.
      process.stderr.write(`[mavsdk] ${line}`);
    });
    this.child.on("exit", (code) => {
      this.connected = false;
      for (const [, resolve] of this.pending) {
        resolve({ ok: false, error: `bridge exited (${code})` });
      }
      this.pending.clear();
      this.child = null;
    });

    const ready = await this.#request("connect", {}, this.requestTimeoutMs * 2);
    if (!ready.ok)
      throw new Error(`MAVSDK bridge failed to connect: ${ready.error}`);
    this.connected = true;
  }

  async disconnect() {
    if (!this.child) return;
    try {
      await this.#request("disconnect", {}, 3000);
    } catch {
      /* the process may already be gone */
    }
    this.child?.kill();
    this.child = null;
    this.connected = false;
  }

  async getCapabilities() {
    if (!this.child) {
      // Reporting capabilities while disconnected would let the agent "support" a
      // command it cannot execute.
      return [];
    }
    const res = await this.#request("get_capabilities", {});
    return res.ok ? res.capabilities : [];
  }

  async getStatus() {
    if (!this.child) return { connected: false, cameraReady: false };
    const res = await this.#request("get_status", {});
    if (!res.ok) return { connected: false, cameraReady: false };
    return {
      connected: Boolean(res.connected),
      batteryPercent: res.battery_percent,
      cameraReady: Boolean(res.camera_ready),
      model: res.model,
    };
  }

  async executeCameraCommand(type, params) {
    if (!this.child) {
      return {
        success: false,
        code: "disconnected",
        message: "no MAVLink bridge",
      };
    }

    const res = await this.#request(
      "execute",
      { command: type, parameters: params },
      this.requestTimeoutMs,
    );
    if (!res.ok) {
      return { success: false, code: res.code ?? "failed", message: res.error };
    }
    return {
      success: Boolean(res.success),
      code: res.success ? "ok" : (res.code ?? "failed"),
      message: res.message,
      mediaId: res.media_id,
      durationMs: res.duration_ms,
    };
  }

  // --- NDJSON protocol ---------------------------------------------------
  #onData(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        process.stderr.write(
          `[mavsdk] unparseable line: ${line.slice(0, 120)}\n`,
        );
        continue;
      }
      const waiter = this.pending.get(msg.id);
      if (waiter) {
        this.pending.delete(msg.id);
        waiter(msg);
      }
    }
  }

  #request(op, payload, timeoutMs = this.requestTimeoutMs) {
    if (!this.child)
      return Promise.resolve({ ok: false, error: "bridge not started" });
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: `${op} timed out after ${timeoutMs}ms` });
      }, timeoutMs);

      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });

      this.child.stdin.write(JSON.stringify({ id, op, ...payload }) + "\n");
    });
  }
}
