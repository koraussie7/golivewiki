// World brief endpoints served on the Cloudflare edge.
//
// Background: the Fastify world-routes backend (services/api/src/world-routes.ts)
// is not deployed, and /api/world/* currently falls through to
// `{"error":"not found"}` (see FEED_PREFIXES in feed-api.ts). That leaves
// muhanai.com/world with a null brief -> blank page.
//
// This module serves the same contract as world-routes.ts from the worker:
// a deterministic offline snapshot (same shape, Korean copy), so the panel
// always renders. When the real upstream (api.muhanai.com or an
// Ontology-Graph/Pythia engine) is deployed, point the frontend there or
// proxy from the worker and delete this shim.
//
// Worker-safe: no Node APIs, no process.env (values would have to be threaded
// through handleFeedApi, which only receives the KV binding today).

export interface WorldEvent {
	id: string;
	title: string;
	domain: string;
	location?: string;
	severity: "info" | "watch" | "alert";
	source: string;
	timestamp: string;
}

export interface WorldPrediction {
	id: string;
	title: string;
	horizon: "24h" | "1w" | "1m" | "1y";
	probability: number;
	confidence: number;
	rationale: string;
}

export interface WorldBrief {
	source: "pythia" | "offline" | "ontograph";
	summary: string;
	domains: string[];
	events: WorldEvent[];
	predictions: WorldPrediction[];
	fetchedAt: string;
}

const WORLD_DOMAINS = ["conflict", "disaster", "weather", "cyber", "infrastructure", "markets"];

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});

/** Deterministic offline snapshot — same hour -> same ids, mirrors world-routes.ts. */
export function buildWorldOfflineBrief(): WorldBrief {
	const hour = Math.floor(Date.now() / 3_600_000);
	const resetAt = new Date();
	resetAt.setUTCMinutes(0, 0, 0);
	const stamp = resetAt.toISOString();
	const hh = String(resetAt.getUTCHours()).padStart(2, "0");
	return {
		source: "offline",
		summary:
			`오프라인 스냅샷 (UTC ${hh}시 기준). ` +
			"Ontology-Graph가 연결되면 실시간 세계 상태와 예측이 표시됩니다.",
		domains: [...WORLD_DOMAINS],
		events: [
			{
				id: `off-${hour}-1`,
				title: "[오프라인] 실시간 피드 연결 대기 중",
				domain: "infrastructure",
				severity: "info",
				source: "offline",
				timestamp: stamp,
			},
			{
				id: `off-${hour}-2`,
				title: "[오프라인] 40+ 키리스 피드가 연결되면 자동 갱신",
				domain: "cyber",
				severity: "info",
				source: "offline",
				timestamp: stamp,
			},
		],
		predictions: [
			{
				id: `offp-${hour}-1`,
				title: "[오프라인] 엔진 연결 후 1d/1w/1m/1y 예측 제공",
				horizon: "1w",
				probability: 0.5,
				confidence: 0.5,
				rationale: "Ontology-Graph 예측 엔진에 연결되면 확률·근거·위치가 채워집니다.",
			},
		],
		fetchedAt: stamp,
	};
}

function queryOf(request: Request): URLSearchParams {
	try {
		return new URL(request.url).searchParams;
	} catch {
		return new URLSearchParams();
	}
}

/** GET /api/world/brief[?domain=] */
export async function getWorldBrief(request: Request): Promise<Response> {
	const brief = buildWorldOfflineBrief();
	const domain = queryOf(request).get("domain");
	return json(
		domain ? { ...brief, events: brief.events.filter((e) => e.domain === domain) } : brief,
	);
}

/** GET /api/world/events[?domain=][?limit=] */
export async function listWorldEvents(request: Request): Promise<Response> {
	const brief = buildWorldOfflineBrief();
	const q = queryOf(request);
	const domain = q.get("domain");
	const rawLimit = Number(q.get("limit"));
	const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 100) : 50;
	let events = domain ? brief.events.filter((e) => e.domain === domain) : brief.events;
	events = events.slice(0, limit);
	return json({ source: brief.source, events, fetchedAt: brief.fetchedAt });
}

/** GET /api/world/predictions */
export async function listWorldPredictions(): Promise<Response> {
	const brief = buildWorldOfflineBrief();
	return json({ source: brief.source, predictions: brief.predictions, fetchedAt: brief.fetchedAt });
}

/** GET /api/world/health — edge shim serves offline data; no upstream wired. */
export async function getWorldHealth(): Promise<Response> {
	return json({
		configured: false,
		reachable: false,
		pythia: { configured: false, reachable: false },
		ontograph: { configured: false, reachable: false },
		shim: "offline-snapshot",
		checkedAt: new Date().toISOString(),
	});
}
