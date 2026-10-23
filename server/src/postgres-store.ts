import pg from "pg";
import type { ConsentState, NewTask, Store, Task, TaskEvent, VideoSession } from "./store.js";

const { Pool } = pg;

/** Postgres-backed store. Schema lives in db/schema.sql and is applied once by the operator. */
export class PostgresStore implements Store {
  readonly kind = "postgres" as const;
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10 });
  }

  async init() {
    const { rows } = await this.pool.query("select 1 as ok");
    if (rows[0]?.ok !== 1) throw new Error("postgres_unreachable");
  }

  async close() {
    await this.pool.end();
  }

  async createTask(input: NewTask): Promise<Task> {
    const { rows } = await this.pool.query(
      `insert into smartglass_tasks (requester_id, title, description, category, budget, currency)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [input.requesterId, input.title, input.description, input.category, input.budget, input.currency],
    );
    return toTask(rows[0]);
  }

  async findTask(id: string) {
    const { rows } = await this.pool.query<Record<string, unknown>>("select * from smartglass_tasks where id = $1", [id]);
    return rows[0] ? toTask(rows[0]) : null;
  }

  async listTasks(filter: { status?: string; category?: string }) {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `select * from smartglass_tasks
        where ($1::text is null or status = $1)
          and ($2::text is null or category = $2)
        order by created_at desc`,
      [filter.status ?? null, filter.category ?? null],
    );
    return rows.map(toTask);
  }

  async updateTask(id: string, patch: Partial<Pick<Task, "status" | "workerId">>) {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.status !== undefined) { fields.push(`status = $${values.length + 1}`); values.push(patch.status); }
    if (patch.workerId !== undefined) { fields.push(`worker_id = $${values.length + 1}`); values.push(patch.workerId); }
    fields.push("updated_at = now()");
    values.push(id);
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `update smartglass_tasks set ${fields.join(", ")} where id = $${values.length} returning *`,
      values,
    );
    if (!rows[0]) throw new Error("task_not_found");
    return toTask(rows[0]);
  }

  async addEvent(taskId: string, actorId: string, type: string, detail: string): Promise<TaskEvent> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `insert into smartglass_task_events (task_id, actor_id, type, detail) values ($1,$2,$3,$4) returning *`,
      [taskId, actorId, type, detail],
    );
    return toEvent(rows[0]);
  }

  async listEvents(taskId: string) {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      "select * from smartglass_task_events where task_id = $1 order by created_at desc limit 200",
      [taskId],
    );
    return rows.map(toEvent);
  }

  async getConsent(taskId: string): Promise<ConsentState | null> {
    const { rows } = await this.pool.query<Record<string, unknown>>("select enabled, updated_at from smartglass_consents where task_id = $1", [taskId]);
    if (!rows[0]) return null;
    return { enabled: Boolean(rows[0].enabled), updatedAt: toIso(rows[0].updated_at) };
  }

  async setConsent(taskId: string, enabled: boolean) {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `insert into smartglass_consents (task_id, enabled, updated_at) values ($1,$2,now())
       on conflict (task_id) do update set enabled = excluded.enabled, updated_at = now()
       returning enabled, updated_at`,
      [taskId, enabled],
    );
    return { enabled: Boolean(rows[0].enabled), updatedAt: toIso(rows[0].updated_at) };
  }

  async findLiveSession(taskId: string, now: string): Promise<VideoSession | null> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `select session_id, task_id, playback_url, expires_at from smartglass_video_sessions
        where task_id = $1 and expires_at > $2::timestamptz order by expires_at desc limit 1`,
      [taskId, now],
    );
    return rows[0] ? toSession(rows[0]) : null;
  }

  async createSession(taskId: string, playbackUrl: string, expiresAt: string) {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `insert into smartglass_video_sessions (task_id, playback_url, expires_at)
       values ($1,$2,$3::timestamptz)
       returning session_id, task_id, playback_url, expires_at`,
      [taskId, playbackUrl, expiresAt],
    );
    return toSession(rows[0]);
  }

  async deleteSessionsForTask(taskId: string) {
    await this.pool.query("delete from smartglass_video_sessions where task_id = $1", [taskId]);
  }

  async purgeExpiredSessions(now: string) {
    await this.pool.query("delete from smartglass_video_sessions where expires_at <= $1::timestamptz", [now]);
  }
}

const toIso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

function toTask(r: Record<string, unknown>): Task {
  return {
    id: String(r.id),
    requesterId: String(r.requester_id),
    workerId: r.worker_id ? String(r.worker_id) : null,
    title: String(r.title),
    description: String(r.description ?? ""),
    category: String(r.category),
    budget: Number(r.budget),
    currency: String(r.currency ?? "KRW"),
    status: String(r.status) as Task["status"],
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function toEvent(r: Record<string, unknown>): TaskEvent {
  return {
    id: String(r.id),
    taskId: String(r.task_id),
    type: String(r.type),
    actorId: String(r.actor_id),
    detail: String(r.detail ?? ""),
    createdAt: toIso(r.created_at),
  };
}

function toSession(r: Record<string, unknown>): VideoSession {
  return {
    sessionId: String(r.session_id),
    taskId: String(r.task_id),
    playbackUrl: String(r.playback_url),
    expiresAt: toIso(r.expires_at),
  };
}
