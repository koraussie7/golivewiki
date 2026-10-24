import { randomUUID } from "node:crypto";

export type TaskStatus = "open" | "accepted" | "in_progress" | "completed" | "cancelled";

export interface Task {
  id: string;
  requesterId: string;
  workerId: string | null;
  title: string;
  description: string;
  category: string;
  budget: number;
  currency: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEvent {
  id: string;
  taskId: string;
  type: string;
  actorId: string;
  detail: string;
  /** Echoed back so a client can match its own retried request. Null for server-generated events. */
  clientEventId: string | null;
  createdAt: string;
}

export interface ConsentState {
  enabled: boolean;
  updatedAt: string;
}

export interface VideoSession {
  sessionId: string;
  taskId: string;
  playbackUrl: string;
  expiresAt: string;
}

export interface NewTask {
  requesterId: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  currency: string;
}

export interface Store {
  readonly kind: "memory" | "postgres";
  init(): Promise<void>;
  close(): Promise<void>;
  createTask(input: NewTask): Promise<Task>;
  findTask(id: string): Promise<Task | null>;
  listTasks(filter: { status?: string; category?: string }): Promise<Task[]>;
  updateTask(id: string, patch: Partial<Pick<Task, "status" | "workerId" | "updatedAt">>): Promise<Task>;
  /**
   * Atomically move an `open` task to `accepted`. Returns null when another worker already
   * claimed it (or the task is no longer open), so the route can answer 409 instead of
   * overwriting an existing worker.
   */
  claimTask(id: string, workerId: string): Promise<Task | null>;
  /**
   * `clientEventId` makes a retried event idempotent: the same (task, clientEventId) pair
   * returns the already-stored event instead of inserting a duplicate.
   */
  addEvent(taskId: string, actorId: string, type: string, detail: string, clientEventId?: string | null): Promise<TaskEvent>;
  listEvents(taskId: string): Promise<TaskEvent[]>;
  getConsent(taskId: string): Promise<ConsentState | null>;
  setConsent(taskId: string, enabled: boolean): Promise<ConsentState>;
  findLiveSession(taskId: string, nowIso: string): Promise<VideoSession | null>;
  createSession(taskId: string, playbackUrl: string, expiresAt: string): Promise<VideoSession>;
  deleteSessionsForTask(taskId: string): Promise<void>;
  purgeExpiredSessions(nowIso: string): Promise<void>;
}

const nowIso = () => new Date().toISOString();

export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private tasks = new Map<string, Task>();
  private events: TaskEvent[] = [];
  private consents = new Map<string, ConsentState>();
  private sessions = new Map<string, VideoSession>();

  async init() {}
  async close() {}

  async createTask(input: NewTask): Promise<Task> {
    const ts = nowIso();
    const task: Task = { id: randomUUID(), workerId: null, status: "open", createdAt: ts, updatedAt: ts, ...input };
    this.tasks.set(task.id, task);
    return task;
  }

  async findTask(id: string) {
    return this.tasks.get(id) ?? null;
  }

  async listTasks(filter: { status?: string; category?: string }) {
    return [...this.tasks.values()].filter(
      (t) => (!filter.status || t.status === filter.status) && (!filter.category || t.category === filter.category),
    );
  }

  async updateTask(id: string, patch: Partial<Pick<Task, "status" | "workerId" | "updatedAt">>) {
    const task = this.tasks.get(id);
    if (!task) throw new Error("task_not_found");
    const next = { ...task, ...patch, updatedAt: patch.updatedAt ?? nowIso() };
    this.tasks.set(id, next);
    return next;
  }

  async claimTask(id: string, workerId: string) {
    const task = this.tasks.get(id);
    if (!task || task.status !== "open") return null;
    const next: Task = { ...task, status: "accepted", workerId, updatedAt: nowIso() };
    this.tasks.set(id, next);
    return next;
  }

  async addEvent(taskId: string, actorId: string, type: string, detail: string, clientEventId?: string | null) {
    if (clientEventId) {
      const existing = this.events.find((e) => e.taskId === taskId && e.clientEventId === clientEventId);
      if (existing) return existing;
    }
    const event: TaskEvent = { id: randomUUID(), taskId, actorId, type, detail, clientEventId: clientEventId ?? null, createdAt: nowIso() };
    this.events.unshift(event);
    return event;
  }

  async listEvents(taskId: string) {
    return this.events.filter((e) => e.taskId === taskId);
  }

  async getConsent(taskId: string) {
    return this.consents.get(taskId) ?? null;
  }

  async setConsent(taskId: string, enabled: boolean) {
    const state = { enabled, updatedAt: nowIso() };
    this.consents.set(taskId, state);
    return state;
  }

  async findLiveSession(taskId: string, now: string) {
    return [...this.sessions.values()].find((s) => s.taskId === taskId && new Date(s.expiresAt).getTime() > new Date(now).getTime()) ?? null;
  }

  async createSession(taskId: string, playbackUrl: string, expiresAt: string) {
    const session: VideoSession = { sessionId: randomUUID(), taskId, playbackUrl, expiresAt };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async deleteSessionsForTask(taskId: string) {
    for (const [key, session] of this.sessions) if (session.taskId === taskId) this.sessions.delete(key);
  }

  async purgeExpiredSessions(now: string) {
    for (const [key, session] of this.sessions) if (new Date(session.expiresAt).getTime() <= new Date(now).getTime()) this.sessions.delete(key);
  }
}
