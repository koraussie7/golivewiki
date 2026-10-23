export type TaskCategory = "translation" | "inspection" | "shopping" | "delivery" | "other";
export type TaskStatus = "open" | "accepted" | "in_progress" | "completed" | "cancelled";
export interface GoLiveTask {
  id: string;
  requesterId: string;
  workerId: string | null;
  title: string;
  description: string;
  category: TaskCategory;
  budget: number;
  currency: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  category: TaskCategory;
  budget: number;
  currency?: string;
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

export interface TaskEvent {
  id: string;
  taskId: string;
  type: string;
  actorId: string;
  detail: string;
  createdAt: string;
}
