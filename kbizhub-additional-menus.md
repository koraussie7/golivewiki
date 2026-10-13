# KBizHub 추가 가능 메뉴 설계 (코드베이스 근거)

> 작성일: 2026-10-13 · 기준: 이 워크스페이스의 커넥터 분석 + 직접 구현한 `sendgo-mcp/` 래퍼
> 방식: **기존 메뉴를 뜯어고치는 게 아니라, 코드베이스의 실제 도구/엔드포인트에서 파생**되는 신규 메뉴만 제안

---

## 0. 기존 메뉴 (변경 기준선 — 그대로 둔다)

KBizHub 명시 구조:

| 구분 | 기존 메뉴/컴포넌트 | 가격 |
|---|---|---|
| 5대 기둥 | 웹사이트 · AI Agent · **Business MCP** · 마켓플레이스 · MuhanAI Network | — |
| Agent 1 | **Reservation Agent** | ₩14,900/월 |
| Agent 2 | **Restaurant Agent** | ₩9,900/월 |
| Agent 3 | **Translation Agent** | ₩9,900/월 |
| Agent 4 | **SEO Agent** | ₩4,900/월 |
| 요금제 | 기본 ₩29,000 일회성 · 평생 노드 소유 · 월 구독료 없음 | — |

아래 추가 메뉴는 **이 4개 Agent를 "실행 엔진"으로 삼되, 현재 대시보드에 노출되지 않은 운영 화면**이다. 전부 **이미 코드로 존재**하거나 확정된 커넥터에서 나온다.

---

## 1. 추가 메뉴 지도 (사이드바 제안)

```
[기존]  대시보드 · 예약 · 메뉴판 · 주문 · 결제 · 마켓플레이스 · 설정
                    ↓ 아래가 신규
[신규]  메시지센터 ─ 템플릿스튜디오 ─ 발송분석 ─ 수신거부
       일정·캘린더 ─ 길찾기안내 ─ 찾아오시는길
       리서치·검색 ─ 위키지식(RAG)
       연락처·구성원 ─ 게시판·업무 ─ 사서함
       자격증명금고 ─ 감사로그 ─ 통합허브 ─ 웹훅·이벤트
```

---

## 2. 신규 메뉴 상세 (코드베이스 근거 포함)

### A. 메시지 센터 (Message Center) ⭐ 즉시 구현
| 항목 | 내용 |
|---|---|
| **근거** | ✅ **직접 구현함** — `sendgo-mcp/src/tools.mjs` 4도구: `list_kakao_senders`, `list_alimtalk_templates`, `send_alimtalk`, `send_sms`. + `send-go/openapi` 58개 엔드포인트(알림톡/SMS/LMS/MMS/친구톡→브랜드메시지) |
| 기능 | 카카오 알림톡·SMS·LMS·MMS·브랜드메시지 통합 발송, 발신프로필(채널) 관리, 실패 시 SMS 자동 대체 |
| 연결 | Reservation Agent(예약 확인·리마인더), Business MCP |
| 메뉴 하위 | 발신프로필 · 발송내역 · 대량발송 · 예약발송 |
| 준비도 | **래퍼 완료·스모크 19/19 통과.** `.env`만 채우면 운영. 프론트(React)만 얹으면 됨 |

> 이 메뉴는 계획 Phase 0-4/1-3의 산출물을 그대로 노출하는 것이다. **가장 먼저 뜰 수 있는 메뉴.**

### B. 템플릿 스튜디오 (Template Studio) ⭐ 즉시 구현
| 항목 | 내용 |
|---|---|
| **근거** | `send-go/openapi` 관리 API — `noticeTemplates`(알림톡 CRUD·검수), `brandTemplates`(브랜드메시지), `templateFolders`(5단계 폴더), `messageTemplates`(문자 상용구), `kakaoImages`(이미지 업로드) |
| 기능 | 템플릿 생성/수정, **카카오 검수 상태 추적**(REG→REQ→APR/REJ), 폴더 분류, 이미지 템플릿. 정책 필드 불일치는 저장 단계에서 즉시 차단(`POLICY_VALIDATION_FAILED`) |
| 메뉴 하위 | 알림톡 템플릿 · 브랜드메시지 · 문자 상용구 · 이미지 · 검수 현황 |
| 차별점 | **"카카오 심사 반려"를 사전에 잡는 화면** — 며칠 기다렸다 반려당하는 것 방지 |

### C. 발송 분석 (Delivery Analytics)
| 항목 | 내용 |
|---|---|
| **근거** | `send-go/openapi` `shortUrl` API — `stats`가 **일별 추이·디바이스·유입경로·국가별 분해** 반환. 사전 집계라 클릭 많아도 응답 일정 |
| 기능 | 메시지 내 링크 클릭 분석, 캠페인별 성과, 단축 URL 생성/비활성 |
| 메뉴 하위 | 캠페인 · 클릭통계 · 단축URL |
| 연결 | Restaurant/SEO Agent(마케팅 효과 측정) |

