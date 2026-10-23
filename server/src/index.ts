import cors from "cors";
import express from "express";
import { z } from "zod";
import { currentUserId, requireAuth, type AuthenticatedRequest } from "./auth.js";
import { PostgresStore } from "./postgres-store.js";
import { MemoryStore, type Store } from "./store.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

const store: Store = process.env.DATABASE_URL?.trim() ? new PostgresStore(process.env.DATABASE_URL.trim()) : new MemoryStore();

const VIDEO_SESSION_TTL_MS = 10 * 60 * 1000;
const streamBase = () => process.env.SMARTGLASS_STREAM_BASE?.trim() ?? "";

const CreateTaskInput = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().max(4000).default(""),
  category: z.enum(["inspection", "delivery", "cleaning", "repair", "other"]),
  budget: z.number().int().nonnegative(),
  currency: z.string().length(3).default("KRW"),
});

const TaskEventInput = z.object({
  type: z.enum(["worker_note", "snapshot_requested", "translation_result", "issue_reported"]),
  message: z.string().min(1).max(1000),
});

const ConsentInput = z.object({ enabled: z.boolean() });

const isShareable = (status: string) => status === "accepted" || status === "in_progress";
const now = () => new Date().toISOString();

/** Resolve a task the caller participates in, or answer 404 (never leak existence). */
async function loadTask(req: AuthenticatedRequest, res: express.Response) {
  const task = await store.findTask(req.params.id);
  const uid = currentUserId(req);
  if (!task || (task.requesterId !== uid && task.workerId !== uid)) {
    res.status(404).json({ error: "task_not_found" });
    return null;
  }
  return task;
}

/** Worker-only actions. Identity comes from the token, never the body. */
async function loadOwnedByWorker(req: AuthenticatedRequest, res: express.Response) {
  const task = await loadTask(req, res);
  if (!task) return null;
  if (task.workerId !== currentUserId(req)) {
    res.status(403).json({ error: "worker_only" });
    return null;
  }
  return task;
}

app.get("/health", async (_req, res) => {
  res.json({ ok: true, store: store.kind });
});

// --- Contract collection (Phase 2 alias: /api/* is deprecated, same handlers) ---
const listTasks: express.RequestHandler = async (req, res, next) => {
  try {
    const tasks = await store.listTasks({
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
    });
    res.json(tasks);
  } catch (error) { next(error); }
};

const createTask: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = CreateTaskInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_task", details: parsed.error.flatten() });
    const requesterId = currentUserId(req);
    const task = await store.createTask({ requesterId, ...parsed.data });
    await store.addEvent(task.id, requesterId, "task.created", task.title);
    return res.status(201).json(task);
  } catch (error) { return next(error); }
};

const getTask: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const task = await loadTask(req, res);
    if (task) res.json(task);
  } catch (error) { next(error); }
};

const acceptTask: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const task = await store.findTask(req.params.id);
    if (!task) return res.status(404).json({ error: "task_not_found" });
    if (task.status !== "open") return res.status(409).json({ error: "task_not_open" });
    const workerId = currentUserId(req);
    if (task.requesterId === workerId) return res.status(403).json({ error: "requester_cannot_accept" });
    const updated = await store.updateTask(task.id, { status: "accepted", workerId });
    await store.addEvent(task.id, workerId, "task.accepted", "worker accepted the task");
    return res.json(updated);
  } catch (error) { return next(error); }
};

const startTask: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const task = await loadOwnedByWorker(req, res);
    if (!task) return;
    if (task.status !== "accepted") return res.status(409).json({ error: "task_not_accepted" });
    const updated = await store.updateTask(task.id, { status: "in_progress" });
    await store.addEvent(task.id, currentUserId(req), "task.started", "worker started the task");
    return res.json(updated);
  } catch (error) { return next(error); }
};

