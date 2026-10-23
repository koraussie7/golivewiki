# GoLive Drone Control — 코드 구현 계획
> **대상:** `golive.wiki` 웹 클라이언트 및 기존 GoLive 백엔드에 추가할 드론 관제 MVP  
> **상태:** 구현 전 계획서  
> **작성일:** 2026-10-23  
> **안전 범위:** 실시간 영상·임무·현장 에이전트 연결·승인된 카메라 명령만 다룬다. 실제 비행 제어는 범위에서 제외한다.

## 1. 먼저 확인한 현재 저장소 기준
이 작업공간은 현재 **Vite 기반 정적 HTML 다중 페이지 앱**이며, 드론 관제 화면만 React/TypeScript로 추가하는 점진적 전환을 목표로 한다.

- `package.json`: Vite 기반, `npm run build`로 빌드
- `vite.config.js`: 기존 HTML 페이지를 `rollupOptions.input`에 명시 등록
- 기존 화면: 루트의 `index.html`, `screens-*.html`과 공용 `styles/`
- 다국어: `styles/i18n.js`가 7개 언어 사전을 관리
- 이 작업공간에는 GoLive 서버/API, 데이터베이스 스키마, DJI 현장 앱 또는 MAVSDK 에이전트 코드가 없다.

기존 정적 페이지를 보존하고 새 `drone.html` 엔트리만 React/TypeScript로 구현한다. 공용 내비게이션/i18n과의 연결은 기존 글로벌 스크립트를 재사용하는 범위로 제한한다. 백엔드는 현재 운영 중인 GoLive API의 인증·DB 규칙을 확인한 뒤 별도 변경으로 연결한다. 아래 경로는 **제안 경로**이며, 구현 전 운영 백엔드 저장소와 실제 로그인/API 규약을 확인해야 한다.

## 2. MVP 목표와 명시적 비목표
### MVP 목표
1. 드론 관제 의뢰를 만들고 임무 상태를 확인한다.
2. 제공자/현장 조종자가 임무를 수락하고 인증된 현장 에이전트를 연결한다.
3. MediaMTX로 전달된 테스트 또는 현장 영상을 임무 권한에 따라 재생한다.
4. 사진 촬영·녹화 시작/종료·지원되는 줌 등 허용된 카메라 요청을 제출한다.
5. 요청→권한/기능 검증→현장 승인→어댑터 실행→결과 및 감사 로그의 흐름을 제공한다.
6. MAVLink와 DJI는 공통 카메라 기능 모델을 공유하되, 별도 어댑터로 독립 구현·검증한다.

### MVP 비목표 / 안전 차단
- 이착륙, 이동, 경로/고도/속도 변경 등 **비행 명령을 만들거나 전송하지 않는다**.
- AI가 명령을 직접 실행하지 않는다. 추후 도입하더라도 허용된 카메라 의도만 제안하고 정책 검증·현장 승인을 거친다.
- 연결되지 않은 기체·영상·상태를 실제처럼 표시하지 않는다. 데모 데이터는 `시뮬레이션`으로 분명히 표기한다.
- DJI SDK가 지원하는 모델·기능을 확인하기 전에는 DJI 호환을 보장하지 않는다.

## 3. 목표 아키텍처
```text
GoLive React/TypeScript 관제 화면 (Vite MPA의 새 drone.html 엔트리)
  ├─ HTTPS 임무 API ── 인증/권한/상태/DB/감사 로그
  ├─ 임무 권한이 부여된 WebSocket ── 상태/명령 승인/결과 이벤트
  └─ 임무별 권한이 부여된 WebRTC 재생 ── MediaMTX
현장 에이전트 (별도 실행 환경)
  ├─ 인증된 WebSocket 연결 및 명령 만료/임무/승인 재검증
  ├─ 공통 DroneCameraAdapter 인터페이스
  │    ├─ MAVSDK 어댑터 (MAVLink 기체/카메라)
  │    └─ DJI Mobile SDK 현장 앱 어댑터 (지원 모델 한정)
  └─ 영상 게시 ── MediaMTX
```

GoLive 서버는 영상 미디어 패킷을 프록시하지 않는다. 임무·인증·정책·명령 상태만 처리하고, 영상은 권한이 설정된 MediaMTX 경로 전달한다. MediaMTX 관리 API와 DB는 공용 인터넷에 노출하지 않는다.

