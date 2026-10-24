# GoLive 드론 관제 + 스마트글라스 의뢰 — 통합 코드 설계

> **대상:** `golive.wiki` 웹 클라이언트, `golive-smartglass` Task API, 그리고 신규 현장 에이전트
> **상태:** 설계서 (구현 완료·배포 완료 아님)
> **작성일:** 2026-10-24
> **근거:** 이 저장소에 이미 존재하는 코드(`supabase/migrations/0002_drone_control.sql`, `src/features/drone/*`)와
> `/Users/brianyeon/CodeGPT/golive-smartglass`(Task API)를 실제로 읽고 작성했다. 읽지 않은 것은 "미확인"으로 표시했다.

---

## 0. 이 문서를 읽는 방법

앞선 논의는 "드론"과 "스마트글라스"를 각각 따로 다뤘다. 그런데 실제 저장소를 확인한 결과 **둘은 이미 같은 모양의 문제**다.

| 공통 축                                 | 드론                                          | 스마트글라스                        |
| --------------------------------------- | --------------------------------------------- | ----------------------------------- |
| 의뢰인 ↔ 현장 제공자 매칭               | `drone_missions`                              | `smartglass_tasks`                  |
| 현장 장치가 영상 송출                   | MediaMTX (RTSP/WebRTC)                        | MediaMTX (`SMARTGLASS_STREAM_BASE`) |
| **명령은 서버 검증 → 현장 승인 → 실행** | `request_drone_camera_command` → `decide_...` | 미구현 (영상 세션만 있음)           |
| 의도 해석                               | 미구현 (설계만)                               | 미구현                              |
| 실제 비행/기 직접 제어                  | **범위 제외**                                 | **범위 제외**                       |

따라서 이 문서는 **두 기능을 하나의 "현장 작업(Field Job)" 모델로 합치는 설계**다. 각각 플랫폼을 만드는 것보다 코드가 절반으로 줄고, 드론에서 검증한 승인 흐름을 글라스에 그대로 재사용할 수 있다.

**읽기 순서:** §1(현재 상태) → §2(통합 모델) → §3(핵심 결함과 수정) → §4~§7(구현) → §8(테스트) → §9(배포/롤백)

---

## 1. 지금 저장소에 실제로 있는 것 / 없는 것

### 1.1 있는 것 (확인함)

