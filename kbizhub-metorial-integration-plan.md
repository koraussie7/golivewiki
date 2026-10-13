# KBizHub × Metorial 통합 실행 계획

> 작성일: 2026-10-13 · 기준: kbizhub.com 랜딩 전문 + Metorial README/self-hosting.md 원문

---

## 1. 통합 목표와 범위

### 1.1 왜 Metorial인가 (한 줄)

KBizHub는 이미 **"외부 AI가 내 사업의 예약·결제·재고를 직접 호출"**하겠다 약속했다. 그런데 그 약속 뒤에는 **수천 노드 × API 키 × 오픈 엔드포인트**라는 자격증명·감사 문제가 있고, KBizHub는 이에 대한 답이 없다. Metorial은 그걸 제품으로 갖쵄다.

### 1.2 통합 대상 (KBizHub 명시 기능 기준)

| KBizHub 컴포넌트 | 외부 자원 | 현재 언급된 연동 |
|---|---|---|
| **Reservation Agent** (₩14,900/월) | 일정·메시지 | Google Calendar, 카카오 알림톡/SMS |
| **Restaurant Agent** (₩9,900/월) | 검색·데이터 | Google Places SEO, Tripadvisor |
| **Translation Agent** (₩9,900/월) | 번역 | 다국어 실시간 통번역 |
| **SEO Agent** (₩4,900/월) | 검색 | Google/Naver 키워드, LLM Schema |
| **Business MCP** | 상거래 | 예약·주문·결제 에스크로 엔드포인트 |
| **Human Expert Escrow** | 신원·결제 | 현지 변호사/세무사 검증·정산 |
| AI CEO/Developer/Marketer/Sales/Accountant/Researcher | 각종 SaaS | (미명시) |

### 1.3 범위 외 (이번 계획 제외)

- MuhanAI P2P 메쉬 자체 (별도 계층, muhanai 콘솔 영역)
- privseai 컴패니언 연동 (별도 계획)
- Weknora RAG 파이프라인 내부 (KBizHub 고유 자산, 대체 아님)

---

## 2. 아키텍처 설계

### 2.1 삽입 위치 — 교체가 아니라 레이어 추가

```
  외부 AI 클라이언트 (ChatGPT · Claude · 여행 에이전트)
        │  MCP 호출
        ▼
┌─────────────────────────────────────────┐
│  KBizHub Business MCP Gateway           │  ← 기존 (MCP v1.0 Spec)
│  · Zero-Trust Gateway                   │
│  · Local WebAuth Tunnel                 │
│  · BYOK                                 │
└──────────────┬──────────────────────────┘
               │  ★ 신규 삽입 지점
               ▼
┌─────────────────────────────────────────┐
│  Metorial Platform (self-hosted)        │  ← 신규 컨트롤 플레인
│  · OAuth/토큰 라이프사이클              │
│  · RBAC · 스코프 권한 · SAML SSO        │
│  · 감사로그 (누가·누구 자격으로)        │
│  · 세션 녹화 · MCP Explorer             │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 Google     카카오톡     결제/에스크로
 Calendar   알림톡/SMS
  (예약)     (메시지)     (정산)
```

**핵심 설계 원칙: Metorial은 Business MCP를 대체하지 않는다.** KBizHub의 MCP 엔드포인트는 그대로 두고, 그 **뒤에서 자격증명을 대행**하는 프록시 레이어로 넣는다. KBizHub가 "MCP v1.0 Spec 완벽 지원"이라 자부하는 부분을 손대지 않는다.

### 2.2 라이선스 확인 (먼저)

| 구성요소 | 라이선스 | 비고 |
|---|---|---|
| Metorial Catalog (1200+ 통합) | **Apache 2.0** | 자유 사용 |
| Metorial Platform (엔진) | **FSL-1.1** | 2년 후 MIT로 자동 전환 |

→ FSL-1.1은 셀프호스팅·내부 사용 허용. 다만 **KBizHub가 Metorial을 고객에게 서비스로 재판매할 경우** 법률 검토 필요(§6 리스크).