const completeTask: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const task = await loadOwnedByWorker(req, res);
    if (!task) return;
    if (!isShareable(task.status)) return res.status(409).json({ error: "task_not_active" });
    const updated = await store.updateTask(task.id, { status: "completed" });
    await store.setConsent(task.id, false);
    await store.deleteSessionsForTask(task.id);
    await store.addEvent(task.id, currentUserId(req), "task.completed", "worker completed the task");
    return res.json({ ...updated, videoSessionsClosed: true });
  } catch (error) { return next(error); }
};

const addEvent: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const task = await loadOwnedByWorker(req, res);
    if (!task) return;
    if (!isShareable(task.status)) return res.status(409).json({ error: "task_not_active" });
    const parsed = TaskEventInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_event", details: parsed.error.flatten() });
    const event = await store.addEvent(task.id, currentUserId(req), `task.${parsed.data.type}`, parsed.data.message);
    return res.status(201).json(event);
  } catch (error) { return next(error); }
};

const listEvents: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const task = await loadTask(req, res);
    if (!task) return;
    res.json(await store.listEvents(task.id));
  } catch (error) { next(error); }
};

// --- Live sharing: explicit wearer consent gates a short-lived, task-scoped session ---
const setConsent: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const task = await loadOwnedByWorker(req, res);
    if (!task) return;
    if (!isShareable(task.status)) return res.status(409).json({ error: "task_not_active" });
    const parsed = ConsentInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_consent" });
    if (!parsed.data.enabled) await store.deleteSessionsForTask(task.id);
    const state = await store.setConsent(task.id, parsed.data.enabled);
    await store.addEvent(task.id, currentUserId(req), parsed.data.enabled ? "consent.granted" : "consent.revoked", "wearer updated live sharing consent");
    return res.json(state);
  } catch (error) { return next(error); }
};

const createVideoSession: express.RequestHandler = async (req: AuthenticatedRequest, res, next) => {
  try {
    const task = await loadOwnedByWorker(req, res);
    if (!task) return;
    if (!isShareable(task.status)) return res.status(409).json({ error: "task_not_active" });
    if ((await store.getConsent(task.id))?.enabled !== true) return res.status(403).json({ error: "consent_required" });
    const base = streamBase();
    if (!base) return res.status(503).json({ error: "stream_base_not_configured" });

    const stamp = now();
    await store.purgeExpiredSessions(stamp);
    const existing = await store.findLiveSession(task.id, stamp);
    if (existing) return res.status(201).json(existing);

    const expiresAt = new Date(Date.now() + VIDEO_SESSION_TTL_MS).toISOString();
    const url = `${base.replace(/\/+$/, "")}/t/${task.id.slice(0, 8)}/${globalThis.crypto.randomUUID()}?exp=${Date.parse(expiresAt)}`;
    const session = await store.createSession(task.id, url, expiresAt);
    await store.addEvent(task.id, currentUserId(req), "video.session.started", `expires ${expiresAt}`);
    return res.status(201).json(session);
  } catch (error) { return next(error); }
};

for (const prefix of ["/smartglass/tasks", "/api/tasks"]) {
  app.get(prefix, requireAuth, listTasks);
  app.post(prefix, requireAuth, createTask);
  app.get(`${prefix}/:id`, requireAuth, getTask);
  app.post(`${prefix}/:id/accept`, requireAuth, acceptTask);
  app.post(`${prefix}/:id/start`, requireAuth, startTask);
  app.post(`${prefix}/:id/complete`, requireAuth, completeTask);
  app.post(`${prefix}/:id/events`, requireAuth, addEvent);
  app.get(`${prefix}/:id/events`, requireAuth, listEvents);
  app.post(`${prefix}/:id/consent`, requireAuth, setConsent);
  app.post(`${prefix}/:id/video-session`, requireAuth, createVideoSession);
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[smartglass] unhandled", error);
  res.status(500).json({ error: "internal_error" });
});

const port = Number(process.env.PORT ?? 4100);

store.init()
  .then(() => {
    app.listen(port, () => console.log(`[smartglass] task API on :${port} (${store.kind})`));
  })
  .catch((error) => {
    console.error("[smartglass] failed to start", error);
    process.exit(1);
  });

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => { void store.close().finally(() => process.exit(0)); });
}