| 위치                                            | 내용                                                     | 성숙도                                                                                                    |
| ----------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/0002_drone_control.sql`    | 6개 테이블 + RLS + RPC 2개 + Realtime 등록               | **높음.** 승인 전 실행 차단, 멱등 요청(`unique(requester_id, request_id)`), 60초 만료, 감사 로그까지 있음 |
| `src/features/drone/api/drone-api.ts`           | Supabase 직접 호출, Realtime 구독, MediaMTX URL 생성     | 중간. 아래 §3 결함 참조                                                                                   |
| `src/features/drone/DroneControlPage.tsx`       | 시뮬레이션/실제 모드 분리된 관제 UI                      | 중간. 초기 데이터가 하드코딩                                                                              |
| `src/features/drone/api/drone-agent-adapter.ts` | `DroneCameraAdapter` 인터페이스 + `FieldAgentGateway`    | **낮음.** `getStatus()`만 구현, 명령 실행 경로 없음                                                       |
| `DRONE-CONTROL-CODE-PLAN.md`                    | 드론 MVP 계획서                                          | 문서                                                                                                      |
| golive-smartglass `server/`                     | Task API, JWT 검증, Postgres 스토어, 동의 기반 영상 세션 | 중간. 멱등성·원자적 수락 없음                                                                             |

### 1.2 없는 것 (중요)

- **현장 에이전트 실행 파일이 없다.** `drone-agent/` 디렉터리는 `/Users/brianyeon/CodeGPT/integration-finalize-2`에 1개 하위 항목만 있고, 실제 MAVSDK/DJI 어댑터 구현은 없다.
- **DJI 어댑터가 없다.** DJI Mobile SDK는 오픈소스가 아니며 별도 네이티브 앱이 필요하다.
- **AI 에이전트 연결이 없다.** 자연어 → 구조화 명령 변환 코드 없음.
- **MediaMTX 배포 설정이 없다.** Docker 명령 예시만 문서에 있음.

> ⚠️ **문서의 경계:** 아래 설계 중 "현장 에이전트", "DJI 앱", "AI 의도 해석"은 **신규 개발**이다. 기존 코드 재사용 범위는 §1.1이다.

---

## 2. 통합 데이터 모델: `field_jobs` (권장안)

### 2.1 왜 합치는가

지금 두 시스템은 같은 개념을 두 번 정의한다:

```
drone_missions: requester_id, operator_id, status(requested→accepted→active→completed)
smartglass_tasks: requester_id, worker_id, status(open→accepted→in_progress→completed)
```

상태 이름만 다를 뿐 전이 구조가 동일하다. 이걸 합치면 **의뢰 화면 하나에서 "드론" 또는 "글라스"를 선택**하고, 매칭/영상/명령/감사를 공통 로직으로 처리한다.

### 2.2 스키마 전략 (중요)

**기존 테이블을 지우지 않는다.** 새 통합 테이블을 추가하고, 기존 데이터는 뷰로 노출한다.

```sql
-- 신규: 통합 현장 작업
create table public.field_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('drone','smartglass')),   -- 제공자 종류
  requester_id uuid not null references public.profiles(id),
  provider_id uuid references public.profiles(id),
  asset_id uuid,                                               -- drone_vehicles.id 또는 null
  title text not null check (length(trim(title)) between 3 and 160),
  description text not null default '',
  area jsonb not null default '{}'::jsonb,                      -- {lat,lng,radiusM,label}
  status text not null default 'requested'
    check (status in ('requested','accepted','active','completed','cancelled','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 기능(capability)은 제공자 종류별로 다르다
create table public.field_job_capabilities (
  job_id uuid not null references public.field_jobs(id) on delete cascade,
  capability text not null,                                    -- 'camera.capture_photo' | 'glass.read_text' ...
  primary key (job_id, capability)
);
```

**이행 규칙:** `drone_missions`/`smartglass_tasks`는 **유지**하고, 신규 기능만 `field_jobs`를 쓴다. 기존 화면을 깨지 않기 위함이다. 두 시스템을 한 번에 합치면 회귀 위험이 크다.

> **판단:** 지금 단계에서 `field_jobs`로 전면 이행하는 것은 **권장하지 않는다.** 먼저 §3의 결함을 고치고, 드론 MVP를 실제로 검증한 뒤 통합하는 것이 안전하다. 이 문서는 통합 모델을 "목표 구조"로만 제시한다.

### 2.3 capability 목록 (제공자별로 다름을 명시)

| capability                          | 드론(MAVLink)    | 드론(DJI)   | 글라스 | 비고        |
| ----------------------------------- | ---------------- | ----------- | ------ | ----------- |
| `camera.capture_photo`              | ✅ MAVSDK Camera | 모델 의존   | ✅     |             |
| `camera.start_video` / `stop_video` | ✅               | 모델 의존   | ✅     |             |
| `camera.zoom`                       | ✅ (1~5)         | 모델 의존   | ❌     |             |
| `glass.read_text` (OCR)             | ❌               | ❌          | ✅     | 신규        |
| `glass.translate`                   | ❌               | ❌          | ✅     | 신규        |
| `flight.goto` / `flight.land`       | ❌ **차단**      | ❌ **차단** | —      | MVP 범위 외 |

**원칙:** 모든 기체에 동일 명령을 강제하지 않는다. `capabilities`에 **실제 확인된 것만** 저장하고, 없으면 `unsupported`로 응답한다. 이 원칙은 `0002_drone_control.sql:256-258`에 이미 구현돼 있다.

---

## 3. 현재 코드의 결함과 수정 (구현 전 필수)

이 절은 "새로 만들 것"이 아니라 **"지금 있는 것이 안전하지 않은 지점"**이다. 이걸 고치지 않고 에이전트를 붙이면 §8 안전 테스트를 통과할 수 없다.

### 3.1 🔴 드론: `createMission`이 `description` 누락 → 등록 실패

`drone-api.ts:150-159`는 `.insert({ requester_id, title, description, address, latitude, longitude, budget_krw, status })`를 보낸다. 그런데 이 `<select>`는 `select("*")`로 되읽고 `toDroneMission`은 `description`을 쓰지 않는다. 문제는 **RLS 정책**이다:

```sql
-- 0002_drone_control.sql:143-144
with check (requester_id = auth.uid() and status = 'requested' and operator_id is null and exists(...))
```

`description` 컬럼이 `not null default ''`이므로 INSERT는 통과한다. **결함이 아니다** — 확인 후 정정. 다만 `scheduled_at`이 입력되지 않아 `toDroneMission`에서 `"일정 미정"`으로 떨어진다.

**실제 결함은 아래 3.2다.**

### 3.2 🔴 드론: `acceptMission`이 `vehicle_id`를 설정하지 않는다

```ts
// drone-api.ts:164-168
update({ status: "accepted" }).eq("id", missionId).eq("status", "requested");
```

RLS `drone_missions_accept_operator`(`0002:147-149`)는 `with check (operator_id = auth.uid() and status = 'accepted')`을 요구하는데, 이 쿼리는 **`operator_id`를 쓰지 않는다.** → **RLS 위반으로 수락이 실패**한다.

그리고 `request_drone_camera_command`는 `vehicle_id is null`이면 예외를 던진다(`0002:250`). 즉 **수락에 성공해도 카메라 명령은 영원히 실패**한다.

**수정:**

```ts
export async function acceptMission(config, missionId, vehicleId) {
  const token = await config.getAccessToken();
  const { data: user } = await getSupabase(config).auth.getUser(token!);
  return getSupabase(config)
    .from("drone_missions")
    .update({
      status: "accepted",
      operator_id: user.user!.id,
      vehicle_id: vehicleId,
    })
    .eq("id", missionId)
    .eq("status", "requested")
    .select("*")
    .single();
}
```

`vehicleId`는 소유자의 `drone_vehicles.id`이며 **클라이언트가 임의 지정하면 안 된다.** RLS 정책이 `v.owner_id = auth.uid()`를 검사하지만, 서버(RPC)로 옮기는 편이 안전하다. → §4.2

### 3.3 🔴 드론: `required status = 'active'`인데 `active`로 바꾸는 코드가 없다

`request_drone_camera_command`는 `v_mission.status <> 'active'`면 예외(`0002:248`). 그런데 `accepted` → `active` 전이를 수행하는 함수/화면이 **없다**(`drone-api.ts` 전체에 해당 코드 없음). → MVP에서 카메라 명령이 **100% 실패**한다.

**수정:** `start_drone_mission(mission_id)` RPC 추가. 에이전트 접속 시 서버가 호출.

### 3.4 🟠 드론: Supabase anon key 하드코딩

`drone-api.ts:66`에 anon key가 **소스에 박혀 있다**. anon key는 공개 전제라 치명적은 아니지만, 다른 프로젝트로 바뀌면 조용히 잘못된 DB에 붙는다. **환경변수 필수화**하고 기본값을 제거해야 한다.

### 3.5 🟠 글라스: 이벤트 재전송 시 중복 생성

golive-smartglass `postgres-store.ts:64-70`은 무조건 `insert`. 네트워크 타임아웃 후 재전송하면 이벤트가 2번 쌓인다. 오프라인 큐(앞선 논의 (c))를 붙이려면 필수 수정.

```sql
alter table smartglass_task_events add column if not exists client_event_id text;
create unique index if not exists smartglass_task_events_dedupe
  on smartglass_task_events (task_id, client_event_id) where client_event_id is not null;
```

### 3.6 🟠 글라스: 수락 경쟁 조건

`index.ts:120-131`은 `findTask` → 상태 검사 → `updateTask`의 3단계다. 두 워커가 동시에 수락하면 둘 다 통과할 수 있다.

```sql
-- 원자적 수락: 영향 행 수로 판정
update smartglass_tasks set status='accepted', worker_id=$2, updated_at=now()
where id=$1 and status='open'
returning *;
-- 0 rows → 이미 누가 선점 → 409
```

`updateTask`는 조건부 WHERE를 지원하지 않으므로 **전용 메서드 `claimTask()`** 를 추가해야 한다.

### 3.7 🟡 드론: `zoom` 파라미터 범위가 RPC에만 있다

`0002:259-261`은 RPC에서 `1..5`를 검사한다. 그런데 `drone-api.ts:185`의 `submitCameraCommand`는 `parameters`를 그대로 전달하므로 타입 수준 검증이 없다. `CameraCommandType`별 파라미터 스키마(zod)를 **에이전트 쪽에도** 두어 이중 검증한다.

---

## 4. 구현 단계 (초보자용)

### 4.1 준비 — 로컬 환경

```bash
# 1) 드론(GoLive 웹) 저장소
cd /Users/brianyeon/CodeGPT/integration-finalize-2
git switch -c feature/drone-agent-mvp
npm install
npm run build          # 기준 상태 기록: 빌드가 되는지 먼저 확인

# 2) 글라스 Task API 저장소
cd /Users/brianyeon/CodeGPT/golive-smartglass
git switch -c feature/agent-integration
pnpm install --frozen-lockfile
pnpm -r typecheck      # 확인됨: 4개 패키지 통과
```

> `git status`가 깨끗하지 않으면 **먼저 커밋하세요.** 다른 작업자 변경을 덮어쓰지 않습니다.

### 4.2 드론: 서버 RPC 추가 (`supabase/migrations/0003_mission_lifecycle.sql`)

클라이언트가 상태를 직접 바꾸지 못하게 RPC로 옮긴다.

```sql
-- 수락: operator + vehicle을 한 트랜잭션에서 원자적으로 확정
create or replace function public.accept_drone_mission(p_mission_id uuid, p_vehicle_id uuid)
returns public.drone_missions language plpgsql security definer
set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row public.drone_missions %rowtype;
begin
  if v_uid is null then raise exception 'authentication required' using errcode='28000'; end if;
  -- 기체 소유권 검증 (클라이언트가 남의 기기를 지정하지 못하게)
  if not exists (select 1 from public.drone_vehicles v
                 where v.id = p_vehicle_id and v.owner_id = v_uid) then
    raise exception 'vehicle not owned by caller' using errcode='42501';
  end if;
  update public.drone_missions
     set status='accepted', operator_id=v_uid, vehicle_id=p_vehicle_id, updated_at=now()
   where id=p_mission_id and status='requested'
  returning * into v_row;
  if not found then raise exception 'mission already taken' using errcode='55000'; end if;

  insert into public.drone_audit_logs(mission_id, actor_id, event_type, details)
  values (p_mission_id, v_uid, 'mission.accepted', jsonb_build_object('vehicleId', p_vehicle_id));
  return v_row;
end; $$;

-- 시작: accepted → active (에이전트가 MediaMTX 게시를 시작한 뒤 호출)
create or replace function public.start_drone_mission(p_mission_id uuid)
returns public.drone_missions language plpgsql security definer
set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row public.drone_missions %rowtype;
begin
  update public.drone_missions set status='active', updated_at=now()
   where id=p_mission_id and operator_id=v_uid and status='accepted'
  returning * into v_row;
  if not found then raise exception 'only assigned operator may start an accepted mission' using errcode='42501'; end if;
  insert into public.drone_audit_logs(mission_id, actor_id, event_type)
  values (p_mission_id, v_uid, 'mission.active');
  return v_row;
end; $$;

revoke all on function public.accept_drone_mission(uuid,uuid) from public, anon;
revoke all on function public.start_drone_mission(uuid) from public, anon;
grant execute on function public.accept_drone_mission(uuid,uuid) to authenticated;
grant execute on function public.start_drone_mission(uuid) to authenticated;
```

그리고 §3.2·3.3을 고치기 위해 RLS update 정책은 **`accept_drone_mission`만** 통과하도록 좁힌다:

```sql
drop policy if exists drone_missions_accept_operator on public.drone_missions;
-- security definer RPC가 대신 수행하므로 클라이언트 직접 update는 막는다
revoke update on public.drone_missions from authenticated;
```

### 4.3 현장 에이전트 (`drone-agent/`) — 신규

**이것이 이 프로젝트의 핵심 신규 코드다.** 지금 `drone-agent/`에 실질 구현이 없다.

```
drone-agent/
├── package.json
├── src/
│   ├── main.ts                 # 엔트리: 연결 → 상태 게시 → 명령 루프
│   ├── config.ts               # .env 검증 (zod)
│   ├── auth.ts                 # 서비스 토큰 → Supabase 세션
│   ├── command-poller.ts       # 승인된 명령 받기 (Realtime 또는 poll)
│   ├── result-reporter.ts      # 실행 결과 기록
│   ├── heartbeat.ts            # 10초 주기 상태 → drone_vehicles.status
│   └── adapters/
│       ├── adapter.ts          # 공통 인터페이스 (= 기존 drone-agent-adapter.ts의 DroneCameraAdapter)
│       ├── mavlink.ts          # MAVSDK 연동
│       └── dji.ts              # DJI 현장 앱이 보내는 결과 수신 (프로세스 분리)
└── tests/
```

**공통 인터페이스**는 이미 `drone-agent-adapter.ts:11-18`에 정의돼 있다. 그대로 재사용한다.

```ts
// 실행 루프의 안전 순서 — 이 순서를 바꾸지 말 것
async function tick() {
  const cmd = await pollApprovedCommand(); // 1) status='approved' AND expires_at > now()
  if (!cmd) return;
  if (Date.now() > Date.parse(cmd.expires_at)) {
    await report(cmd.id, "expired");
    return;
  } // 2) 만료 재확인
  if (!(await adapter.getCapabilities()).includes(cmd.command_type)) {
    // 3) capability 재확인
    await report(cmd.id, "unsupported");
    return;
  }
  const result = await adapter.executeCameraCommand(
    cmd.command_type,
    cmd.parameters,
  ); // 4) 실행
  await report(cmd.id, result.success ? "completed" : "failed", result); // 5) 결과
}
```

> ⚠️ **서버 승인 == 실행 권한이 아니다.** 에이전트는 만료·capability·임무 상태를 **다시** 검사한다. 이중 검증이 §8 테스트 6·7번의 근거다.

### 4.4 MAVLink 어댑터 (MAVSDK)

```bash
cd drone-agent
python3 -m venv .venv && source .venv/bin/activate
pip install mavsdk
```

```ts
// mavlink.ts (개념)
import { spawn } from "node:child_process";

// MAVSDK Python은 카메라만 제어한다. 비행 명령 API를 import하지 않는다.
export class MavlinkAdapter implements DroneCameraAdapter {
  readonly vendor = "mavlink" as const;
  constructor(private readonly url: string) {}   // 예: udp://:14540

  async getCapabilities() {
    // Camera plugin의 가능한 정보(실제 기체 펌웨어에서 조회)만 반환
    return ["camera.capture_photo", "camera.start_video", "camera.stop_video"] as const as any;
  }
  async executeCameraCommand(type, params) {
    // ⚠️ 여기에 goto/land/takeoff/속도 변경을 절대 추가하지 않는다 (MVP 차단)
    ...
  }
}
```

**MAVSDK Camera 플러그인은 MAVLink Camera Protocol을 구현한 카메라에서만 동작한다.** 기체/펌웨어별로 지원 범위가 다르므로 `getCapabilities()`는 **하드코딩하지 말고 실제 조회**해야 한다(위 예시는 구조 설명용).

### 4.5 DJI 어댑터 — 프로세스 분리 필수

DJI Mobile SDK는 **모바일 네이티브**(Android/iOS)이며 오픈소스가 아니다. Node 에이전트에서 직접 호출할 수 없다.

```
[현장 스마트폰: DJI 앱]  --영상(RTMP/RTSP)-->  [MediaMTX]
        │                                            ▲
        └--명령 결과(HTTPS + 서비스 토큰)--> [GoLive RPC] --Realtime--> [의뢰인 웹]
```

- Node 에이전트는 DJI에서 **결과만 받는다**(`dji.ts`는 HTTP 수신기).
- 지원 모델 표는 **실측 후** 문서화한다. 확인 전에는 UI에서 `DJI 호환 보장 안 함`을 표시.

### 4.6 실시간 영상 (MediaMTX)

```bash
# 개발용 (운영 그대로 적용 금지)
docker run -d --name golive-mediamtx --restart unless-stopped \
  -p 8554:8554 -p 8889:8889 -p 8189:8189/udp bluenviron/mediamtx:latest
```

**스트림 경로 규칙 (권한 격리의 핵심):**

```
/jobs/{jobId}/main     ← 현장 에이전트만 publish
/jobs/{jobId}/view     ← 의뢰인은 이 경로만 read
```

- MediaMTX `authMethod`는 `internal` + 사용자별 `permissions`로 설정. **관리 API(`/api/*`, 9997)는 `127.0.0.1` 바인딩.**
- 브라우저 재생은 **서명된 URL**(`playback_url`)을 통해서만. 현재 `drone-api.ts:180`이 이미 "공개 MediaMTX 경로를 쓰지 않는다"고 강제하고 있다 — 이 원칙 유지.

```ts
// WebRTC 재생: 기존 함수 재사용
const url = getMediaMtxWebRtcUrl(config); // drone-api.ts:232
// url이 null이면 화면은 반드시 "연결 끊김"으로 표시 (실제처럼 보이게 하지 않음)
```

### 4.7 AI 의도 해석 — 1줄 원칙

> **AI는 명령을 실행하지 않는다. 후보를 제안하고, 서버 RPC가 검증하며, 현장 조작자가 승인한다.**

```json
{
  "action": "camera.zoom",
  "parameters": { "level": 2 },
  "requiresOperatorApproval": true
}
```

LLM 출력은 **이 스키마 외에는 무시**한다. `flight.*`, `shell`, 파일 경로가 나오면 거부. `level` 같은 값은 §3.7의 zod 스키마로 재검증.

---

## 5. API 계약

### 5.1 드론 (이미 RPC로 존재 — 시그니처 고정)

| 호출                                                                 | 대상   | 검증 위치                                   |
| -------------------------------------------------------------------- | ------ | ------------------------------------------- |
| `request_drone_camera_command(mission_id, type, params, request_id)` | 테이블 | RPC (멱등·만료·capability) — `0002:221-301` |
| `decide_drone_camera_command(command_id, decision)`                  | 테이블 | RPC (operator만) — `0002:302-343`           |
| `accept_drone_mission(mission_id, vehicle_id)`                       | 테이블 | **신규 §4.2**                               |
| `start_drone_mission(mission_id)`                                    | 테이블 | **신규 §4.2**                               |

응답 표준화(에이전트 결과 보고):

```json
{
  "commandId": "...",
  "status": "completed",
  "result": { "mediaId": "...", "completedAt": "..." }
}
```

**서버는 클라이언트가 보낸 `status`, `operator_id`, `actor_id`를 신뢰하지 않는다.** 신원은 항상 세션에서 파생.

### 5.2 글라스 (기존 REST)

| 메서드   | 경로                                  | 상태                                 |
| -------- | ------------------------------------- | ------------------------------------ |
| `POST`   | `/smartglass/tasks`                   | 있음                                 |
| `POST`   | `/smartglass/tasks/:id/accept`        | 있음 — **경쟁 조건 수정 필요(§3.6)** |
| `POST`   | `/smartglass/tasks/:id/events`        | 있음 — **멱등성 추가 필요(§3.5)**    |
| `POST`   | `/smartglass/tasks/:id/consent`       | 있음                                 |
| `POST`   | `/smartglass/tasks/:id/video-session` | 있음                                 |
| **신규** | `POST`                                | `/smartglass/tasks/:id/commands`     |

**글라스에 없는 것: 명령 승인 흐름.** 드론 RPC(`request_*` / `decide_*`)를 그대로 복제하면 된다. 이게 §2의 통합 근거이기도 하다.

---

## 6. 데이터 구조 요약

| 테이블             | 용도                        | RLS 핵심                              |
| ------------------ | --------------------------- | ------------------------------------- |
| `drone_vehicles`   | 기체·capability·온라인 상태 | 소유자 또는 임무 참여자만 read        |
| `drone_missions`   | 의뢰                        | 참여자만 read, **insert는 requester** |
| `drone_sessions`   | 스트림 경로·서명 URL·만료   | 참여자만 read                         |
| `drone_commands`   | 명령 요청                   | 참여자만 read, **쓰기는 RPC만**       |
| `drone_approvals`  | 현장 승인 기록              | 참여자만 read                         |
| `drone_audit_logs` | 전 이벤트 감사              | 참여자만 read                         |

`smartglass_tasks` + `_task_events` + `_consents` + `_video_sessions`는 동형 구조. 통합 시 `field_jobs`(§2.2)로 수렴.

---

## 7. 보안·안전 원칙 (타협 불가)

1. **영상 경로와 제어 경로 분리.** 영상이 끊겼다고 제어 명령이 계속 실행되면 안 된다 → 에이전트 heartbeat가 끊기면 서버는 **신규 명령 승인을 거부**한다.
2. **서버 승인 ≠ 실행 권한.** 에이전트 재검증 필수.
3. **만료 우선.** `expires_at`(60초)을 넘긴 명령은 승인됐어도 실행하지 않는다.
4. **capability 우선.** 없으면 `unsupported`, 조용히 무시하지 않는다.
5. **비행 명령 차단.** MVP에서 `flight.*`는 코드 경로 자체가 없어야 한다(주석이 아니라 타입에서 제외).
6. **관리 API 비노출.** MediaMTX API, DB, 서비스 토큰은 공용 인터넷에 열지 않는다.
7. **감사 로그.** 요청자·승인자·결과·시각 전부 기록. `drone_audit_logs`가 이미 이 역할.
8. **지역 규제.** 베트남 등 운영 지역의 비행 허가·촬영 규정·조종 자격은 **기술과 별개로** 확인해야 한다. 플랫폼 가입이 비행 허가를 대신하지 않는다.

---

## 8. 안전 테스트 (통과 전 실제 기체 금지)

순서대로 실행. **시뮬레이터 또는 가짜 영상으로만** 진행.

| #   | 테스트                          | 기대                                     | 근거                                         |
| --- | ------------------------------- | ---------------------------------------- | -------------------------------------------- |
| 1   | 미인증 사용자가 mission read    | 거부                                     | RLS `drone_missions_read_participants`       |
| 2   | 남의 임무에 명령                | 거부                                     | RPC `0002:245-247`                           |
| 3   | `vehicle_id` 없이 카메라 명령   | 거부 (`mission has no assigned vehicle`) | `0002:250`                                   |
| 4   | 미승인 명령을 에이전트가 수신   | 수신 자체가 없어야 함                    | `status='approved'` 필터                     |
| 5   | 같은 `request_id` 2회 전송      | **명령 1개만**                           | `unique(requester_id, request_id)` `0002:99` |
| 6   | 만료 후 승인                    | 거부                                     | `decide_...` `0002:323-325`                  |
| 7   | capability 없는 명령            | `unsupported`                            | `0002:256-258`                               |
| 8   | heartbeat 끊긴 뒤 새 명령       | 승인 거부                                | §7-1 (신규 구현 필요)                        |
| 9   | `accepted` → `active` 없이 명령 | 거부                                     | `0002:248` — **현재는 항상 거부됨(§3.3)**    |
| 10  | 글라스 이벤트 재전송            | 중복 없음                                | §3.5 (수정 필요)                             |
| 11  | 두 워커 동시 수락               | 1명만 성공                               | §3.6 (수정 필요)                             |
| 12  | 영상 끊김 시 UI                 | "연결 끊김" 표시, 완료로 표시 금지       | `DroneControlPage` 상태                      |

> **현재 통과 불가:** 9(§3.3 미구현), 10·11(§3.5·3.6 미수정), 2·4·5(RLS/RPC는 있으나 §3.2 때문에 수락 자체가 실패).
> **즉, 지금은 1·7·12만 통과 가능.** §3·§4.2 수정이 선행 조건이다.

---

## 9. 배포와 롤백

### 9.1 배포 순서 (기능 플래그 우선)

```dotenv
# .env.example (값 아님, 이름만)
DRONE_FEATURE_ENABLED=false
DRONE_AGENT_TOKEN=
DRONE_STREAM_BASE_URL=
DRONE_COMMAND_TIMEOUT_SECONDS=60
DRONE_REQUIRE_OPERATOR_APPROVAL=true
VITE_DRONE_API_BASE_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=            # ⚠️ 하드코딩 제거(§3.4), 반드시 여기서
VITE_MEDIAMTX_WEBRTC_BASE_URL=
```

1. **스테이징**: `0003_*.sql` 적용 → RPC 스모크 테스트
2. **운영 배포 (기능 OFF)**: 코드만 올리고 `DRONE_FEATURE_ENABLED=false`
3. **단계적 ON**: 내부 1명 → 제공자 1명 → 초대 의뢰인. **MAVLink와 DJI는 따로 검증**
4. **에이전트 상주**: systemd (아래)

```ini
# /etc/systemd/system/golive-drone-agent.service
[Unit]
Description=GoLive Drone Field Agent
After=network-online.target
[Service]
Type=simple
User=golive-agent
WorkingDirectory=/opt/golive-agent/app
EnvironmentFile=/etc/golive-agent/agent.env
ExecStart=/usr/bin/node /opt/golive-agent/app/dist/main.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/golive-agent
[Install]
WantedBy=multi-user.target
```

### 9.2 롤백 (3단계 분리)

| 대상              | 방법                                                      | 비고                                                                 |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| **기능**          | `DRONE_FEATURE_ENABLED=false` + 에이전트 `systemctl stop` | 가장 먼저. 진행 중 임무는 **현장 조작자의 안전 절차 우선**           |
| **에이전트 코드** | 이전 검증 커밋으로 checkout 후 재시작                     |                                                                      |
| **DB**            | `0003_*.sql`은 **추가 전용**(RPC 신규 + `revoke update`)  | 롤백 시 `grant update` 복원 필요 — **이 한 줄이 유일한 파괴적 변경** |

```bash
# DB 롤백 (필요 시)
psql "$DATABASE_URL" -c "grant update on public.drone_missions to authenticated;"
drop function if exists public.accept_drone_mission(uuid,uuid);
drop function if exists public.start_drone_mission(uuid);
```

> `revoke update`를 잊고 롤백하면 기존 `acceptMission` 클라이언트 경로가 되살아나 §3.2 버그가 다시 열린다. 롤백 체크리스트에 반드시 포함.

---

## 10. 작업 순서와 완료 기준

| 단계 | 작업                             | 완료 기준                 | 현재       |
| ---- | -------------------------------- | ------------------------- | ---------- |
| 0    | §3.2·3.3·3.5·3.6 수정            | 테스트 2·5·9·10·11 통과   | ❌ 미착수  |
| 1    | `accept/start` RPC (§4.2)        | 수락→active 전이 성공     | ❌         |
| 2    | 에이전트 골격 + heartbeat (§4.3) | 연결 끊김 감지            | ❌         |
| 3    | MediaMTX + 가짜 영상             | 브라우저 재생             | ❌         |
| 4    | MAVLink 어댑터 (SITL)            | capability 조회·사진 촬영 | ❌         |
| 5    | 승인 흐름 E2E                    | 테스트 4·6·8 통과         | ❌         |
| 6    | 글라스 명령 API (드론 RPC 복제)  | 글라스 OCR 명령 승인      | ❌         |
| 7    | AI 의도 해석                     | 화이트리스트 외 거부      | ❌         |
| 8    | DJI 앱 연동                      | **지원 모델 확정 후**     | ❌         |
| 9    | `field_jobs` 통합 (§2)           | 기존 화면 회귀 없음       | 보류(권장) |

---

## 11. 이 문서가 보장하지 않는 것

- **DJI 지원 범위**: 모델·펌웨어·SDK 버전별 확인 전까지 미보장.
- **MAVLink 기체 호환성**: Camera Protocol 미구현 기체는 `camera.*` 명령이 `unsupported`.
- **지연(latency)**: "브라우저에서 재생됨"은 "관제에 충분히 낮은 지연"을 의미하지 않는다. 별도 측정 필요.
- **규제 준수**: 비행 허가·촬영 동의·조종 자격은 지역별 확인 사항.
- **운영 검증**: 이 문서는 코드/스키마를 읽고 쓴 설계다. **빌드·배포·실기체 테스트 결과가 아니다.**

---

## 부록 A. 이 저장소에서 확인한 사실 (근거)

```text
DRONE-CONTROL-CODE-PLAN.md:28-31   MVP 비목표: 비행 명령·AI 직접 실행 차단
drone-api.ts:66                    Supabase anon key 하드코딩
drone-api.ts:180-182               서명된 playback_url 없으면 거부
drone-api.ts:164-168               acceptMission에 operator_id/vehicle_id 없음  ← §3.2
drone-api.ts:232-238               MediaMTX 경로 검증 후 URL 생성
drone-agent-adapter.ts:11-18       DroneCameraAdapter 인터페이스 (재사용)
0002_drone_control.sql:99          unique(requester_id, request_id) — 멱등성
0002_drone_control.sql:147-149     accept 정책이 operator_id를 요구 → 클라이언트 쿼리 불일치
0002_drone_control.sql:248         명령 요구 status='active'
0002_drone_control.sql:256-258     capability/online 검증
0002_drone_control.sql:302-343     승인 RPC: operator만, 만료 검증
golive-smartglass/server/src/index.ts:120-131  수락 경쟁 조건  ← §3.6
golive-smartglass/server/src/postgres-store.ts:64-70  이벤트 무조건 insert ← §3.5
```

## 부록 B. 다음 한 걸음

§3의 네 가지 결함(3.2·3.3·3.5·3.6)을 고치는 것부터 시작하세요. 이건 **하드웨어 없이 지금 바로** 테스트 가능하고, 통과해야 §4의 에이전트가 의미를 갖습니다.

하드웨어가 필요한 첫 단계는 **PX4 SITL 시뮬레이터 + MAVSDK**입니다(실기체 아님). SITL에서 capability 조회와 사진 촬영까지 통과한 뒤에 실기체를 고려하세요.


---

## 부록 C. 실측 검증 결과 (2026-10-24 추가)

> 이 절은 설계가 아니라 **실행 결과**다. Postgres 15.19 로컬 인스턴스에서 검증했다.
> DadaBot 관련 항목은 이번 범위에서 제외했다(사용자 요청).

### C.1 글라스 서버 — 실제 Postgres 경로 전부 통과

`server/db/schema.sql`을 실제 Postgres에 적용하고 앱을 `DATABASE_URL`로 연결했다.

```
health     200  {"ok":true,"store":"postgres"}      ← memory 아님
create     201
concurrent accept: 200 409   → winner: worker-1     ← §3.6 경쟁 조건 해결 확인
idempotent: 201 201  sameId: true                   ← §3.5 멱등성 확인
event count: 4
```

**적용된 테이블:** `smartglass_tasks`, `smartglass_task_events`, `smartglass_consents`, `smartglass_video_sessions` + `client_event_id` 부분 유니크 인덱스.

### C.2 드론 스키마 — 0002·0003 적용 및 상태 전이 확인

로컬 Postgres에 `auth.uid()`·`anon`·`authenticated` role·`supabase_realtime` publication을 최소 재현한 뒤 적용했다.

| 검증 | 결과 |
|---|---|
| `0002_drone_control.sql` 적용 | ✅ 테이블 6개 생성 |
| `0003_mission_lifecycle.sql` 적용 | ✅ RPC 4개 존재 |
| `authenticated`의 UPDATE 권한 | ✅ `false` (0003의 revoke 적용됨) |
| **`requested → accepted`** | ✅ `accept_drone_mission` → `accepted`, `operator_id`·`vehicle_id` 설정 |
| **`accepted → active`** | ✅ `start_drone_mission` → `active` |

```
step   | status
-------+---------
accept | accepted
start  | active
```

> **§3.2·§3.3 결함이 실제로 해소됐다.** 이제 `request_drone_camera_command`가 요구하는
> `status = 'active'`에 도달 가능하며, `vehicle_id`도 수락 시 함께 설정된다.

**단, 검증하지 못한 것:** RLS 정책 자체(`auth.uid()`를 실제 JWT로부터 주입하는 경로)는
로컬에서 함수만 재정의했으므로, **실제 Supabase JWT로는 미검증**이다.

### C.3 빌드 상태

```
tsc --noEmit          exit 0
npm run build         성공 (336.2KB → 300.0KB)
```

`js/supabase-client.js` minify 경고는 ES module 구문 때문이며 기존 동작과 동일하다(무해).