---

## 3. 인프라 요구사항 (⚠️ 가장 먼저 봐야 할 것)

Metorial 공식 self-hosting.md 기준:

| 항목 | 요구사항 |
|---|---|
| 런타임 | Docker + Docker Compose |
| **RAM** | **최소 8GB** (권장 20GB+ 디스크) |
| 앱 3종 | API(Bun/TS) · Engine(Go gRPC) · Frontend(React) |
| **지원 서비스 7종** | PostgreSQL · MongoDB · Redis · Meilisearch · MinIO · OpenSearch · etcd |
| 필수 환경변수 | `SECRET`(32자↑) · `HOST` · AWS SES 키(메일 발송) |
| 노출 포트 | 앱 10개(4300·4310·4311·4313·4316·4321·50050 등) + 서비스 9개 |

### 이것이 KBizHub 비즈니스 모델과 충돌한다

KBizHub는 "₩29,000 일회성 · 평생 노드 소유 · 월 고정 구독료 없음"을 전면에 내세운다.
그런데 Metorial 풀스택은 **8GB RAM + 7개 지원 서비스 + etcd + OpenSearch**다. 이걸 **노드당(고객당)** 띄우면 ₩29,000으로 감당 불가.

**해법 — 3가지 중 택1:**

| 안 | 방식 | 평가 |
|---|---|---|
| **A. 공유 인스턴스** (권장) | Metorial 1개를 멀티테넌트로 운영, 노드별 테넌트 분리(스코프 권한·프로젝트로 격리) | 노드 증가 시 비용 선형 증가 없음 |
| B. 노드별 경량 | 메모리·예약 핵심만 Go Engine + PG/Redis 최소 구성 | 노드 적을 때만 |
| C. 호스팅 플랫폼 | platform.metorial.com 사용 | **Zero-Token 이상 훼손 → 비권장** |

**권고: 안 A.** Metorial은 "Multi-instance support"와 프로젝트/스코프 개념을 갖쵀고, "Reuse connections across projects, environments, and people"를 명시한다. 공유가 설계 의도에 맞는다.

---

## 4. 단계별 실행 계획

### Phase 0 — 검증 (1~2주)

| # | 작업 | 산출물 | 완료기준 |
|---|---|---|---|
| 0-1 | docker compose로 Metorial 로컬 기동 | 실행 로그 | 8GB 환경 전체 기동 확인 |
| 0-2 | .env 작성 (SECRET 32자↑, HOST, AWS SES) | .env | API 4310 응답, Dashboard 4300 접속 |
| 0-3 | **필수 통합 존재 확인** — Google Calendar / Google Places / Stripe 계열이 Metorial 카탈로그에 있는지 | 통합 목록 | 없으면 커스텀 빌드 분기 |
| 0-4 | **카카오 알림톡/SMS — `send-go/openapi` 래퍼 작성** | `send-go/openapi` OpenAPI 3.0.3 | ✅ **완료** — `sendgo-mcp/` MCP 서버 4도구, 스모크 19/19 + stdio 핸드셰이크 실측 통과 (`.env.example` 채우면 즉시 운영) |
| 0-5 | 🔴 **네이버 예약 공식 API 존재 확인** — smb-mcp가 IMAP 우회를 쓰는 이유가 "공식 API 부재"이므로, 파트너 API/예약 제휴 채널이 있는지 조회 | `phase0-5-naver-booking-api.md` + `zido-analysis.md` | ✅ **완료 — 공식 공개 API 없음.** 단 `m.booking.naver.com/graphql` 이 **무인증으로 응답**(실측, 대조군 검증). → **권장: 경로 A** (예약조회 MVP 제외, 알림톡 발신만으로 축소). **businessId 확보는 `zido`(MIT) 공식 지도 API로 해결 가능** — 비공식 captcha 우회 불필요 |
| 0-6 | ⚠️ **smb-mcp은 공개 MCP에서 제외** — 회색지대(IMAP 우회) + IMAP 비밀번호 평문 저장 → Zero-Trust 주장과 충돌 | 결정 기록 | 내부 운영 도구로 격리, Business MCP 엔드포인트 미노출 확정 |

