/**
 * Simulated camera adapter.
 *
 * Used for tests and for running the agent without hardware. It behaves like a camera
 * that supports exactly what it was constructed with, so a test can assert that an
 * unsupported command is refused before anything reaches the bridge.
 *
 * It records every executed command so a test can prove that a rejected command never
 * reached the adapter at all.
 */
import { BaseCameraAdapter } from "./adapter.mjs";

export class SimulatedCameraAdapter extends BaseCameraAdapter {
  vendor = "simulated";

  /**
   * @param {object} [options]
   * @param {string[]} [options.capabilities]
   * @param {boolean} [options.connected]
   * @param {number} [options.batteryPercent]
   * @param {boolean} [options.failing] make every command fail, for error-path tests
   */
  constructor({
    capabilities = [
      "camera.capture_photo",
      "camera.start_video",
      "camera.stop_video",
      "camera.zoom",
    ],
    connected = false,
    batteryPercent = 87,
    failing = false,
  } = {}) {
    super();
    this.capabilities = [...capabilities];
    this.connected = connected;
    this.batteryPercent = batteryPercent;
    this.failing = failing;
    /** @type {Array<{ type: string, params: object }>} */
    this.executed = [];
  }

  async connect() {
    this.connected = true;
  }

  async disconnect() {
    this.connected = false;
  }

  async getCapabilities() {
    return this.connected ? [...this.capabilities] : [];
  }

  async getStatus() {
    return {
      connected: this.connected,
      cameraReady: this.connected && this.capabilities.length > 0,
      batteryPercent: this.batteryPercent,
      model: "simulated-camera",
    };
  }

  async executeCameraCommand(type, params) {
    if (!this.connected) {
      return {
        success: false,
        code: "disconnected",
        message: "adapter not connected",
      };
    }
    if (!this.capabilities.includes(type)) {
      return {
        success: false,
        code: "unsupported",
        message: `${type} not supported`,
      };
    }

    this.executed.push({ type, params });

    if (this.failing) {
      return { success: false, code: "failed", message: "simulated failure" };
    }

    return {
      success: true,
      code: "ok",
      mediaId: type === "camera.capture_photo" ? "sim-photo-1" : undefined,
      durationMs: 5,
    };
  }
}
