/**
 * Smartglass types, mirroring the drone feature so both screens share one shape.
 *
 * The task lifecycle is the same four states the drone mission uses
 * (requested → accepted → active → completed), because both are "a requester asks a
 * field provider to do something and watches it happen". Sharing the vocabulary keeps
 * the UI logic identical and avoids a second state machine to maintain.
 */

export type ConnectionMode = "simulation" | "offline" | "connected";

/** What a wearer's device can do. Mirrors `smartglass_*` capabilities on the server. */
export type GlassCapability =
  | "glass.read_text"
  | "glass.translate"
  | "camera.capture_photo"
  | "camera.start_video";

export type TaskStatus = "requested" | "accepted" | "active" | "completed";

export type GlassCommandType = GlassCapability;

export type GlassCommandStatus =
  | "pending_approval"
  | "approved"
  | "executing"
  | "completed"
  | "rejected"
  | "unsupported";

export interface SmartglassTask {
  id: string;
  title: string;
  location: string;
  requester: string;
  scheduledAt: string;
  status: TaskStatus;
  /** Declared by the worker's device; a command is only offered when present. */
  capabilities?: GlassCapability[];
}

export interface WorkerSummary {
  device: "DadaBot" | "Generic";
  model: string;
  capabilities: GlassCapability[];
  connection: ConnectionMode;
}

export interface TaskEvent {
  id: string;
  time: string;
  title: string;
  detail: string;
  kind: "system" | "worker" | "request";
}

export interface GlassCommand {
  id: string;
  label: string;
  type: GlassCommandType;
  status: GlassCommandStatus;
  requestedBy: string;
  expiresAt: string;
}

/**
 * The four commands a requester can ask for, mapped to what the wearer experiences.
 * Reading and translation are text operations on the device; capture is the camera.
 * None of them move a person or start anything they have not consented to.
 */
export const GLASS_COMMANDS: { type: GlassCommandType; label: string; hint: string }[] = [
  { type: "glass.read_text", label: "글자 읽기", hint: "현장의 간판·문서를 읽어 옮겨 적습니다." },
  { type: "glass.translate", label: "번역", hint: "상대방 말이나 문장을 의뢰인 언어로 옮깁니다." },
  { type: "camera.capture_photo", label: "사진 촬영", hint: "현장 사진 한 장을 남깁니다." },
  { type: "camera.start_video", label: "영상 공유", hint: "작업자가 동의한 동안만 실시간 영상이 전송됩니다." },
];
