/**
 * js/supabase-client.js
 *
 * Optional Supabase-js client (Realtime channels). Falls back gracefully
 * if @supabase/supabase-js is not installed — the page then uses js/api.js
 * (fetch-based REST) for all persistence, and simulates Realtime with setTimeout.
 *
 * Install for full Realtime:
 *   npm install @supabase/supabase-js
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

let _supabase = null;
let _usingStub = true;

try {
  const mod = await import("@supabase/supabase-js");
  _supabase = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  _usingStub = false;
} catch (e) {
  console.info(
    "[supabase] @supabase/supabase-js not installed — Realtime disabled. " +
    "REST via api.js works. Run `npm install @supabase/supabase-js` for live updates."
  );
}

export const supabase = _supabase;
export const isStubMode = () => _usingStub;
