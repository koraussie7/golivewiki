import type { GoLiveTask, TaskEventInput, VideoSession, TaskCategory } from "./types";

export interface GoLiveClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
}

export class GoLiveClient {
  constructor(private options: GoLiveClientOptions) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.options.getAccessToken();
    if (!token) throw new Error("GoLive 로그인 세션이 없습니다.");
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? body.error ?? `GoLive API 오류 (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  listOpenTasks(category?: TaskCategory) {
    const query = new URLSearchParams({ status: "open" });
    if (category) query.set("category", category);
    return this.request<GoLiveTask[]>(`/smartglass/tasks?${query}`);
  }

  acceptTask(taskId: string) {
    return this.request<GoLiveTask>(`/smartglass/tasks/${encodeURIComponent(taskId)}/accept`, { method: "POST", body: JSON.stringify({}) });
  }

  startTask(taskId: string) {
    return this.request<GoLiveTask>(`/smartglass/tasks/${encodeURIComponent(taskId)}/start`, { method: "POST", body: JSON.stringify({}) });
  }

  addEvent(taskId: string, event: TaskEventInput) {
    return this.request<{ id: string; createdAt: string }>(`/smartglass/tasks/${encodeURIComponent(taskId)}/events`, { method: "POST", body: JSON.stringify(event) });
  }

  completeTask(taskId: string) {
    return this.request<GoLiveTask>(`/smartglass/tasks/${encodeURIComponent(taskId)}/complete`, { method: "POST", body: JSON.stringify({}) });
  }

  setSharingConsent(taskId: string, enabled: boolean) {
    return this.request<{ enabled: boolean }>(`/smartglass/tasks/${encodeURIComponent(taskId)}/consent`, { method: "POST", body: JSON.stringify({ enabled }) });
  }

  createVideoSession(taskId: string) {
    return this.request<VideoSession>(`/smartglass/tasks/${encodeURIComponent(taskId)}/video-session`, { method: "POST", body: JSON.stringify({}) });
  }
}
