// Supabase REST 클라이언트 (의존성 없는 순수 fetch 기반)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function getTasks(category = null) {
  let url = `${SUPABASE_URL}/rest/v1/tasks?select=*&order=created_at.desc`;
  if (category) url += `&category=eq.${category}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GET tasks failed: ${r.status}`);
  return r.json();
}

async function insertTask(task) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(task),
  });
  if (!r.ok) throw new Error(`INSERT task failed: ${r.status}`);
  return r.json();
}

async function getRides() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/rides?select=*&order=requested_at.desc`,
    { headers },
  );
  if (!r.ok) throw new Error(`GET rides failed: ${r.status}`);
  return r.json();
}

async function insertRide(ride) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rides`, {
    method: 'POST',
    headers,
    body: JSON.stringify(ride),
  });
  if (!r.ok) throw new Error(`INSERT ride failed: ${r.status}`);
  return r.json();
}

async function getNearbyDrivers(lat, lng, radiusM = 3000) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/nearby_drivers?lat=${lat}&lng=${lng}&radius_m=${radiusM}`,
    { headers },
  );
  if (!r.ok) throw new Error(`RPC nearby_drivers failed: ${r.status}`);
  return r.json();
}

async function insertActivityEvent(kind, payload, region) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/activity_events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind, payload, region }),
  });
  if (!r.ok) throw new Error(`INSERT activity_event failed: ${r.status}`);
  return r.json();
}