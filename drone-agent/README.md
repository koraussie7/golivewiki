# GoLive Drone Field Agent

카메라 전용 현장 에이전트. 서버가 승인한 **사진 촬영·녹화·줌**만 실행하며,
**이착륙·이동·고도·속도 변경은 코드에 존재하지 않습니다.**

---

## 1. 무엇이 구현되었고 무엇이 없는가

| 항목 | 상태 |
|---|---|
| 명령 계약 (`camera.*` 4종, zod 검증) | ✅ 구현 |
| 에이전트 루프 (폴링·재검증·보고) | ✅ 구현 |
| 시뮬레이션 어댑터 | ✅ 구현 (테스트용) |
| **MAVSDK 브리지** (Python) | ✅ 구현 — **SITL 미검증** |
| DJI 어댑터 | ❌ **없음** (네이티브 앱 필요) |
| MediaMTX 영상 게시 | ❌ **없음** |
| 실기체 테스트 | ❌ **없음** |

> 이 문서에서 "구현"은 코드가 있다는 뜻이며, 실기체에서 동작한다는 뜻이 아닙니다.

---

## 2. 안전 경계

### 2.1 비행 명령이 표현 불가능합니다

```js
// command-contract.mjs
export const CAMERA_COMMANDS = [
  "camera.capture_photo",
  "camera.start_video",
  "camera.stop_video",
  "camera.zoom",
];
```

`flight.goto`, `action.arm`, `flight.takeoff` 같은 값은 **타입에 없으므로**
`validateCommand()`가 `MALFORMED`로 거부합니다. 주석이 아니라 **구조**로 막습니다.

### 2.2 실행 직전 5단계 재검증

서버가 `approved`로 표시했더라도 다음을 **에이전트가 다시 확인**합니다.

| 순서 | 검사 | 실패 시 |
|---|---|---|
| 1 | zod 스키마 (status=`approved` 포함) | `MALFORMED` |
| 2 | 같은 미션인가 | `WRONG_MISSION` |
| 3 | 만료되지 않았나 | `EXPIRED` |
| 4 | 기체가 capability를 보고하나 | `UNSUPPORTED` |
| 5 | 파라미터 (zoom 1~5) | `BAD_PARAMETERS` |

**이유:** 서버가 손상되거나 오래된 승인을 재전송해도 물리적 동작으로 이어지면 안 됩니다.

### 2.3 중복 실행 방지

```js
if (this.executed.has(raw.id)) continue;  // 폴링이 같은 명령을 반복해도 1회
```

### 2.4 Python 브리지도 카메라만

`mavsdk_bridge.py`는 `mavsdk.Camera`만 import합니다. `Action`, 오프보드, 위치 제어 코드는
**없습니다.** 프로세스 경계 양쪽에서 각각 강제합니다.

---

## 3. 실행

### 3.1 시뮬레이션 (하드웨어 불필요)

```bash
cd drone-agent
npm install
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
node src/index.mjs --mission <uuid> --simulate
```

### 3.2 PX4 SITL

```bash
# 1) PX4 SITL 기동 (별도 터미널)
cd ~/PX4-Autopilot && make px4_sitl gz_x500

# 2) Python 의존성
python3 -m venv .venv && source .venv/bin/activate
pip install mavsdk

# 3) 에이전트
node src/index.mjs --mission <uuid> --url udp://:14540
```

> **미검증:** SITL에서의 실제 연결은 시도하지 않았습니다.
> PX4가 없어 `connect` 단계까지만 코드로 작성했습니다.

### 3.3 테스트

```bash
npm test   # 15개, 하드웨어 불필요
```

---

## 4. 환경 변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `SUPABASE_URL` | ✅ | 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **서버 전용**. 브라우저 금지 |
| `AGENT_MISSION_ID` 또는 `--mission` | ✅ | 이 현장이 담당하는 임무 |
| `AGENT_POLL_MS` | — | 폴링 주기 (기본 2000) |

**누락 시 프로세스가 즉시 종료합니다.** (`golive-smartglass`의 `env.ts`와 같은 정책)

---

## 5. 서버 API 계약

에이전트는 **기존 테이블만** 사용합니다. 새 엔드포인트를 만들지 않습니다.

| 호출 | 대상 | 근거 |
|---|---|---|
| 승인된 명령 조회 | `drone_commands` where `status='approved'` | 0002 |
| 결과 기록 | `drone_commands` update + `drone_audit_logs` insert | 0002 |
| 생존 신고 | `drone_audit_logs` (`agent.heartbeat`) | 0002 |

> ⚠️ **heartbeat가 `drone_audit_logs`에 insert됩니다.** 이는 임시 구현이며,
> 빈번한 폴링에 감사 로그가 커집니다. **별도 테이블(`drone_agent_status`)로 옮기는 것을 권장합니다.**

---

## 6. 테스트 결과

```
ℹ tests 15
ℹ pass 15
ℹ fail 0
```

검증 항목:

- 승인된 사진 명령 실행 ✅
- 다른 미션의 명령 거부 ✅
- 만료된 명령 거부 (서버가 approved라도) ✅
- zoom 미지원 기체에서 거부 ✅
- **비행 명령 5종 전부 `MALFORMED`** ✅
- zoom level 0·6·-1·2.5 거부 ✅
- **같은 명령 2회 폴링해도 1회 실행** ✅
- 거부 시 어댑터에 **도달하지 않음** ✅
- 하드웨어 실패 → `failed` (완료 아님) ✅
- 보고 실패해도 루프 지속 ✅
- 미연결 어댑터는 아무것도 실행 안 함 ✅

---

## 7. 하지 않은 것 (정직하게)

| 항목 | 이유 |
|---|---|
| **SITL 실행 검증** | PX4 미설치. `connect` 코드 경로만 작성 |
| **실기체** | 없음 |
| **DJI** | SDK가 오픈소스 아님, 네이티브 앱 필요 |
| **MediaMTX 영상 게시** | 별도 작업. 현재 영상 경로 없음 |
| **`drone_vehicles.status` 갱신** | heartbeat가 audit_logs로만 감 |
| **명령 승인 후 알림** | 폴링만. push 없음 |

---

## 8. 다음 작업

1. **SITL에서 실제 연결 검증** — `udp://:14540` 연결, `get_capabilities()` 응답 확인
2. **heartbeat를 별도 테이블로** — audit_logs 오염 방지
3. **MediaMTX 게시 경로** — `/jobs/{missionId}/main` publish
4. **DJI 어댑터** — 지원 모델 확정 후

---

## 부록: 이 저장소의 경계 (기존 README 보존)

이전 문서 `README.integration-boundary.md`는 **웹 저장소가 드라이버를 포함하지 않는다**는
원칙을 설명합니다. 이번 구현은 그 원칙을 지키되 **실행 가능한 에이전트**를 추가했습니다.
