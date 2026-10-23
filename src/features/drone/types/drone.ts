export type ConnectionMode = "simulation" | "offline" | "connected";

export type DroneCapability =
  | "camera.capture_photo"
  | "camera.start_video"
  | "camera.stop_video"
  | "camera.zoom";

export type MissionStatus = "requested" | "accepted" | "active" | "completed";

export type CameraCommandType = DroneCapability;

export type CameraCommandStatus =
  | "pending_approval"
  | "approved"
  | "executing"
  | "completed"
  | "rejected"
  | "unsupported";

export interface DroneMission {
  id: string;
  title: string;
  location: string;
  requester: string;
  scheduledAt: string;
  status: MissionStatus;
}

export interface VehicleSummary {
  vendor: "MAVLink" | "DJI";
  model: string;
  capabilities: DroneCapability[];
  connection: ConnectionMode;
}

export interface MissionEvent {
  id: string;
  time: string;
  title: string;
  detail: string;
  kind: "system" | "operator" | "request";
}

export interface CameraCommand {
  id: string;
  label: string;
  type: CameraCommandType;
  status: CameraCommandStatus;
  requestedBy: string;
  expiresAt: string;
}