**🔴 리스크 해소 — `send-go/openapi` 발견 (2026-10-13 확인)**

KBizHub 계획 작성 시 **가장 큰 미해결 리스크**였던 *"카카오 알림톡이 Metorial 카탈로그에 없다"* 가 **해결 경로가 확정**됐다.

| 항목 | 확인 결과 |
|---|---|
| 저장소 | `github.com/send-go/node` (@sendgo/node v1.6.0) — **MIT** |
| 조직 규모 | **20개 언어 SDK** (Node·Python·Go·PHP·Ruby·Java·Spring·Django·Laravel·Rails·NestJS·Fastify·Symfony·Flutter·React·Vue·.NET·ASP.NET Core·WordPress) |
| **`send-go/openapi`** | **OpenAPI 3.0.3 스펙 제공** — `openapi.yaml` 5,673줄 / **58개 엔드포인트** |
| 런타임 의존성 | **0개** (Node 18+ 내장 fetch만) — MCP 컨테이너로 감싸기 최적 |
| 지원 채널 | 카카오 알림톡 · 브랜드메시지 · **SMS/LMS/MMS** · 이메일 · 단축URL·클릭통계 · 웹훅 |

**→ 결론: 카카오 알림톡은 "커스텀 빌드 불가" 리스크가 아니라 "공식 스펙이 있으니 래핑만 하면 되는" 작업**이다.
58개 엔드포인트를 전부 노출하지 말고 **KBizHub가 쓰는 4개만** 선별 노출한다:
`/notices/send`(알림톡) · `/messages/send`(SMS/LMS/MMS) · `/short-urls`(클릭통계) · `/webhook`(발송결과 콜백).

**Phase 1-3 일정 재산정:** "+3~4주(커스텀 빌드)" → **"+1~2주(스펙 래핑)**".

⚠️ 단, `@sendgo/node`는 **SDK**이지 **MCP 서버가 아니다**. Metorial에 넣으려면 `mcp-containers`로 감싸는 래퍼 작성이 필요하며, 이것이 +1~2주의 실질 작업량이다.

⚠️ **자격증명 보안 주의 (SDK 문서 명시):**
- 토큰은 발급 후 **24시간** 유효, SDK가 50분 캐시·401 자동 재시도로 관리
- API 키 `secretKey`는 **한 번만 반환** → 서버 비밀 저장소 필수
- 허용 IP가 하나라도 등록되면 **목록 밖 IP는 차단**
- 에이전트 토큰·키를 **브라우저·모바일·로그에 넣지 말 것**

→ 이 4가지가 Metorial 대행 구조와 정확히 맞물린다. Metorial이 토큰 라이프사이클을 맡으면 SDK의 24시간 만료를 자동으로 흡수하고, 키는 Metorial 비밀 저장소에만 존재한다.

### Phase 1 — Reservation Agent 인증 이관 (3~4주) ⭐ 최우선

KBizHub에서 **돈이 오가는 연동이 가장 급하고 리스크가 크다.**

| # | 작업 |
|---|---|
| 1-1 | Metorial 인스턴스 멀티테넌트 구성 (테넌트 = KB-NODE) |
| 1-2 | Google Calendar OAuth를 KBizHub 하드코딩 → Metorial provider deployment로 이관 |
| 1-3 | 카카오 알림톡/SMS: `send-go/openapi` 기반 MCP 래퍼 연결 — **래퍼는 0-4에서 완성(`sendgo-mcp/`, 4도구)**. 여기서는 Metorial credential 대행으로 교체 | ✅ 0-4 완료 · 1-3 은 교체만 |
| 1-4 | 토큰 저장소를 KBizHub 서버(110 Node) → Metorial으로 이동 |
| 1-5 | 기존 예약 플로 회귀 테스트 (다낭 한식당 시나리오 기준) |