## 4. 저장소에 추가할 웹 클라이언트 파일
| 경로 | 변경 | 책임 |
|---|---|---|
| `drone.html` | 신규 | React 마운트 지점이자 Vite MPA 엔트리; 기존 전역 nav/i18n 스크립트와 공존 |
| `src/main.tsx` | 신규 | `createRoot`로 관제 앱 마운트 및 오류 경계 연결 |
| `src/features/drone/DroneControlPage.tsx` | 신규 | 임무 화면 조합 및 페이지 상태 |
| `src/features/drone/components/` | 신규 | MissionSummary, LiveVideo, CameraControls, ApprovalQueue, MissionLog 등 |
| `src/features/drone/api/drone-api.ts` | 신규 | 타입 지정 API 클라이언트, 인증·오류·요청 취소 처리 |
| `src/features/drone/hooks/` | 신규 | 임무 조회 및 임무별 WebSocket 상태 수명주기 |
| `src/features/drone/types/drone.ts` | 신규 | 임무·기체 capability·명령·이벤트의 판별 유니온 타입 |
| `src/features/drone/styles/drone-control.css` | 신규 | 화면 범위 스타일; 기존 디자인 토큰 사용 |
| `vite.config.js` | 수정 | `drone.html`을 MPA 입력에 추가하고 React 플러그인 연결 |
| `package.json` / lockfile | 수정 | React, React DOM, TypeScript, Vite React 플러그인 및 typecheck 명령 추가 |
| `tsconfig.json` | 신규 | `src/**/*.ts(x)` 형식 검사; 기존 레거시 JS 페이지는 범위 밖 |
| `index.html` | 수정(선택) | 기존 내비게이션에 `드론 관제` 링크 추가; 제품/권한 정책 확정 후 |
| `styles/i18n.js` | 수정(선택) | 기존 공용 메뉴 문자열만 연동. 신규 앱 문자열은 typed message map으로 별도 관리 |

기존 HTML 페이지는 유지하고 신규 관제 화면만 React/TypeScript로 작성한다. 라우터 없이 현재 Vite MPA 구조를 유지해 의존성과 회귀 위험을 줄인다. 앱 상태는 우선 React hooks와 명시적 타입으로 관리하고, 요구가 확인되기 전에는 별도 상태관리 라이브러리를 추가하지 않는다.

### 관제 화면 구성
- **상단 요약:** 임무 상태, 현장 에이전트 연결 여부, 마지막 연결 시각, `실제 연결`/`시뮬레이션` 배지
- **임무 요청:** 위치/관심 영역 설명, 일정, 지원 기체/카메라 작업 표시
- **영상:** WebRTC 재생 영역과 연결 중/연결 끊김/재연결 중/권한 없음 상태
- **카메라 작업:** 사진 촬영, 영상 녹화 시작·종료, capability가 있는 경우에 한해 줌. 승인 전에는 실행 완료로 표시하지 않음
- **현장 승인:** 대기 중 명령의 작업명·요청자·만료 시각과 승인/거절 동작 (운영자 권한에서만 표시)
- **임무 로그:** 요청, 승인/거절, 실행 결과, 에이전트/영상 연결 이벤트와 타임스탬프
- **안전 상태:** 지원되지 않는 기능, 임무 종료, 에이전트 오프라인, 명령 만료 시 명령 버튼 비활성화 및 이유 표시
## 5. 백엔드/API 구현 계획 (기존 서버 저장소에서 수행)

### API 계약 초안
실제 경로·응답 봉투·인증 방식은 현재 서버 규약에 맞춰 확정한다.

| 메서드 | 경로 제안 | 목적 |
|---|---|---|
| `GET` | `/api/drone/capabilities` | 사용자에게 허용된 기체/기능 요약 |
| `POST` | `/api/drone/missions` | 의뢰 생성 |
| `GET` | `/api/drone/missions/:missionId` | 임무 상세 및 권한 검증 |
| `POST` | `/api/drone/missions/:missionId/accept` | 제공자 수락 |
| `POST` | `/api/drone/missions/:missionId/sessions` | 권한 제한된 영상 세션 발급 |
| `POST` | `/api/drone/missions/:missionId/commands` | 카메라 명령 요청 및 승인 대기 생성 |
| `POST` | `/api/drone/commands/:commandId/approve` | 인증된 현장 운영자 승인 |
| `POST` | `/api/drone/commands/:commandId/reject` | 인증된 현장 운영자 거절 |
| `GET` | `/api/drone/missions/:missionId/events` | 임무 권한으로 감사 이벤트 조회 |
| `WS` | `/api/drone/missions/:missionId/live` | 상태·승인 요청·결과 이벤트 |

### 모델 및 상태 전이
`drone_vehicles`, `drone_missions`, `drone_sessions`, `drone_commands`, `drone_approvals`, `drone_audit_logs`를 기존 DB의 마이그레이션 관례에 따라 추가한다. JSON capability는 실제 SDK/기체에서 확인한 기능만 포함한다. 기존 사용자 테이블과 사용자 ID를 재사용하며 중복 계정 체계를 만들지 않는다.

임무 상태 예: `requested → accepted → active → completed | cancelled | failed`.
명령 상태 예: `pending_approval → approved → executing → completed | failed`, 또는 `rejected | expired | unsupported`.