### D. 수신거부 관리 (Opt-out)
| 항목 | 내용 |
|---|---|
| **근거** | `send-go/openapi` `rejectedNumbers` — 080 수신거부 번호 조회 |
| 기능 | 080 수신거부 목록 관리, 발송 제외 (정보통신망법 준수 보조) |
| 메뉴 하위 | 수신거부 번호 · 차단 정책 |

### E. 일정·캘린더 (Calendar)
| 항목 | 내용 |
|---|---|
| **근거** | `nworks` — `nworks_calendar_*`(조회/생성/수정/삭제). LINE WORKS 공식 OAuth. + 기존 Google Calendar 연동 |
| 기능 | 예약을 사내 캘린더(네이버웍스) 또는 Google에 양방향 동기화 |
| 연결 | Reservation Agent |

### F. 길찾기 안내 (Directions)
| 항목 | 내용 |
|---|---|
| **근거** | `kimcp` — 카카오 자동차 길찾기(`apis-navi.kakaomobility.com`) + TMAP 대중교통(`apis.openapi.sk.com`). `zido` — 공식 지도 API로 businessId 확보 |
| 기능 | 예약 확인 메시지에 **"찾아오시는 길(대중교통 N분/자동차)"** 자동 첨부 |
| 연결 | Reservation Agent + 메시지 센터(A) |
| 차별점 | 알림톡 "예약 확정" → *"2호선 강남역 3번 출구 도보 5분"* 로 격상 |

### G. 리서치·검색 (Research & Discovery)
| 항목 | 내용 |
|---|---|
| **근거** | `kimcp` — 네이버 검색 7종(블로그/뉴스/카페/지식iN/지역/이미지/쇼핑) + `naver-search-mcp` + `zido` 지도 |
| 기능 | 업계 동향, 경쟁사 리뷰, 로컬 맥락 검색. AI Agent가 참조할 지식 수집 |
| 연결 | Restaurant/SEO Agent |

### H. 연락처·구성원 (Contacts & Directory)
| 항목 | 내용 |
|---|---|
| **근거** | `nworks` — `nworks_contact_*`, 구성원(directory) 조회 |
| 기능 | 단골 고객 연락처, 직원 연락처 통합. 예약 고객 이력 조회 |
| 연결 | Reservation Agent |

### I. 게시판·업무 (Boards & Tasks)
| 항목 | 내용 |
|---|---|
| **근거** | `nworks` — `nworks_board_*`(게시판), `nworks_task_*`(업무) |
| 기능 | 사내 공지, 예약 관련 업무 할당, 직원 간 협업 |
| 연결 | Reservation Agent(업무 자동 생성) |

### J. 사서함 (Inbox)
| 항목 | 내용 |
|---|---|
| **근거** | `nworks` — `nworks_mail_list/read`(공식 메일 API). ⚠️ smb-mcp IMAP은 **내부 전용**(회색지대, 공개 메뉴 제외) |
| 기능 | 네이버웍스 메일 확인. 외부 예약 메일(공식 API 있을 때만) 연동 |
| 주의 | smb-mcp은 계획상 **Business MCP 미노출** 확정 — 이 메뉴에 넣지 않음 |

### K. 자격증명 금고 (Credential Vault) ⭐ Metorial 핵심
| 항목 | 내용 |
|---|---|
| **근거** | Metorial Platform — OAuth 토큰 라이프사이클, 스코프 권한, credential vault. 계획 §3 (공유 인스턴스 멀티테넌트) |
| 기능 | 모든 외부 API 키(네이버·카카오·TMAP·Google·LINE WORKS)를 한곳에 보관, 사업자·외부 에이전트 비노출 |
| 연결 | 모든 Agent, Business MCP |
| 메뉴 하위 | 연결 자격증명 · 스코프 권한 · 토큰 상태 |

### L. 감사 로그 (Audit Log)
| 항목 | 내용 |
|---|---|
| **근거** | Metorial — 세션 녹화, "어떤 에이전트가 누구 자격증명으로 무엇에 접근" 추적. 계획 Phase 2-4 |
| 기능 | 외부 AI 에이전트의 예약/결제 호출 이력. **Human Expert Escrow 승인 이력 증명** |
| 차별점 | 전문가 에스크로의 **법적 실체** 부여 — KBizHub 신뢰 주장의 근거 |

### M. 통합 허브 (Integrations)
| 항목 | 내용 |
|---|---|
| **근거** | Metorial — 1200+ 통합 카탈로그. 계획 Phase 4 |
| 기능 | 원클릭으로 외부 서비스 연결(결제·캘린더·메시지 등). Agent SKU 생성기 |
| 연결 | 마켓플레이스(기존) |

