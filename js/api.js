// Supabase REST 클라이언트 (의존성 없는 순수 fetch 기반)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

export async function getTasks(category = null) {
  // Only surface live requests. Without a status filter the list also shows
  // archived/QA rows created during testing and during the RLS rollout.
  let url = `${SUPABASE_URL}/rest/v1/tasks?select=*&order=created_at.desc&status=eq.open`;
  if (category) url += `&category=eq.${category}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GET tasks failed: ${r.status}`);
  return r.json();
}

export async function insertTask(task) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(task),
  });
  if (!r.ok) throw new Error(`INSERT task failed: ${r.status}`);
  return r.json();
}

export async function getRides() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/rides?select=*&order=requested_at.desc`,
    { headers },
  );
  if (!r.ok) throw new Error(`GET rides failed: ${r.status}`);
  return r.json();
}

export async function insertRide(ride) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rides`, {
    method: 'POST',
    headers,
    body: JSON.stringify(ride),
  });
  if (!r.ok) throw new Error(`INSERT ride failed: ${r.status}`);
  return r.json();
}

export async function getNearbyDrivers(lat, lng, radiusM = 3000) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/nearby_drivers?lat=${lat}&lng=${lng}&radius_m=${radiusM}`,
    { headers },
  );
  if (!r.ok) throw new Error(`RPC nearby_drivers failed: ${r.status}`);
  return r.json();
}

export async function insertActivityEvent(kind, payload, region) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/activity_events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind, payload, region }),
  });
  if (!r.ok) throw new Error(`INSERT activity_event failed: ${r.status}`);
  return r.json();
}

// ---- Map layers ---------------------------------------------------------
// Each function returns an array (possibly empty). They never throw;
// on failure they resolve with [] so the UI gracefully degrades to the
// in-memory demo seed used by dashboard-app.js.

export async function getDemand({ sinceHours = 24 } = {}) {
  try {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("demand")
      .select("category, lat, lng, intensity, observed_at")
      .gte("observed_at", since)
      .order("observed_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn("[api] getDemand fallback:", e?.message || e);
    return [];
  }
}

export async function getRiskZones() {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("risk_zones")
      .select("id, name, reason, severity, coordinates, starts_at, ends_at")
      .or(`ends_at.is.null,ends_at.gt.${now}`);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn("[api] getRiskZones fallback:", e?.message || e);
    return [];
  }
}

export async function getSignals({ sinceMinutes = 30 } = {}) {
  try {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("signals")
      .select("kind, lat, lng, observed_at")
      .gte("observed_at", since)
      .order("observed_at", { ascending: false })
      .limit(150);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn("[api] getSignals fallback:", e?.message || e);
    return [];
  }
}

export async function getValuation({ category = null } = {}) {
  try {
    let q = supabase
      .from("valuation")
      .select("category, lat, lng, avg_price, sample_size, observed_at")
      .order("observed_at", { ascending: false })
      .limit(120);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn("[api] getValuation fallback:", e?.message || e);
    return [];
  }
}
