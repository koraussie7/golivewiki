# nworks (yjcho9317/nworks) 분석 — KBizHub 통합 후보

> 조사일: 2026-10-13 · 방법: GitHub 원문(README) + npm registry 직접 확인
> 결론: **공식 OAuth를 쓰는 LINE WORKS(네이버웍스) MCP 서버. smb-mcp의 회색지대 문제와 정반대 지점.**

---

## 0. 한 줄 요약

LINE WORKS(NAVER WORKS)를 **외부 AI 에이전트·터미널이 조작**하게 하는 MCP 서버 + CLI. 메시지·캘린더·드라이브·메일·업무·게시판·연락처·구성원을 아우르며, **LINE WORKS 공식 Developer Console OAuth**를 사용한다. 커뮤니티 유지보진 비공식이나 **API는 공식**이다.

---

## 1. 기본 정보

| 항목 | 내용 |
|---|---|
| 저장소 | `yjcho9317/nworks` |
| 정체 | LINE WORKS (NAVER WORKS)용 **MCP 서버 + CLI** |
| 도구 수 | **36 tools** (본문 기준). 단 description은 "26", 도구 표 헤더는 "MCP Tools (32)" — **README 내 수치 불일치** |
| 영역 | Messages · Calendar · Drive · Mail · Tasks · Boards · Contacts · Directory |
| 스택 | TypeScript, npm 배포 |
| 라이선스 | **Apache-2.0** (상업 사용 허용, 특허 조항 포함) |
| 성숙도 | 스타 27 · 포크 7 · 이슈 0 · `awesome-mcp-servers` 소개 |
| npm | `nworks` v1.3.1, 22개 버전, 생성 2026-03-12, **최종 2026-09-19 (활발)** |
| 인증 | User OAuth + Service Account(봇), 토큰 기반 |
| 공식성 | 도구는 비공식 커뮤니티 유지이나 **LINE WORKS 공식 API 사용**, `dev.worksmobile.com` 콘솔 필요 |

---

## 2. 왜 KBizHub에 중요한가

KBizHub Reservation Agent는 현재 **Google Calendar + 카카오 알림톡 + SMS + 결제 에스크로**를 축으로 삼는다. 그런데 **한국 SME 상당수는 이미 LINE WORKS(네이버웍스)를 사내 협업 도구로 쓴다.** nworks는 그들을 위한 **공식 API 대안**이다.

| KBizHub 니즈 | nworks가 주는 것 | 기존 대안 |
|---|---|---|
| 예약 캘린더 백엔드 | `nworks_calendar_*` (조회/생성/수정/삭제) | Google Calendar (별도 계정 필요) |
| 팀/고객 알림 발송 | `nworks_message_send` (봇 메시지) | 카카오 알림톡 (사업자 등록 + **템플릿 심사** 필요) |
| 예약 메일 수신 확인 | `nworks_mail_list/read` | smb-mcp IMAP 우회 (**회색지대**) |
| 업무·연락처 관리 | `nworks_task_*` / `nworks_contact_*` | 없음 |

→ **카카오 알림톡보다 도입 장벽이 낮다.** 알림톡은 사업자 채널 등록 + 발신프로필 + 템플릿 카카오 심사(며칠~반려 가능)가 필요한데, LINE WORKS 봇은 Developer Console 앱 + 관리자 승인 후 바로 발송 가능.

---

## 3. 공식 API라는 점이 결정적 — smb-mcp과 정반대

이전에 분석한 커넥터들과 비교하면 nworks의 위치가 명확해진다.

| 커넥터 | 데이터 경로 | 자격증명 | 법적 성격 |
|---|---|---|---|
| smb-mcp | **IMAP 메일 파싱 (우회)** | **메일 계정 비밀번호 평문** | 회색지대 (저자 자인) |
| amiro booking-mcp | **비공식 내부 GraphQL** | businessId 필요, 무인증 | 비공식 (문서 없음) |
| **nworks** | **LINE WORKS 공식 OAuth API** | **Client ID/Secret + OAuth 토큰** | **공식 계약 기반** |

→ **nworks는 "회색지대" 논쟁에서 완전히 벗어난다.** 이는 `kbizhub-metorial-integration-plan.md`의 🔴 리스크(Zero-Trust 훼손)와 직접 상쇄된다.

---

## 4. Metorial 통합 관점 — 자격증명 위임이 깔끔하다

| 항목 | 내용 | Metorial 적합성 |
|---|---|---|
| 인증 방식 | OAuth 토큰 (Client Secret + Private Key는 **env / MCP config env** 에만) | ✅ 평문 비밀번호 저장 없음 → smb-mcp 충돌 없음 |
| 토큰 관리 | `nworks logout` 이 토큰 삭제 | ✅ 라이프사이클 관리 가능 |
| 스코프 | 세분화된 OAuth scope (calendar / mail / file / task / board / contact 각 read/write 분리) | ✅ RBAC·최소권한 구현 가능 |
| 봇 메시지 | Service Account — **preset 무관하게 동작** | ⚠️ 아래 §5 주의 |

