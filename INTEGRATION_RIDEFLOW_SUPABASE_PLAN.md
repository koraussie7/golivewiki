# 🚕 골라이브위키 × RideFlow × Supabase 통합 계획

> 상태: 실행 중 (Act 모드) | 소스: `/Users/brianyeon/CodeGPT/golivewiki/` | 레포: `github.com/koraussie7/golivewiki` | 브랜치: main @ 4aaf00f

---

## 0. 아키텍처 (GPL 격리)

golive 프론트는 RideFlow를 직접 호출하지 않고 Edge Function을 경유 → GPLv3 코드와 물리적 네트워크 분리. Supabase Anon Key만 브라우저에 노출, RLS로 읽기/쓰기 정책 제한. RideFlow는 별도 Docker 컨테이너로 self-host (localhost 전용 포트).


## 1. 디렉터리 변경 계획

```
golivewiki/
├── index.html                  ✏️ 메인 UI 변경 (히어로 토글, 카테고리 pill)
├── screens-04-dashboard.html   ✏️ 라이드/배달 필터 + Supabase 피드
├── screens-05-create-gig.html  ✅ 죽은 링크 수정 완료
├── screens-06-task-detail.html ✅ 죽은 링크 수정 완료
├── screens-07-ride.html        🆕 택시 호출 화면 (inDrive 스타일) - S5
├── screens-admin.html          ✏️ API 매트릭스 → 실제 상태 + 헬스체크
├── styles/
│   ├── i18n.js                 ✏️ ride 관련 키 7개 언어 추가 (~60키) - S6
│   └── tokens.css              ✅ 생성 완료 (CSS 변수 토큰)
├── js/
│   ├── config.js               🆕 Supabase URL/anon key - S3
│   ├── api.js                  🆕 Supabase REST 클라이언트 - S3
│   ├── realtime.js             🆕 Realtime 채널 구독 - S3
│   └── rideflow.js             🆕 /functions/v1/ride-proxy 래퍼 - S4
├── supabase/
│   ├── migrations/0001_init.sql 🆕 스키마 (tasks/rides/PostGIS/RLS) - S2
│   └── functions/
│       └── ride-proxy/
│           └── index.ts        🆕 Deno Edge 함수 - S4
├── deploy/rideflow/
│   ├── docker-compose.yml      🆕 Redis + rideflow server - S4
│   └── README.md               🆕 self-host 가이드 - S4
├── vite.config.js              ✏️ screens-07-ride entry 추가 - S5
└── scripts/validate-i18n.mjs   ✅ 그대로 (키 추가 후 검증) - S6
```

## 2. Supabase 스키마 (supabase/migrations/0001_init.sql)

```sql
-- 역할 확장 프로필 (auth.users 1:1)
create type user_role as enum ('poster','worker','driver','admin');

create table profiles (
  id uuid primary key references auth.users,
  role user_role not null default 'poster',
  display_name text, phone text,
  driver_share numeric default 0.82,
  rating numeric default 5.0, rides_count int default 0,
  is_online boolean default false,
  last_location geography(point,4326)
);

create table tasks (
  id uuid default gen_random_uuid() primary key,
  poster_id uuid references profiles(id),
  category text not null,
  title text, description text,
  budget_krw int, timing text,
  location geography(point,4326), region text,
  status text default 'open',
  created_at timestamptz default now()
);

create table offers (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references tasks(id) on delete cascade,
  worker_id uuid references profiles(id),
  price_krw int, message text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table rides (
  id uuid primary key,
  rider_id uuid, driver_id uuid,
  pickup geography(point,4326), dest geography(point,4326),
  fare_estimate_krw int, fare_final_krw int,
  driver_share_pct numeric default 82,
  status text default 'searching',
  requested_at timestamptz default now()
);

create table activity_events (
  id bigserial primary key,
  kind text,
  payload jsonb, region text,
  created_at timestamptz default now()
);

create index idx_tasks_loc on tasks using gist (location);
create index idx_drivers_loc on profiles using gist (last_location)
  where role='driver' and is_online;

create or replace function nearby_drivers(lat float8, lng float8, radius_m float8 default 3000)
returns table(id uuid, display_name text, rating numeric, dist_m float8) language sql as $$
  select p.id, p.display_name, p.rating,
         st_distance(p.last_location, st_point(lng, lat)::geography) as dist_m
  from profiles p
  where p.role='driver' and p.is_online
    and st_dwithin(p.last_location, st_point(lng, lat)::geography, radius_m)
  order by dist_m;
$$;

alter table tasks enable row level security;
create policy "public read tasks" on tasks for select using (true);
create policy "insert own tasks" on tasks for insert with check (auth.uid() = poster_id);

alter table offers enable row level security;
create policy "public read offers" on offers for select using (true);
create policy "insert own offers" on offers for insert with check (auth.uid() = worker_id);

alter table rides enable row level security;
create policy "public read rides" on rides for select using (true);
create policy "insert own rides" on rides for insert with check (auth.uid() = rider_id);

alter table activity_events enable row level security;
create policy "public read events" on activity_events for select using (true);
create policy "insert own events" on activity_events for insert with check (auth.uid() = (payload->>'user_id')::uuid);
```

