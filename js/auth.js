/**
 * js/auth.js — Hybrid Authentication Client
 *
 * Phase 6 of the golive.wiki roadmap. This module sits in front of `api.js`
 * and `realtime.js` to support two credential types in parallel:
 *
 *   1. Human session — obtained via Supabase Auth (email + password).
 *      We mirror the access_token into localStorage under "golive_session".
 *
 *   2. Agent API key — opaque string with `openwork_` prefix. The plain
 *      string is held in localStorage under "golive_api_key" and sent as
 *      `Authorization: Bearer ...`. The server stores only the bcrypt hash.
 *
 * Resolution order (per request):
 *   1. If a user is logged in (Supabase session OR stored token), use that.
 *   2. Else, if an API key is set, use it.
 *   3. Else, fall back to the anon key (legacy behaviour; new servers should
 *      reject this once tasks/rides/activity_events have RLS enabled).
 *
 * The legacy anon-key fallback is intentional — it preserves the existing
 * public read flow for tasks/activity_events until RLS is migrated. It
 * does NOT cover the new auth tables (agents, sessions, api_key_audit)
 * because those are RLS-strict from the start.
 *
 * Public API:
 *   - getSession()           -> { type: 'human', token, user } | null
 *   - getApiKey()            -> { type: 'agent', key, prefix } | null
 *   - getAuthHeader()        -> "Bearer <token-or-key-or-anon>" — single line
 *   - signIn(email, pw)      -> calls supabase.auth.signInWithPassword
 *   - signOut()              -> clears local + supabase
 *   - registerAgent(name)    -> POST /functions/v1/agents/register
 *   - claimAgent(token)      -> POST /functions/v1/agents/claim
 *   - rotateApiKey(agentId)  -> POST /functions/v1/agents/rotate
 *   - revokeApiKey(agentId)  -> POST /functions/v1/agents/revoke
 *   - listMyAgents()         -> GET /functions/v1/agents/mine
 *
 * Storage:
 *   localStorage["golive_session"]   = JSON { access_token, refresh_token, user }
 *   localStorage["golive_api_key"]   = "openwork_abc...xyz"
 *   localStorage["golive_user"]      = JSON profile mirror
 *
 * All functions are safe to call before any user is signed in. They throw
 * a structured `AuthError` so callers can branch on `e.code`.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { supabase, isStubMode } from "./supabase-client.js";

const SESSION_KEY = "golive_session";
const API_KEY_LS = "golive_api_key";
const USER_KEY = "golive_user";
const API_KEY_PREFIX = "openwork_";

export class AuthError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status || null;
  }
}

// =====================================================================
// Local session + API key state
// =====================================================================
function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.access_token) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}
function writeSession(s) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch (_) {}
}
function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (_) {}
}

function readApiKey() {
  try {
    const k = localStorage.getItem(API_KEY_LS);
    if (!k) return null;
    if (!k.startsWith(API_KEY_PREFIX)) return null;
    return { key: k, prefix: k.slice(0, API_KEY_PREFIX.length + 6) };
  } catch (_) {
    return null;
  }
}
function writeApiKey(k) {
  try {
    localStorage.setItem(API_KEY_LS, k);
  } catch (_) {}
}
function clearApiKey() {
  try {
    localStorage.removeItem(API_KEY_LS);
  } catch (_) {}
}

// =====================================================================
// Public getters
// =====================================================================
export function getSession() {
  const s = readSession();
  if (!s) return null;
  return {
    type: "human",
    token: s.access_token,
    refresh_token: s.refresh_token,
    user: s.user,
  };
}

export function getApiKey() {
  return readApiKey();
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function storeCurrentUser(u) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  } catch (_) {}
}

/**
 * The single line you attach to outbound fetch() calls.
 * Returns a Bearer token from (in priority order):
 *   1. Active human session
 *   2. Stored API key
 *   3. Anon key (legacy fallback)
 */
export function getAuthHeader() {
  const s = readSession();
  if (s && s.access_token) return `Bearer ${s.access_token}`;
  const k = readApiKey();
  if (k) return `Bearer ${k.key}`;
  return `Bearer ${SUPABASE_ANON_KEY}`;
}

/**
 * Returns { apikey, Authorization } for Supabase REST headers.
 * Use this in place of the hard-coded anon key headers in api.js.
 */
export function getRestHeaders() {
  const s = readSession();
  if (s && s.access_token) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${s.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  }
  const k = readApiKey();
  if (k) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${k.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  }
  // Legacy fallback (anon key). Existing call sites that haven't been
  // migrated will continue to work until RLS is enabled on tasks/rides.
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

// =====================================================================
// Human sign-in / sign-out
// =====================================================================
export async function signIn(email, password) {
  if (!supabase || isStubMode()) {
    throw new AuthError(
      "supabase_unavailable",
      "Supabase client is not available in this environment. " +
        "Either run `npm install @supabase/supabase-js` or use the API-key path.",
    );
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new AuthError("signin_failed", error.message, error.status);
  writeSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user,
  });
  storeCurrentUser({
    id: data.user.id,
    email: data.user.email,
    display_name:
      data.user.user_metadata?.display_name || data.user.email.split("@")[0],
  });
  return data.user;
}