**검증 기준:** 기존 예약·알림 기능 동일 + 자격증명이 KBizHub 서버에 평문으로 남지 않음.

### Phase 2 — 권한·감사 (2~3주)

| # | 작업 |
|---|---|
| 2-1 | 에이전트별 스코프 권한 정의 (Reservation은 Calendar만, SEO는 검색 API만) |
| 2-2 | **감사로그 활성화** — 어떤 에이전트가 누구 자격으로 실행했는지 기록 |
| 2-3 | RBAC/IAM 부여 — 사업자·직원·전문가 역할 분리 |
| 2-4 | 세션 녹화 + MCP Explorer 디버깅 경로 확보 |
| 2-5 | **Human Expert Escrow에 감사 연결** — 전문가 승인 이력 증명 가능화 |

### Phase 3 — Business MCP 보안 노출 (2주)

| # | 작업 |
|---|---|
| 3-1 | 오픈 MCP 엔드포인트 앞에 Metorial 권한 게이트 배치 |
| 3-2 | 외부 에이전트(익명) 호출 시 레이트리밋·스코프 제한 |
| 3-3 | Agent SEO LLM Schema 노출 범위를 스코프로 통제 |
| 3-4 | 침투 시나리오 테스트 (타사 에이전트의 예약 API 악용) |

### Phase 4 — 마켓플레이스 확장 (3~4주)

| # | 작업 |
|---|---|
| 4-1 | 1200+ 통합을 Agent SKU 생성기로 활용 (₩4,900~14,900 SKU) |
| 4-2 | SDK 어댑터 선택 — KBizHub가 Claude 3.7/GPT-4o 사용 → @metorial/anthropic / @metorial/openai |
| 4-3 | Translation Agent 다국어 API를 Metorial으로 통합 |
| 4-4 | SKU 생성 비용 측정 (인증 재구현 절감 폭 정량화) |

### Phase 5 — BYOK / Zero-Token 정합성 (2주)

| # | 작업 |
|---|---|
| 5-1 | BYOK 정책과 Metorial 셀프호스팅 일치 확인 |
| 5-2 | Token-Free Gateway 라우팅이 Metorial 경유 시에도 비용 미발생 확인 |
| 5-3 | 110 Dedicated Node ↔ Metorial 인스턴스 배포 토폴로지 확정 |

---

## 5. 일정 요약

| Phase | 기간 | 누적 | 핵심 산출물 |
|---|---|---|---|
| 0 검증 | 1~2주 | 2주 | 기동 + 통합 존재 확인 |
| 1 Reservation 인증 | 3~4주 | 6주 | 자격증명 이관 완료 |
| 2 권한·감사 | 2~3주 | 9주 | 에스크로 감사 추적 |
| 3 MCP 보안 노출 | 2주 | 11주 | 오픈 엔드포인트 방어 |
| 4 마켓플레이스 | 3~4주 | 15주 | SKU 생성기 |
| 5 BYOK 정합성 | 2주 | 17주 | 이상 훼손 0 검증 |

**최소 가치 단위(MVP) = Phase 0~2 (9주).** 이 구간이 자격증명·감사 문제를 해결하며 실질 가치의 대부분이다. Phase 3~5는 그 위의 확장.

---

## 6. 리스크 & 대응

| 리스크 | 심각도 | 대응 | 담당 |
|---|---|---|---|
| ~~카카오 알림톡 등 한국 로컬 서비스가 카탈로그에 없음~~ | ~~🔴 높음~~ | **✅ 해소 (2026-10-13)** — `send-go/openapi` OpenAPI 3.0.3·58 엔드포인트 확보. 래핑 +1~2주 | 개발 |
| **네이버 예약 데이터 소스 부재** — 공식 공개 API 미공개(0-5 실측 확인). smb-mcp는 IMAP 메일 파싱 우회에 의존 | 🔴 높음 | **권장: 경로 A** — 예약조회를 MVP에서 제외하고 알림톡 발신으로 축소. 경로 B(비공식 GraphQL)는 네이버 파트너 문의 + 법무검토 필수. 참고로 GraphQL은 **비밀번호 불필요**라 IMAP보다 Metorial 충돌이 작음 | PM·법무 |
| **위치·좌표·businessId 확보 인프라 부재** | 🟠 중 | **`zido`(MIT) 도입** — Kakao/Naver/Google 공식 지도 API를 MCP + Streamable HTTP로 제공. `resolve/nearby/geocode` 로 businessId·반경 검색 해결. 단 ① 세션 registry가 process-local이라 멀티 인스턴스 시 외부 저장소 필요 ② API 키는 KBizHub 서버 보관. 상세: `zido-analysis.md` | 인프라 |

