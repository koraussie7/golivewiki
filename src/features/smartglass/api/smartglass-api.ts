/**
 * Smartglass API client.
 *
 * Talks to the tables created in `golive-smartglass/server/db/schema.sql`
 * (`smartglass_tasks`, `smartglass_task_events`, `smartglass_consents`,
 * `smartglass_video_sessions`) through the same REST pattern the rest of the site uses.
 *
 * What is deliberately NOT here: an `acceptTask` that claims a task on behalf of a
 * worker. The server already exposes `POST /smartglass/tasks/:id/accept`, and it now
 * uses a conditional UPDATE so two workers cannot both win. Calling that endpoint from
 * the requester screen would let a browser claim work in someone else's name, so the
 * requester UI only ever calls the endpoints a requester owns:
 *
 *   create task · read task · request a command · open a video session · list events
 */
import type {
  GlassCommand,
  GlassCommandType,
  SmartglassTask,
  TaskEvent,
} from "../types/smartglass";

interface RuntimeConfig {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  taskId?: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}

declare global {
  interface Window {
    // `window.supabase` is declared in the drone client; redeclaring it here with a
    // narrower shape conflicts with that definition (TS2717).
    GOLIVE_SMARTGLASS_CONFIG?: RuntimeConfig;
  }
}

export interface SmartglassConfig {
  apiBaseUrl: string;
  taskId: string;
  getAccessToken: () => Promise<string | null>;
}

export class SmartglassApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "SmartglassApiError";
  }
}

const trimSlash = (value: string) => value.replace(/\/+$/, "");

export function getSmartglassConfig(): SmartglassConfig {
  const env = import.meta.env;
  const runtime = typeof window === "undefined" ? undefined : window.GOLIVE_SMARTGLASS_CONFIG;

  const apiBaseUrl = trimSlash(
    runtime?.apiBaseUrl?.trim() || env.VITE_GOLIVE_API_BASE?.trim() || "",
  );

  return {
    apiBaseUrl,
    taskId:
      new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("taskId")?.trim() ||
      runtime?.taskId?.trim() ||
      "",
    // Falls back to a Supabase session, then to nothing. An empty token means the
    // server answers 401, which the screen renders as "로그인이 필요합니다" rather than
    // pretending the request succeeded.
    getAccessToken: async () => {
      if (runtime?.getAccessToken) return await runtime.getAccessToken();
      const supabase = typeof window === "undefined" ? undefined : window.supabase;
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) return data.session.access_token;
      }
      return null;
    },
  };
}

async function request<T>(config: SmartglassConfig, path: string, init: RequestInit = {}): Promise<T> {
  if (!config.apiBaseUrl) {
    throw new SmartglassApiError(
      "API 주소가 설정되지 않았습니다. (VITE_GOLIVE_API_BASE 또는 window.GOLIVE_SMARTGLASS_CONFIG)",
      0,
      "API_BASE_MISSING",
    );
  }

  const token = await config.getAccessToken();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${config.apiBaseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: string };
      code = body?.error;
    } catch {
      /* non-JSON error body */
    }
    throw new SmartglassApiError(`요청 실패 (${res.status})`, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Server row -> UI shape. Kept in one place so a schema rename is a single edit. */
function toTask(row: Record<string, unknown>): SmartglassTask {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    location: String(row.location ?? row.region ?? ""),
    requester: String(row.requester_id ?? "의뢰인"),
    scheduledAt: String(row.created_at ?? ""),
    status: (String(row.status ?? "requested") as SmartglassTask["status"]) ?? "requested",
  };
}

export async function getTask(config: SmartglassConfig, taskId = config.taskId): Promise<SmartglassTask> {
  if (!taskId) {
    throw new SmartglassApiError("작업 ID가 필요합니다.", 0, "TASK_ID_MISSING");
  }
  const row = await request<Record<string, unknown>>(config, `/smartglass/tasks/${taskId}`);
  return toTask(row);
}

export async function createTask(
  config: SmartglassConfig,
  input: { title: string; description: string; category: string; budget: number },
): Promise<SmartglassTask> {
  const row = await request<Record<string, unknown>>(config, "/smartglass/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return toTask(row);
}

export interface VideoSession {
  playbackUrl: string;
  streamPath: string;
  expiresAt?: string;
}

/**
 * Open a video session for a task.
 *
 * The worker must have consented first: the server answers 403 `consent_required`
 * otherwise, and that is the intended behaviour — video never starts without the
 * wearer agreeing. The error is passed through rather than hidden so the screen can
 * say exactly why nothing is playing.
 */
export async function openVideoSession(config: SmartglassConfig, taskId: string): Promise<VideoSession> {
  return request<VideoSession>(config, `/smartglass/tasks/${taskId}/video-session`, { method: "POST" });
}

export async function submitGlassCommand(
  config: SmartglassConfig,
  taskId: string,
  commandType: GlassCommandType,
  parameters: Record<string, unknown> = {},
): Promise<GlassCommand> {
  return request<GlassCommand>(config, `/smartglass/tasks/${taskId}/commands`, {
    method: "POST",
    body: JSON.stringify({ commandType, parameters }),
  });
}

export async function listEvents(config: SmartglassConfig, taskId: string): Promise<TaskEvent[]> {
  const rows = await request<Array<Record<string, unknown>>>(config, `/smartglass/tasks/${taskId}/events`);
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    time: String(row.created_at ?? ""),
    title: String(row.type ?? ""),
    detail: String(row.detail ?? ""),
    kind: "system" as const,
  }));
}
