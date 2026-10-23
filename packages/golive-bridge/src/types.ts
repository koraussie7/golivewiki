export type TaskCategory = "translation" | "inspection" | "shopping" | "delivery" | "other";
export type TaskStatus = "open" | "accepted" | "in_progress" | "completed" | "cancelled";
export interface GoLiveTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  locationLabel?: string;
  budget?: number;
  currency: string;
  status: TaskStatus;
  createdAt: string;
}
export interface TaskEventInput {
  type: "worker_note" | "snapshot_requested" | "translation_result" | "issue_reported";
  message: string;
}
export interface VideoSession {
  sessionId: string;
  playbackUrl: string;
  expiresAt: string;
}
