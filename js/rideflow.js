// RideFlow 라이드 엔진 래퍼 (Supabase Edge Function 경유)
// GPLv3 RideFlow 서비스와 물리적 네트워크 분리 유지
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const FN = `${SUPABASE_URL}/functions/v1/ride-proxy`;

const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

/** 거리/시간/요금 프리뷰 (RideFlow fare engine) */
export async function estimateFare({ pickup, dest }) {
  const r = await fetch(`${FN}/fare/estimate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ pickup, dest }),
  });
  if (!r.ok) throw new Error(`estimateFare failed: ${r.status}`);
  return r.json(); // { base, distance_km, duration_min, fare_krw, driver_share_krw }
}

/** 라이드 호출 요청 */
export async function requestRide(payload) {
  const r = await fetch(`${FN}/rides`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`requestRide failed: ${r.status}`);
  return r.json();
}

/** 기사 수락 */
export async function acceptRide(rideId, driverId) {
  const r = await fetch(`${FN}/rides/${rideId}/accept`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ driver_id: driverId }),
  });
  if (!r.ok) throw new Error(`acceptRide failed: ${r.status}`);
  return r.json();
}