상태 변경은 서버에서만 수행한다. 브라우저나 에이전트가 임의로 보낸 `status`, `operatorId`, 승인자 ID를 신뢰하지 않는다. 모든 전이는 허용된 이전 상태, 사용자 권한, 임무 활성 여부를 검사하고 감사 로그를 원자적으로 기록한다.

### 카메라 명령 스키마
```json
{
  "commandType": "camera.capture_photo",
  "parameters": {},
  "requestId": "client-generated-id"
}
```

서버가 command ID, 상태, 만료 시각과 임무 범위를 발급한다. `requestId`에는 DB unique 제약 또는 동등한 idempotency 처리를 적용한다. 허용 명령은 명시적 allowlist로 관리하고 비행 관련 명령 타입은 등록하지 않는다. 줌 값은 공통 추상 수준에서 기체별 capability 범위로 변환하며 실제 배율로 오인시키지 않는다.

## 6. 현장 에이전트 및 영상 구현
에이전트는 브라우저와 별도 프로세스/모바일 앱으로 운영한다. 공통 인터페이스는 capability 조회, 상태 조회, 사진 촬영, 녹화 시작/종료, 선택적 줌을 정의한다. 두 어댑터는 같은 인터페이스를 구현하되, 기능 미지원은 성공으로 위장하지 않고 `unsupported` 결과를 반환한다.

1. **시뮬레이터:** 가짜 에이전트로 인증 연결, 명령 승인, 중복 요청 방지, timeout 및 재연결을 검증한다. 화면에 시뮬레이션임을 항상 표시한다.
2. **MAVSDK:** 시뮬레이터/SITL 우선 연결. 기체·카메라별 Camera Protocol과 각 작업 지원 여부, 연결 종료를 검증한다. MVP에서 비행 API는 호출하지 않는다.
3. **DJI:** SDK 약관, OS/SDK 버전 및 대상 모델을 확정한 뒤 별도 현장 앱을 구현한다. 영상 전달 및 각 카메라 기능을 지원 모델별 테스트하고 MAVSDK 코드를 재사용하지 않는다.
4. **MediaMTX:** 로컬 테스트 스트림부터 시작한다. 운영에서는 스트림별 게시/재생 인증, TLS, ICE/NAT 및 필요 시 TURN을 검증한다. 스트림 경로는 서버가 임무에 바인딩해 발급한다.

에이전트는 승인된 명령만 수행하기 직전에 다시 검증한다: 서명/인증된 서버 출처, 임무 활성 상태, 만료 시간, command ID 중복, capability 일치, 승인 상태. 연결이 끊기거나 검증에 실패하면 fail-closed로 거부한다.

## 7. 단계별 코드 작업 및 완료 조건
### Phase 0 — 기존 서비스 계약 확인
- 현재 GoLive 백엔드 저장소, 로그인/세션 전달 방식, API 응답 규약, DB/마이그레이션 도구를 확인한다.
- 웹 클라이언트의 운영 API 주소·CORS·CSP·배포 경로를 확인한다.
- 우선 지원 MAVLink 기체/카메라, DJI 모델·SDK·현장 모바일 OS를 선정한다.
- **완료:** API/권한 주체와 데이터 마이그레이션 위치가 문서화되고, 지원 기체별 capability 범위가 합의됨.

### Phase 1 — React/TypeScript 관제 UI 및 목 데이터
- React/React DOM, TypeScript 및 Vite React 플러그인을 추가하고 `drone.html`을 MPA 입력으로 등록한다. 기존 정적 페이지와 빌드 산출물은 유지한다.
- `src/features/drone/` 아래 화면/컴포넌트/API 타입을 분리하고, `tsconfig.json`과 `npm run typecheck`를 추가한다.
- 의뢰/영상/연결 상태/카메라 작업/로그 UI를 typed mock 데이터로 구현한다. mock 상태와 실제 연결 상태를 별도 타입/배지로 구분한다.
- 버튼은 시뮬레이터에만 연결하거나 비활성 상태로 둔다. UI에서 비행 제어는 제공하지 않는다.
- **완료:** 기존 전체 빌드 통과, TypeScript 검사 통과, 모바일/데스크톱 레이아웃 및 offline/unsupported/expired 상태 확인, mock 모드가 명확히 표시됨.

### Phase 2 — 임무 API와 권한
- 기존 로그인/RBAC를 재사용해 마이그레이션·임무 API·상태 전이·감사 로그를 추가한다.
- 임무 소유자/의뢰인/운영자 권한 검증과 idempotency를 구현한다.
- 기능 플래그 `DRONE_FEATURE_ENABLED=false`를 기본값으로 적용한다.
- **완료:** 인증 누락·타 임무 접근·잘못된 전이·중복 요청 테스트가 통과.

