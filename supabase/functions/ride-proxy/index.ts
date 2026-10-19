import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RIDEFLOW_URL = Deno.env.get('RIDEFLOW_URL') ?? 'http://localhost:5000';
const sb = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname.replace('/ride-proxy', '');
  const target = `${RIDEFLOW_URL}${path}`;

  try {
    const body = req.method !== 'GET' ? await req.json() : undefined;
    const res = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();

    // rides 생성 시 Supabase rides 테이블에도 미러 INSERT (실시간 피드 연동)
    if (path === '/rides' && res.ok && data.id) {
      await sb.from('rides').insert({
        id: data.id,
        rider_id: data.rider_id,
        driver_id: data.driver_id,
        pickup: data.pickup,
        dest: data.dest,
        fare_estimate_krw: data.fare_estimate_krw,
        status: data.status,
      });
    }

    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502 });
  }
});