**통합 포인트:** `nworks mcp` 로 stdio 기동 → Metorial Platform 컨테이너로 래핑 → Business MCP 엔드포인트 뒤에 배치. Client Secret/Private Key는 **Metorial credential vault**가 보관, 사업자·외부 에이전트에게 비노출.

---

## 5. 리스크 & 주의

| 리스크 | 상세 | 대응 |
|---|---|---|
| 🔴 **스코프 합산(coalescing)** | README 명시: *"Re-login never narrows access — newly requested scopes are merged with the existing token"*. 한 번 넓은 권한 주면 **좁힐 수 없다** | 최초 로그인을 **readonly preset**으로 강제, 필요 시에만 명시적 확장. 재로그인으로 축소 불가하므로 초기 정책이 중요 |
| 🔴 **봇 메시지는 preset 무관** | `message send` 는 Service Account 사용 → **readonly preset에서도 발송 가능** | readonly 사업자에게는 봇 자격증명 자체를 미발급 (발송 기능 분리) |
| 🟠 **엔터프라이즈 민감 데이터** | 메일·캘린더·연락처·드라이브 전체 — SME 핵심 업무 정보 | Metorial 감사로그 필수(어떤 에이전트가 누구 자격증명으로 무엇에 접근) |
| 🟠 **도구 수 불일치** | README description "26" / 표 헤더 "32" / 본문 "36" — 문서 관리 미흡 | 실제 노출 전 `nworks mcp` `tools/list` 로 실측 확정 |
| 🟡 **비공식 유지보진** | 도구 자체는 커뮤니티 유지, LINE WORKS 비제휴 | API 변경 시 중단 리스크. 중요 경로는 폴백(카카오 알림톡) 병존 |
| 🟡 **온보딩 복잡도** | Developer Console 앱 + redirect URL + (봇 시) **관리자 승인** 필요 | ONBOARDING.md 플로우를 KBizHub 온보딩에 내재화 |
| 🟡 **토큰 저장 위치 미검증** | README는 env/MCP config만 언급, **온디스크 저장 위치·암호화 여부는 본 분석에서 미확인** | 도입 전 `~/.nworks` 등 저장 방식·암호화 실측 필요 |
| 🟢 **라이선스** | Apache-2.0 — 상업 사용·수정·재배포 허용. 특허 조항 있어 오히려 smb-mcp(MIT)보다 기업 친화 | 도입 장애물 아님 |

---

## 6. 평가 및 권고

**적합도: 높음 — 단 카카오 알림톡과 "병존"이지 "대체"가 아니다.**

**강점:**
- **공식 API** → smb-mcp의 Zero-Trust 훼손 리스크를 정면으로 해소
- **토큰 기반 OAuth** → Metorial 자격증명 위임 아키텍처와 자연스럽게 정합 (평문 비밀번호 없음)
- **한국 SME 맥락** → 이미 LINE WORKS 쓰는 가게는 새 도입 없이 연동
- **도메인 폭** → 예약 외에 메일·업무·연락처까지 → 향후 확장 동력

**약점:**
- 스코프 축소 불가 + 봇 발송 preset 무관 → **초기 권한 정책이 평생 간다**
- 엔터프라이즈 민감 데이터 다룸 → 감사로그 없이는 위험
- 비공식 유지보진 → API 변경 리스크

**권고 (Phase 0 추가 항목 제안):**

1. **카카오 알림톡 심사 전 LINE WORKS 봇을 먼저 오픈** — 알림톡 템플릿 심사(며칠~반려) 대기가 MVP 발목을 잡는다. 봇은 승인만 받으면 즉시 발송.
2. **최초 로그인 readonly 강제** — 스코프 합산 문제 때문에 초기값이 치명적. `--preset readonly`로 시작, 쓰기 필요 시 명시 확장.
3. **발송(봇)과 조회(유저 OAuth) 분리 발급** — readonly 사업자에게 봇 자격증명 주지 않음.
4. **Metorial credential vault 에 Client Secret/Private Key 보관** — 사업자·외부 에이전트 비노출 유지.
5. **폴백 병존** — LINE WORKS(주) + 카카오 알림톡(보조, 도달률 높은 고객 알림용). 둘 다 `sendgo-mcp`/nworks 로 커버.

---

## 7. 출처

- `https://github.com/yjcho9317/nworks` (README.md 원문 — 도구 목록, OAuth Scopes, Environment Variables, License)
- `https://www.npmjs.com/package/nworks` (v1.3.1, 버전 이력)
- 교차 검증: `phase0-5-naver-booking-api.md`, `smb-mcp-analysis.md`, `kbizhub-metorial-integration-plan.md`
- LINE WORKS Developer Console: `https://dev.worksmobile.com/en/`