### Phase 3 — WebSocket과 시뮬레이터 에이전트
- 임무 범위로 제한된 WebSocket 인증, heartbeat, reconnect, 만료 명령 처리를 구현한다.
- 테스트 에이전트에서 상태 이벤트와 승인 후 카메라 작업 결과를 모의 전달한다.
- **완료:** 승인 전 실행이 불가능하고, 중복/만료/임무 종료/연결 끊김 케이스가 거부되며 로그가 기록됨.

### Phase 4 — MediaMTX 영상
- 로컬 테스트 영상 게시와 브라우저 재생을 연결하고, UI의 연결 상태를 동기화한다.
- 임무별 재생 권한과 스트림 경로 발급을 적용한다. 관리 API는 내부 전용.
- **완료:** 무권한 재생 거부, 재연결 표시, 네트워크 종료/복구, 지연·동시 시청 측정이 확인됨.

### Phase 5 — MAVSDK 어댑터와 DJI 독립 검증
- MAVLink는 SITL 및 지정 장비에서 지원 기능 조회와 카메라 작업만 시험한다.
- DJI는 선정된 지원 모델의 현장 앱·SDK로 영상과 기능을 별도로 검증한다.
- 실제 장치 실험은 승인된 장소·안전 절차를 전제로 하며 비행 제어는 계속 비활성화한다.
- **완료:** 모델/펌웨어/SDK별 테스트 결과와 지원 capability 목록이 기록됨.

### Phase 6 — 스테이징, 제한 공개, 롤백
- 기능 비활성 상태로 먼저 배포하고 테스트 계정에서 가짜 영상/에이전트를 검증한다.
- 내부 사용자 → 단일 현장 제공자 → 초대된 의뢰인 순으로 활성화한다.
- 지표/경보, 명령 중단 기능, DB 백업 및 코드 롤백 절차를 점검한다.
- **완료:** 운영 승인, feature flag 즉시 차단, 검증된 이전 릴리스로 복구가 재현됨.

## 8. 보안·안전 필수 테스트
- 미인증 사용자 및 타 임무 사용자의 API/영상/WebSocket 접근이 거부된다.
- 요청자/승인자 식별 정보는 인증 세션으로 결정되며 클라이언트 입력으로 덮어쓸 수 없다.
- 등록되지 않았거나 타 임무에 속한 스트림에 게시·재생할 수 없다.
- capability가 없는 작업, 비행 명령, 잘못된 파라미터는 거부된다.
- 동일 `requestId`는 명령을 중복 실행하지 않는다.
- 현장 승인 전, 명령 만료 후, 임무 종료 후, 에이전트 오프라인 시 실행되지 않는다.
- 영상 단절/복구가 UI에 표시되고, 오류가 연결 상태와 구별된다.
- 각 명령의 요청자·승인자·파라미터·결과·시각이 감사 기록에 남는다.
- 비밀 토큰은 저장소/브라우저 번들/로그에 노출되지 않고, 에이전트 토큰은 회전·폐기 가능하다.

## 9. 배포 설정 초안
비밀 값은 운영 비밀 저장소에 두고 `.env.example`에는 값 없는 키만 둔다.

```dotenv
DRONE_FEATURE_ENABLED=false
DRONE_STREAM_BASE_URL=
DRONE_COMMAND_TIMEOUT_SECONDS=10
DRONE_REQUIRE_OPERATOR_APPROVAL=true
```

`DRONE_AGENT_TOKEN`을 공용 단일 토큰으로 사용하지 않는다. 에이전트별·환경별 자격증명을 발급하고, 필요하면 짧은 수명의 세션 토큰으로 교환한다. 영상 URL도 장기 공개 URL 대신 임무 권한이 있는 짧은 수명 토큰 또는 서버 발급 접근 권한을 사용한다.

## 10. 이 저장소에서의 다음 구현 단위
코드 작업을 시작할 때는 아래 순서를 따른다.

1. 운영 백엔드 저장소와 인증/API/DB 규약 확인 (현재 작업공간 외부 의존).
2. React/TypeScript 의존성·타입 검사 설정과 `drone.html` Vite MPA 엔트리를 추가하되 기존 정적 페이지 빌드/동작을 보존.
3. `src/features/drone/`에 typed mock 관제 화면을 만들고, 기존 스타일/i18n 정책에 맞춰 메뉴 진입점을 선택적으로 연결.
4. 기존 build + 신규 typecheck를 검증하고, 실제 API 계약 확정 후 fetch/WebSocket/영상 연결을 단계별 구현.

이 문서는 설계 및 구현 계획이며, 드론 UI/API/DB/에이전트/MediaMTX가 이미 구현·배포되었다는 의미가 아니다. 본 저장소 변경은 계획 문서 수정에 한정한다.