## 3. 메인 UI 변경 코드

### 3-1 index.html 헤더 + 카테고리 pill

```html
<!-- nav-actions에 추가 -->
<a href="screens-07-ride.html" class="nav-link" data-i18n="nav_ride">🚕 라이드</a>

<!-- category-pills에 2개 추가 -->
<a class="cat-pill" href="screens-07-ride.html">
  🚕 라이드 <span id="ride-live-count">–</span>
</a>
<a class="cat-pill" href="screens-04-dashboard.html?category=delivery">🍔 배달</a>
```

### 3-2 Quick Post 카드에 라이드 모드 토글 (inDrive 핵심 UX)

```html
<div class="mode-toggle">
  <button class="mode-btn active" data-mode="task" data-i18n="mode_task">📜 일 올리기</button>
  <button class="mode-btn" data-mode="ride" data-i18n="mode_ride">🚕 태우기 (요금 제시)</button>
</div>

<div id="ride-quick-form" hidden>
  <input class="styled-input" data-i18n-ph="ph_pickup" placeholder="출발지">
  <input class="styled-input" data-i18n-ph="ph_dest" placeholder="도착지">
  <div class="fare-slider-row">
    <span data-i18n="fare_offer_label">내가 제시하는 요금</span>
    <input type="range" id="fare-slider" min="3000" max="50000" step="500" value="12000">
    <strong id="fare-value">₩12,000</strong>
  </div>
  <button class="btn-post-task" onclick="requestRide()" data-i18n="btn_request_ride">
    기사 제안 받기 →
  </button>
</div>
```

> inDrive의 핵심 UX(운행료 직접 제시 → 기사들이 응찰)를 메인 히어로에서 1클릭으로.

### 3-3 하단 피드를 Supabase Realtime으로 교체

```html
<script type="module">
  import { subscribeFeed } from './js/realtime.js';
  subscribeFeed((ev) => prependFeedItem(ev));
</script>
```

### 3-4 신규 화면 screens-07-ride.html (개요)

- Leaflet 지도(상단 60%) + 하단 카드(하단 40%) = inDrive 앱 레이아웃
- 동작: 출발/도착 지오코딩 → `POST ride-proxy/fare/estimate` 요금 프리뷰 → "요금 제시 & 호출" → Supabase `rides` INSERT(status=searching) → Realtime `ride_events` 채널로 기사 수락 푸시 → 상태머신 UI(searching→accepted→on_trip→completed)
```

## 4. 핵심 코드 모듈

### js/config.js

```js
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://xxx.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
```

### js/api.js (무의존 fetch 기반 Supabase REST)

```js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export async function getTasks(category = null) {
  let url = `${SUPABASE_URL}/rest/v1/tasks?select=*&order=created_at.desc`;
  if (category) url += `&category=eq.${category}`;
  const r = await fetch(url, { headers });
  return r.json();
}

export async function insertTask(task) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
    method: 'POST', headers, body: JSON.stringify(task),
  });
  return r.json();
}

export async function getRides() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rides?select=*&order=requested_at.desc`, { headers });
  return r.json();
}

export async function insertRide(ride) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rides`, {
    method: 'POST', headers, body: JSON.stringify(ride),
  });
  return r.json();
}
```

### js/realtime.js

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function subscribeFeed(onEvent) {
  return sb
    .channel('activity-feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_events' }, (payload) => {
      onEvent(payload.new);
    })
    .subscribe();
}

export function subscribeRideEvents(onEvent) {
  return sb
    .channel('ride-events')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, (payload) => {
      onEvent(payload.new, payload.eventType);
    })
    .subscribe();
}
```

### js/rideflow.js (Edge Function 경유 래퍼)

