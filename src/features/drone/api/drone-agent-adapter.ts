import type { CameraCommandType, DroneCapability } from "../types/drone";

export interface CameraOperationResult {
  success: boolean;
  code?: "unsupported" | "disconnected" | "rejected" | "failed";
  message?: string;
  mediaId?: string;
  completedAt: string;
}

export interface DroneCameraAdapter {
  readonly vendor: "mavlink" | "dji";
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getCapabilities(): Promise<DroneCapability[]>;
  getStatus(): Promise<{ connected: boolean; batteryPercent?: number; cameraReady: boolean }>;
  executeCameraCommand(type: CameraCommandType, parameters: Record<string, unknown>): Promise<CameraOperationResult>;
}

/**
 * Browser-side connector is deliberately not a hardware driver.
 * The native MAVSDK and DJI Mobile SDK adapters run on an authenticated field device,
 * consume only server-approved commands and publish results through the agent gateway.
 */
export class FieldAgentGateway {
  constructor(private readonly endpoint: string, private readonly getToken: () => string | null) { }

  async getStatus(signal?: AbortSignal): Promise<{ connected: boolean; vendor?: string; model?: string; capabilities?: DroneCapability[] }> {
    const token = this.getToken();
    if (!token) throw new Error("현장 에이전트 세션이 없습니다.");
    const response = await fetch(`${this.endpoint.replace(/\/+$/, "")}/v1/status`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error(`현장 에이전트 상태 조회 실패 (${response.status})`);
    return response.json() as Promise<{ connected: boolean; vendor?: string; model?: string; capabilities?: DroneCapability[] }>;
  }
}
