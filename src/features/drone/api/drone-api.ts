import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CameraCommandType, DroneMission, MissionEvent } from "../types/drone";

interface RuntimeSupabaseConfig {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  backendAccessToken?: string;
  mediamtxWebRtcBaseUrl?: string;
  missionId?: string;
  streamPath?: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}

declare global {
  interface Window {
    GOLIVE_DRONE_CONFIG?: RuntimeSupabaseConfig;
    supabase?: SupabaseClient;
  }
}

export interface DroneRuntimeConfig {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  backendAccessToken: string;
  mediamtxWebRtcBaseUrl: string;
  missionId: string;
  streamPath: string;
  getAccessToken: () => Promise<string | null>;
}

export interface DroneLiveState {
  connected: boolean;
  lastEventAt: string | null;
  message: string;
}

export interface DroneLiveEvent {
  event: string;
  payload: unknown;
  receivedAt: string;
}

export interface DroneCommandResponse {
  id: string;
  status: string;
  commandType: CameraCommandType;
  createdAt?: string;
  expiresAt?: string;
}

export class DroneApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "DroneApiError";
  }
}

const trimSlash = (value: string) => value.replace(/\/+$/, "");

/**
 * No baked-in project credentials. A hardcoded anon key silently points the drone screen at
 * whichever project was current when it was pasted; a missing config must fail loudly instead.
 */
function requireSupabaseConfig(): void {
  if (!import.meta.env.VITE_SUPABASE_URL?.trim() || !import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()) {
    throw new DroneApiError("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 설정이 없습니다.", 0, "SUPABASE_CONFIG_MISSING");
  }
}

export function getDroneRuntimeConfig(): DroneRuntimeConfig {
  const env = import.meta.env;
  const runtime = typeof window === "undefined" ? undefined : window.GOLIVE_DRONE_CONFIG;
  const apiBaseUrl = runtime?.apiBaseUrl?.trim() || env.VITE_DRONE_API_BASE_URL?.trim() || "";
  return {
    apiBaseUrl: trimSlash(apiBaseUrl),
    supabaseUrl: trimSlash(runtime?.supabaseUrl?.trim() || env.VITE_SUPABASE_URL?.trim() || ""),
    supabaseAnonKey: runtime?.supabaseAnonKey?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim() || "",
    backendAccessToken: runtime?.backendAccessToken?.trim() || "",
    mediamtxWebRtcBaseUrl: trimSlash(runtime?.mediamtxWebRtcBaseUrl?.trim() || env.VITE_MEDIAMTX_WEBRTC_BASE_URL?.trim() || ""),
    missionId: new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("missionId")?.trim() || runtime?.missionId?.trim() || env.VITE_DRONE_MISSION_ID?.trim() || "",
    streamPath: runtime?.streamPath?.trim() || env.VITE_DRONE_STREAM?.trim() || "",
    // Read current Supabase session first; a separately authenticated GoLive backend token may be supplied at runtime.
    getAccessToken: async () => {
      if (runtime?.getAccessToken) return await runtime.getAccessToken();
      const supabase = typeof window === "undefined" ? undefined : window.supabase;
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) return data.session.access_token;
      }
      return runtime?.backendAccessToken?.trim() || null;
    },
  };
}

let droneSupabase: SupabaseClient | null = null;

function getSupabase(config: DroneRuntimeConfig): SupabaseClient {
  requireSupabaseConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) throw new DroneApiError("Supabase URL 또는 anon key 설정이 없습니다.", 0, "SUPABASE_CONFIG_MISSING");
  if (!droneSupabase) {
    droneSupabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      accessToken: async () => {
        const token = await config.getAccessToken();
        if (!token) throw new Error("GoLive 로그인 세션이 만료되었습니다.");
        return token;
      },
    });
  }
  return droneSupabase;
}

function throwDatabaseError(error: { message: string; code?: string } | null): void {
  if (error) throw new DroneApiError(error.message, 400, error.code);
}

function toDroneMission(value: unknown): DroneMission {
  const raw = value as Record<string, unknown>;
  const id = String(raw.id ?? raw.taskId ?? "");
  if (!id) throw new DroneApiError("API 응답에 임무 ID가 없습니다.", 502, "INVALID_MISSION_RESPONSE");
  const status = String(raw.status ?? "requested").toLowerCase();
  return {
    id,
    title: String(raw.title ?? "현장 작업"),
    location: String(raw.address ?? raw.location ?? "현장 위치 확인 필요"),
    requester: String(raw.clientName ?? raw.requester ?? "의뢰인"),
    scheduledAt: String(raw.scheduledAt ?? raw.createdAt ?? "일정 미정"),
    status: status === "in_progress" || status === "active" ? "active" : status === "assigned" || status === "accepted" ? "accepted" : status === "completed" ? "completed" : "requested",
  };
}