| **회색지대 커넥터 공개 시 Zero-Trust 훼손** — smb-mcp는 사업자 IMAP 비밀번호를 평문(`secrets.json`/env) 저장 | 🔴 높음 | **Phase 0-6.** Business MCP 공개 엔드포인트에서 제외, 내부 운영 도구로 격리 | 보안·법무 |
| smb-mcp 파서 포맷 취약 — 실제 네이버 메일 0건 검증, 라벨 정규식 의존 | 🟠 중 | 사용 시 실데이터 스냅샷 회귀 테스트 선행 구축 | 개발 |
| smb-mcp 전역 메모리 캐시 — 다중 사업자 환경 교차 오염 위험 | 🟠 중 | 사업자별 캐시 키 분리 또는 외부 캐시(Redis) 검토 | 개발 |
| **8GB/7서비스 인프라가 ₩29,000 모델과 안 맞음** | 🔴 높음 | 안 A(공유 멀티테넌트) 채택. 노드별 풀스택 금지 | 인프라 |
| **FSL-1.1 → 고객 재판매 시 법률 이슈** | 🟠 중 | 법무 검토. 2년 후 MIT 전환 사실 명확화 | 법무 |
| **Zero-Token / BYOK 이상 훼손** | 🟠 중 | Phase 5 전용 검증 단계로 분리 | 아키텍트 |
| **데모 상태 미검증** — 랜딩에 "Simulation Node"·"Est." 표기 | 🟠 중 | Phase 1 시작 전 실제 프로덕션 플로 확인 | PM |
| AWS SES 의존 (메일 발송 필수) | 🟡 낮 | 대체 메일 프로바이더 또는 SES 설정 | 인프라 |
| 10+ 포트 노출 → 공격면 확대 | 🟡 낮 | 리버스 프록시 뒤 배치, 내부 포트 비노출 | 보안 |

---

## 7. 즉시 실행 가능한 첫 3가지

```bash
# 1. 저장소 확보
git clone https://github.com/metorial/metorial-platform && cd metorial-platform

# 2. 사전 자원 확인 (8GB 미만이면 설계 변경 필요)
docker --version && docker compose version
sysctl hw.memsize    # macOS. Linux는 free -g

# 3. 기동 (RAM 8GB↑ 확보 후)
docker compose -f ./deployment/compose/metorial.docker-compose.yml up -d
# Dashboard: localhost:4300 · Core API: 4310 · MCP API: 4311
```

`.env` 필수 항목:

```bash
SECRET=<32자-이상-랜덤>
HOST=http://localhost
EMAIL_SES_ACCESS_KEY_ID=...
EMAIL_SES_SECRET_ACCESS_KEY=...
EMAIL_SES_REGION=us-east-1
```

**그 다음 할 일:** Dashboard → MCP Explorer에서 **Google Calendar**를 검색해 존재를 확인하라. 있으면 Phase 1 그대로 진행, 없으면 커스텀 빌드 분기로 전환.

---

## 8. 출처

- https://kbizhub.com/ (랜딩 전문 — ₩29,000 패키지, Business MCP, Agent SKU 가격, 기술 노트, 연락처)
- https://github.com/metorial/metorial-platform (README · **self-hosting.md** — 인프라 7서비스·포트·환경변수·FSL-1.1)
- https://github.com/metorial/metorial (README — 1200+ 통합, RBAC/감사/SDK, Apache 2.0)