### N. 웹훅·이벤트 (Webhooks & Events)
| 항목 | 내용 |
|---|---|
| **근거** | `send-go/openapi` `webhook` — 이벤트 구독(심사 결과 등 수신) |
| 기능 | 템플릿 검수 완료, 발송 결과 등 외부 이벤트를 KBizHub로 수신 |
| 연결 | 메시지 센터(A), 템플릿 스튜디오(B) |

---

## 3. 메뉴 우선순위·준비도 매트릭스

| 메뉴 | 근거 코드 | 준비도 | 권장 우선순위 |
|---|---|---|---|
| A 메시지센터 | `sendgo-mcp` 4도구 | ✅ 래퍼 완료 | **P0** (프론트만) |
| B 템플릿스튜디오 | `send-go/openapi` 관리 API | ✅ 스펙 확보 | **P0** |
| L 감사로그 | Metorial 세션 녹화 | 🟠 Phase 2 필요 | **P1** |
| K 자격증명금고 | Metorial vault | 🟠 Phase 1 필요 | **P1** |
| E 일정·캘린더 | `nworks` calendar | 🟡 커넥터 연동 | P2 |
| F 길찾기안내 | `kimcp` + `zido` | 🟡 연동 필요 | P2 |
| C 발송분석 | `send-go/openapi` shortUrl | 🟡 연동 필요 | P2 |
| N 웹훅·이벤트 | `send-go/openapi` webhook | 🟡 연동 필요 | P2 |
| G 리서치·검색 | `kimcp` + `naver-search-mcp` | 🟡 연동 필요 | P2 |
| H 연락처·구성원 | `nworks` contact | 🟡 연동 필요 | P3 |
| I 게시판·업무 | `nworks` board/task | 🟡 연동 필요 | P3 |
| D 수신거부 | `send-go/openapi` 080 | 🟡 연동 필요 | P3 |
| J 사서함 | `nworks` mail | 🟡 연동 필요 | P3 |
| M 통합허브 | Metorial 카탈로그 | 🟠 Phase 4 | P3 |

**P0 = 코드베이스에 이미 있음(래퍼/스펙). 프론트만 얹으면 됨.**

---

## 4. 설계 원칙 (왜 이 메뉴들인가)

1. **전부 코드 근거가 있다** — 뜬구름 기획이 아니라, 이 워크스페이스에서 분석·구현한 커넥터/엔드포인트에서 1:1 파생. "있는 걸 노출"하지 "없는 걸 약속"하지 않는다.
2. **기존 4 Agent를 건드리지 않는다** — 메뉴는 Agent의 **운영 화면**이지 새 Agent가 아니다. 가격 체계(₩4,900~14,900) 흔들리지 않음.
3. **smb-mcp 회색지대 배제** — J(사서함)는 네이버웍스 공식 메일만, IMAP 우회는 메뉴에서 원천 제외. Zero-Trust 주장과 정합.
4. **A+B가 MVP** — sendgo-mcp 래퍼가 이미 통과(19/19)했으므로, 메시지센터+템플릿스튜디오는 React 프론트만 얹으면 즉시 노출 가능.

---

## 5. 출처 (코드베이스 근거 파일)

- 직접 구현 `sendgo-mcp/` — 등록된 MCP 도구 4개 (실제 `src/tools.mjs` `TOOLS` 배열 기준):
  1. `list_kakao_senders` — 발신프로필(카카오 채널) 조회 → 메뉴 A·D 근거
  2. `list_alimtalk_templates` — 알림톡 템플릿(APR 승인) 조회 → 메뉴 B 근거
  3. `send_alimtalk` — 알림톡 발송(수신자+변수) → 메뉴 A·C 근거
  4. `send_sms` — SMS 발송 → 메뉴 A·C·D 근거
  - `src/client.mjs` — 토큰 발급/캐시(50분)/401·403 재시도, v1/v2 인증 차이 처리
  - `.env.example` — `SENDGO_ACCESS_KEY/SECRET_KEY/API_VERSION/BASE_URL/KAKAO_SENDER_KEY` → 메뉴 K 근거
- 스펙: `send-go/openapi` OpenAPI 3.0.3 (58 엔드포인트 중 4개 선별 노출)
- 분석 문서: `nworks-analysis.md`, `kimcp-analysis.md`, `naver-search-mcp-analysis.md`, `zido-analysis.md`, `smb-mcp-analysis.md`, `phase0-5-naver-booking-api.md`
- 계획: `kbizhub-metorial-integration-plan.md` (Phase 0~5, Metorial 공유 인스턴스 설계)
- 기존 메뉴 기준: `kbizhub-metorial-integration-plan.md` §1.2 (Reservation/Restaurant/Translation/SEO Agent + Business MCP)