export async function getMission(config: DroneRuntimeConfig, missionId = config.missionId): Promise<DroneMission> {
  if (!missionId) throw new DroneApiError("실제 임무 모드에는 임무 ID가 필요합니다.", 0, "MISSION_ID_MISSING");
  const { data, error } = await getSupabase(config).from("drone_missions").select("*").eq("id", missionId).single();
  throwDatabaseError(error);
  return toDroneMission(data);
}

export async function createMission(config: DroneRuntimeConfig, input: {
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  price: number;
}): Promise<DroneMission> {
  const client = getSupabase(config);
  const token = await config.getAccessToken();
  if (!token) throw new DroneApiError("로그인 세션이 만료되었습니다.", 401, "AUTH_REQUIRED");
  const { data: userData, error: userError } = await client.auth.getUser(token);
  throwDatabaseError(userError);
  if (!userData.user) throw new DroneApiError("GoLive 로그인 사용자를 확인할 수 없습니다.", 401, "AUTH_REQUIRED");
  const { data, error } = await client.from("drone_missions").insert({
    requester_id: userData.user.id,
    title: input.title,
    description: input.description,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    budget_krw: input.price,
    status: "requested",
  }).select("*").single();
  throwDatabaseError(error);
  return toDroneMission(data);
}

/**
 * Claim a mission as the field operator.
 *
 * Goes through `accept_drone_mission` (0003_mission_lifecycle.sql) instead of a direct table
 * update: the RPC sets `operator_id` and `vehicle_id` from the authenticated session inside one
 * atomic UPDATE. A browser-side update previously omitted `operator_id`, which the 0002 RLS
 * policy rejected, and never set `vehicle_id`, which blocked every camera command afterwards.
 */
export async function acceptMission(config: DroneRuntimeConfig, missionId: string, vehicleId: string): Promise<DroneMission> {
  if (!vehicleId) throw new DroneApiError("수락할 기체를 선택하세요.", 0, "VEHICLE_ID_MISSING");
  const { data, error } = await getSupabase(config).rpc("accept_drone_mission", {
    p_mission_id: missionId,
    p_vehicle_id: vehicleId,
  });
  throwDatabaseError(error);
  const mission = Array.isArray(data) ? data[0] : data;
  if (!mission) throw new DroneApiError("서버가 임무를 반환하지 않았습니다.", 502, "EMPTY_MISSION_RESPONSE");
  return toDroneMission(mission);
}

/**
 * Move an accepted mission to `active` once the field agent is publishing video.
 * `request_drone_camera_command` requires status 'active', so no camera command can succeed
 * before this runs. Only the assigned operator may call it.
 */
export async function startMission(config: DroneRuntimeConfig, missionId: string): Promise<DroneMission> {
  const { data, error } = await getSupabase(config).rpc("start_drone_mission", {
    p_mission_id: missionId,
  });
  throwDatabaseError(error);
  const mission = Array.isArray(data) ? data[0] : data;
  if (!mission) throw new DroneApiError("서버가 임무를 반환하지 않았습니다.", 502, "EMPTY_MISSION_RESPONSE");
  return toDroneMission(mission);
}

export interface DroneSessionResponse {
  playbackUrl?: string;
  streamPath?: string;
  expiresAt?: string;
}

export async function createMissionVideoSession(config: DroneRuntimeConfig, missionId: string): Promise<DroneSessionResponse> {
  const { data, error } = await getSupabase(config).from("drone_sessions").select("stream_path,playback_url,expires_at").eq("mission_id", missionId).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
  throwDatabaseError(error);
  if (!data?.stream_path) throw new DroneApiError("임무에 활성 영상 세션이 없습니다. 현장 에이전트가 MediaMTX에 연결되어야 합니다.", 404, "VIDEO_SESSION_NOT_FOUND");
  if (!data.playback_url) throw new DroneApiError("임무별 인증 재생 URL이 없습니다. 공개 MediaMTX 경로를 대신 사용하지 않습니다.", 403, "SIGNED_PLAYBACK_URL_MISSING");
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) throw new DroneApiError("영상 재생 권한이 만료되었습니다. 새 세션을 발급하세요.", 403, "PLAYBACK_URL_EXPIRED");
  return { playbackUrl: data.playback_url, streamPath: data.stream_path, expiresAt: data.expires_at };
}