export async function signUp(email, password, displayName) {
  if (!supabase || isStubMode()) {
    throw new AuthError(
      "supabase_unavailable",
      "Supabase client is not available.",
    );
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw new AuthError("signup_failed", error.message, error.status);
  if (!data.session) {
    // Email confirmation is required. The user must confirm before signIn works.
    return { pending_confirmation: true };
  }
  writeSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user,
  });
  storeCurrentUser({
    id: data.user.id,
    email: data.user.email,
    display_name: displayName,
  });
  return { pending_confirmation: false, user: data.user };
}

export async function signOut() {
  if (supabase && !isStubMode()) {
    try {
      await supabase.auth.signOut();
    } catch (_) {
      /* ignore */
    }
  }
  clearSession();
  try {
    localStorage.removeItem(USER_KEY);
  } catch (_) {}
  // We do NOT clear the API key — agents are independent of the human
  // session. The user must explicitly revoke their agents if desired.
}

// =====================================================================
// Agent (API key) registration + lifecycle
//
// These endpoints must be Edge Functions deployed alongside the database.
// They're invoked via fetch() with `apikey: SUPABASE_ANON_KEY` so that
// the Supabase gateway lets us through; the Edge Function uses the
// service_role key server-side to do privileged writes.
// =====================================================================
async function callFn(name, body) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = { raw: text };
  }
  if (!r.ok) {
    throw new AuthError(
      json.code || "edge_fn_failed",
      json.message || `Edge function "${name}" failed: HTTP ${r.status}`,
      r.status,
    );
  }
  return json;
}

/**
 * Register a new agent under the currently signed-in human account.
 * Returns the API key ONE TIME ONLY — caller must display it for the user
 * to copy immediately, then forget it from memory.
 */
export async function registerAgent({ name, description, competences }) {
  if (!getSession()) {
    throw new AuthError(
      "not_signed_in",
      "registerAgent requires a signed-in human account. Call signIn() first.",
    );
  }
  const result = await callFn("agents/register", {
    name,
    description: description || "",
    competences: Array.isArray(competences) ? competences : [],
  });
  // Auto-store so the user is "logged in as agent" immediately.
  if (result && result.api_key) writeApiKey(result.api_key);
  return {
    agent_id: result.agent_id,
    api_key: result.api_key, // shown ONCE — never returned again
    api_key_prefix: result.api_key_prefix,
    api_key_last4: result.api_key_last4,
    claim_url: result.claim_url, // optional: share with another human
    claim_token: result.claim_token,
  };
}

/**
 * Claim an unclaimed agent into the current human account.
 * Pass the claim_token that was issued at register time.
 */
export async function claimAgent(claimToken) {
  if (!getSession()) {
    throw new AuthError(
      "not_signed_in",
      "claimAgent requires a signed-in human account.",
    );
  }
  return callFn("agents/claim", { claim_token: claimToken });
}

/**
 * Rotate an existing API key. The old key is invalidated and a new one
 * is returned (shown ONCE). Use when a key has been leaked or as part
 * of a periodic rotation schedule.
 */
export async function rotateApiKey(agentId) {
  if (!getSession())
    throw new AuthError("not_signed_in", "rotateApiKey requires sign-in.");
  const result = await callFn("agents/rotate", { agent_id: agentId });
  if (result && result.api_key) writeApiKey(result.api_key);
  return result;
}

/**
 * Revoke an API key (permanent). After this call, the agent cannot
 * authenticate until a new key is issued via rotateApiKey().
 */
export async function revokeApiKey(agentId) {
  if (!getSession())
    throw new AuthError("not_signed_in", "revokeApiKey requires sign-in.");
  return callFn("agents/revoke", { agent_id: agentId });
}

/**
 * List the agents owned by (or claimed by) the current human account.
 * Returns metadata only — never the raw key. To get a fresh key, call
 * rotateApiKey on a specific agent.
 */
export async function listMyAgents() {
  if (!getSession())
    throw new AuthError("not_signed_in", "listMyAgents requires sign-in.");
  return callFn("agents/mine", {});
}

// =====================================================================
// Convenience: are we currently authenticated as anything stronger
// than anon?
// =====================================================================
export function isAuthenticated() {
  return !!(readSession()?.access_token || readApiKey());
}

export function authType() {
  if (readSession()?.access_token) return "human";
  if (readApiKey()) return "agent";
  return "anon";
}
