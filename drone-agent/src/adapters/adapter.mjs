/**
 * Camera adapter interface.
 *
 * Both the MAVSDK adapter and the future DJI adapter implement this. The agent loop
 * only ever talks to this shape, so a vendor swap is a constructor change.
 *
 * Every method returns a result object rather than throwing for expected outcomes
 * (unsupported, disconnected). Throwing is reserved for programming errors: a camera
 * that is physically absent is not an exception, it is an answer the server needs.
 */

/**
 * @typedef {object} CameraResult
 * @property {boolean} success
 * @property {"ok"|"unsupported"|"disconnected"|"rejected"|"failed"} code
 * @property {string} [message]
 * @property {string} [mediaId]
 * @property {number} [durationMs]
 */

/**
 * @typedef {object} AdapterStatus
 * @property {boolean} connected
 * @property {number} [batteryPercent]
 * @property {boolean} cameraReady
 * @property {string} [model]
 */

/**
 * @typedef {object} CameraAdapter
 * @property {"mavlink"|"dji"|"simulated"} vendor
 * @property {() => Promise<void>} connect
 * @property {() => Promise<void>} disconnect
 * @property {() => Promise<string[]>} getCapabilities
 * @property {() => Promise<AdapterStatus>} getStatus
 * @property {(type: string, params: object) => Promise<CameraResult>} executeCameraCommand
 */

/** Base class that makes the contract explicit and fails loudly if a method is missing. */
export class BaseCameraAdapter {
  /** @type {"mavlink"|"dji"|"simulated"} */
  vendor = "simulated";

  async connect() {
    throw new Error("connect() not implemented");
  }

  async disconnect() {
    throw new Error("disconnect() not implemented");
  }

  /** @returns {Promise<string[]>} */
  async getCapabilities() {
    throw new Error("getCapabilities() not implemented");
  }

  /** @returns {Promise<AdapterStatus>} */
  async getStatus() {
    throw new Error("getStatus() not implemented");
  }

  /**
   * @param {string} _type
   * @param {object} _params
   * @returns {Promise<CameraResult>}
   */
  async executeCameraCommand(_type, _params) {
    throw new Error("executeCameraCommand() not implemented");
  }
}