export async function submitCameraCommand(config: DroneRuntimeConfig, missionId: string, commandType: CameraCommandType, parameters: Record<string, unknown> = {}): Promise<DroneCommandResponse> {
  if (!missionId) throw new DroneApiError("임무를 불러온 뒤 카메라 작업을 요청하세요.", 0, "MISSION_ID_MISSING");
  const { data, error } = await getSupabase(config).rpc("request_drone_camera_command", {
    p_mission_id: missionId,
    p_command_type: commandType,
    p_parameters: parameters,
    p_request_id: crypto.randomUUID(),
  });
  throwDatabaseError(error);
  const command = Array.isArray(data) ? data[0] : data;
  if (!command) throw new DroneApiError("서버가 카메라 명령을 반환하지 않았습니다.", 502, "EMPTY_COMMAND_RESPONSE");
  return { id: command.id, status: command.status, commandType: command.command_type, createdAt: command.created_at, expiresAt: command.expires_at };
}

export async function getMissionEvents(config: DroneRuntimeConfig, missionId: string): Promise<MissionEvent[]> {
  const { data, error } = await getSupabase(config).from("drone_audit_logs").select("id,event_type,details,created_at").eq("mission_id", missionId).order("created_at", { ascending: false }).limit(50);
  throwDatabaseError(error);
  return (data ?? []).map((row) => ({ id: String(row.id), time: new Date(row.created_at).toLocaleTimeString("ko-KR", { hour12: false }), title: row.event_type, detail: JSON.stringify(row.details ?? {}), kind: "system" as const }));
}

export async function connectMissionRealtime(config: DroneRuntimeConfig, missionId: string, onEvent: (event: DroneLiveEvent) => void, onState: (state: DroneLiveState) => void): Promise<() => void> {
  if (!missionId) {
    onState({ connected: false, lastEventAt: null, message: "임무 ID가 없어 실시간 채널을 열 수 없습니다." });
    return () => undefined;
  }
  let channel: ReturnType<SupabaseClient["channel"]> | undefined;
  try {
    const token = await config.getAccessToken();
    if (!token) throw new DroneApiError("로그인이 필요합니다.", 401, "AUTH_REQUIRED");
    const client = getSupabase(config);
    await client.realtime.setAuth(token);
    channel = client.channel(`drone-mission:${missionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "drone_missions", filter: `id=eq.${missionId}` }, (payload) => onEvent({ event: "drone.status", payload: payload.new, receivedAt: new Date().toISOString() }))
      .on("postgres_changes", { event: "*", schema: "public", table: "drone_commands", filter: `mission_id=eq.${missionId}` }, (payload) => onEvent({ event: payload.eventType === "INSERT" ? "camera.command.pending" : "camera.command.completed", payload: payload.new, receivedAt: new Date().toISOString() }))
      .on("postgres_changes", { event: "*", schema: "public", table: "drone_sessions", filter: `mission_id=eq.${missionId}` }, (payload) => onEvent({ event: "video.connected", payload: payload.new, receivedAt: new Date().toISOString() }))
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") onState({ connected: true, lastEventAt: null, message: "임무 실시간 채널 연결됨" });
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onState({ connected: false, lastEventAt: null, message: error?.message || `실시간 채널 상태: ${status}` });
        else if (status === "CLOSED") onState({ connected: false, lastEventAt: null, message: "실시간 채널이 종료되었습니다." });
      });
  } catch (error) {
    onState({ connected: false, lastEventAt: null, message: error instanceof Error ? error.message : "실시간 채널 초기화 실패" });
    return () => undefined;
  }
  return () => { if (channel) void getSupabase(config).removeChannel(channel); };
}

export function getMediaMtxWebRtcUrl(config: DroneRuntimeConfig, streamPath = config.streamPath): string | null {
  if (!config.mediamtxWebRtcBaseUrl || !streamPath) return null;
  const base = trimSlash(config.mediamtxWebRtcBaseUrl);
  const path = streamPath.replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9/_-]+$/.test(path)) return null;
  return `${base}/${path}`;
}