```js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const FN = `${SUPABASE_URL}/functions/v1/ride-proxy`;

const authHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

export async function estimateFare({ pickup, dest }) {
  const r = await fetch(`${FN}/fare/estimate`, {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ pickup, dest }),
  });
  return r.json(); // { base, distance_km, duration_min, fare_krw, driver_share_krw }
}

export async function requestRide(payload) {
  const r = await fetch(`${FN}/rides`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify(payload),
  });
  return r.json();
}

export async function acceptRide(rideId, driverId) {
  const r = await fetch(`${FN}/rides/${rideId}/accept`, {
    method: 'PUT', headers: authHeaders, body: JSON.stringify({ driver_id: driverId }),
  });
  return r.json();
}
```

### supabase/functions/ride-proxy/index.ts (Deno Edge)

```ts
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

    if (path === '/rides' && res.ok && data.id) {
      await sb.from('rides').insert({
        id: data.id, rider_id: data.rider_id, driver_id: data.driver_id,
        pickup: data.pickup, dest: data.dest,
        fare_estimate_krw: data.fare_estimate_krw, status: data.status,
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
```

### deploy/rideflow/docker-compose.yml

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports: ["127.0.0.1:6379:6379"]

  rideflow:
    image: node:22-alpine
    working_dir: /app
    volumes: ["./rideflow-src:/app"]
    command: sh -c "npm ci && npm run server:dev"
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=5000
    depends_on: [redis]
    ports: ["127.0.0.1:5000:5000"]
```

## 5. 기존 파일 수정 목록 (S1 완료)

| 파일 | 수정 내용 | 상태 |
|------|----------|------|
| styles/tokens.css | 🆕 CSS 변수 토큰 정의 (14개 변수) | ✅ 완료 |
| screens-05-create-gig.html | `04-dashboard.html`→`screens-04-dashboard.html` (2곳), `06-task-detail.html`→`screens-06-task-detail.html` | ✅ 완료 |
| screens-06-task-detail.html | `04-dashboard.html`→`screens-04-dashboard.html`, `09-payment.html`→`#payment` (2곳), `admin.html`→`screens-admin.html` | ✅ 완료 |
| screens-admin.html | `06-task-detail.html`→`screens-06-task-detail.html`, `04-dashboard.html`→`screens-04-dashboard.html`, `08-matching.html`→`#matching`, `09-payment.html`→`#payment` (2곳), `07-my-gigs.html`→`#mygigs` | ✅ 완료 |
| screens-04-dashboard.html | `./styles/i18n.js`→`../styles/i18n.js`, `05-create-gig.html`→`screens-05-create-gig.html`, `06-task-detail.html`→`screens-06-task-detail.html`, `07-my-gigs.html`→`#mygigs` | ✅ 완료 |
| index.html | `screens/admin.html`→`screens-admin.html` | ✅ 완료 |
| vite.config.js | `screens-07-ride` input 추가 | S5 |
| i18n.js | `nav_ride`, `mode_task`, `mode_ride`, `ph_pickup`, `ph_dest`, `fare_offer_label`, `btn_request_ride`, `ride_searching`, `ride_accepted`, `ride_on_trip`, `ride_completed` 7 언어 | S6 |

## 6. 실행 순서 S1~S7

| 단계 | 내용 | 상태 |
|------|------|------|
| **S1** | Phase 0 결손 수정: tokens.css 생성 + 죽은 링크 수정 (13건) + i18n 경로 수정 | ✅ 완료 |
| **S2** | Supabase 프로젝트 생성 + 0001_init.sql 적용 + RLS 확인 | 대기 |
| **S3** | js/config.js · api.js · realtime.js 작성 → 대시보드 실데이터 로드 | 대기 |
| **S4** | ride-proxy 엣션션 deploy + RideFlow compose up → fare/estimate 200 | 대기 |
| **S5** | screens-07-ride.html + index.html 히어로 토글 → 호출→수락 e2e | 대기 |
| **S6** | i18n 키 추가 → npm run validate (187+60=247키) | 대기 |
| **S7** | npm run build → dist 5+1 페이지, 링크 크롤 점검 | 대기 |

## 7. 리스크 및 고지

- **RideFlow GPLv3**: 네트워크 경계(Edge Proxy)로 분리 → golive 프론트 GPL 비영향
- **택시 규제**: 라이드 카테고리는 "대리운전/귀가 동행" 문구 런칭 권장 (여객운수법)
- **Supabase RLS**: anon key 노출 최소화, 읽기 정책만 공개
- **RideFlow 신규 프로젝트(stars 2)**: API 변경 가능성 → edge proxy가 단일 변형점이라 컨테이너블

