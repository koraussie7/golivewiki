import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

type TaskStatus = "open" | "accepted" | "in_progress" | "completed" | "cancelled";
type TaskCategory = "translation" | "inspection" | "shopping" | "delivery" | "other";
type Task = {
  id: string; requesterId: string; workerId?: string; title: string; description: string;
  category: TaskCategory; locationLabel?: string; budget?: number; currency: string;
  status: TaskStatus; createdAt: string; acceptedAt?: string;
};
type Instruction = {
  id: string; taskId: string; senderId: string; text: string;
  kind: "message" | "snapshot_request" | "pause_stream" | "stop_task";
  status: "pending" | "acknowledged" | "rejected"; createdAt: string;
};
type TaskEvent = { id: string; taskId: string; type: string; actorId: string; detail: string; createdAt: string };

const tasks: Task[] = [];
const instructions: Instruction[] = [];
const events: TaskEvent[] = [];

const CreateTask = z.object({
  requesterId: z.string().min(1).max(100),
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(2000),
  category: z.enum(["translation","inspection","shopping","delivery","other"]),
  locationLabel: z.string().max(200).optional(),
  budget: z.number().min(0).max(100000).optional(),
  currency: z.string().length(3).default("USD")
});
const CreateInstruction = z.object({
  senderId: z.string().min(1).max(100),
  text: z.string().min(1).max(1000),
  kind: z.enum(["message","snapshot_request","pause_stream","stop_task"]).default("message")
});

function addEvent(taskId: string, actorId: string, type: string, detail: string) {
  events.unshift({ id: randomUUID(), taskId, actorId, type, detail, createdAt: new Date().toISOString() });
}
function findTask(id: string) { return tasks.find(t => t.id === id); }

// Demo health endpoint
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "golive-smartglass-task-api" }));

app.get("/api/tasks", (req, res) => {
  const status = req.query.status?.toString();
  res.json(tasks.filter(t => !status || t.status === status));
});

app.post("/api/tasks", (req, res) => {
  const parsed = CreateTask.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_task", details: parsed.error.flatten() });
  const task: Task = {
    id: randomUUID(), ...parsed.data, status: "open", createdAt: new Date().toISOString()
  };
  tasks.unshift(task);
  addEvent(task.id, task.requesterId, "task.created", task.title);
  return res.status(201).json(task);
});

app.get("/api/tasks/:id", (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: "task_not_found" });
  return res.json(task);
});

app.post("/api/tasks/:id/accept", (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: "task_not_found" });
  const workerId = z.string().min(1).max(100).safeParse(req.body?.workerId);
  if (!workerId.success) return res.status(400).json({ error: "workerId_required" });
  if (task.status !== "open") return res.status(409).json({ error: "task_not_open" });
  if (task.requesterId === workerId.data) return res.status(400).json({ error: "requester_cannot_accept_own_task" });
  task.workerId = workerId.data;
  task.status = "accepted";
  task.acceptedAt = new Date().toISOString();
  addEvent(task.id, workerId.data, "task.accepted", "Smart-glasses wearer accepted the task");
  return res.json(task);
});

app.post("/api/tasks/:id/start", (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: "task_not_found" });
  const actorId = z.string().min(1).safeParse(req.body?.actorId);
  if (!actorId.success || actorId.data !== task.workerId) return res.status(403).json({ error: "worker_only" });
  if (task.status !== "accepted") return res.status(409).json({ error: "task_not_accepted" });
  task.status = "in_progress";
  addEvent(task.id, actorId.data, "task.started", "Worker started the task");
  return res.json(task);
});

app.post("/api/tasks/:id/instructions", (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: "task_not_found" });
  if (!["accepted","in_progress"].includes(task.status)) return res.status(409).json({ error: "task_not_active" });
  const parsed = CreateInstruction.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_instruction", details: parsed.error.flatten() });
  const { senderId, text, kind } = parsed.data;
  // Demo-level checks only. Replace senderId trust with authenticated identity and task membership checks.
  if (![task.requesterId, task.workerId].includes(senderId)) return res.status(403).json({ error: "not_task_member" });
  const instruction: Instruction = {
    id: randomUUID(), taskId: task.id, senderId, text, kind,
    status: "pending", createdAt: new Date().toISOString()
  };
  instructions.unshift(instruction);
  addEvent(task.id, senderId, `instruction.${kind}`, text);
  return res.status(201).json(instruction);
});

app.get("/api/tasks/:id/instructions", (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: "task_not_found" });
  res.json(instructions.filter(i => i.taskId === task.id));
});

app.post("/api/instructions/:id/respond", (req, res) => {
  const instruction = instructions.find(i => i.id === req.params.id);
  if (!instruction) return res.status(404).json({ error: "instruction_not_found" });
  const task = findTask(instruction.taskId)!;
  const parsed = z.object({ workerId: z.string().min(1), decision: z.enum(["acknowledged","rejected"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_response" });
  if (parsed.data.workerId !== task.workerId) return res.status(403).json({ error: "worker_only" });
  instruction.status = parsed.data.decision;
  addEvent(task.id, parsed.data.workerId, `instruction.${instruction.status}`, instruction.text);
  return res.json(instruction);
});

app.get("/api/tasks/:id/events", (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: "task_not_found" });
  res.json(events.filter(e => e.taskId === task.id).slice(0, 200));
});

app.post("/api/tasks/:id/complete", (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: "task_not_found" });
  const actorId = z.string().min(1).safeParse(req.body?.actorId);
  if (!actorId.success || actorId.data !== task.workerId) return res.status(403).json({ error: "worker_only" });
  if (task.status !== "in_progress") return res.status(409).json({ error: "task_not_in_progress" });
  task.status = "completed";
  addEvent(task.id, actorId.data, "task.completed", "Worker marked task complete");
  return res.json(task);
});

const port = Number(process.env.PORT ?? 4100);
app.listen(port, () => console.log(`GoLive Smart Glass API listening on http://localhost:${port}`));
