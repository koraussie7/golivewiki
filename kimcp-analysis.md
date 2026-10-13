# KiMCP (zeikar/kimcp) 분석 — KBizHub 통합 후보

> 조사일: 2026-10-13 · 방법: GitHub 원문(README + 소스 5개 직접 열람) + npm/버전 확인
> 결론: **네이버·카카오·TMAP 전부 공식 API만 호출하는 MCP 서버. 회색지대 0. 단 4개월 방치된 PoC.**

---

## 0. 한 줄 요약

한국 3대 플랫폼(네이버·카카오·TMAP/SK) **공식 API**를 LLM이 쓰게 하는 MCP 서버. 검색·지역·길찾기 12개 도구를 제공하며, **API 키를 안 넣으면 해당 도구가 자동 비활성화**된다. 이전 분석한 `naver-search-mcp`(isnow890)의 상위 호환 격.

---

## 1. 기본 정보

| 항목 | 내용 |
|---|---|
| 저장소 | `zeikar/kimcp` (Korea-integrated Model Context Protocol) |
| 정체 | 네이버·카카오·TMAP **공식 API** → MCP 변환 서버 |
| 도구 수 | **12개** (네이버 7 · 다음 2 · 카카오맵 2 · 길찾기 2, 일부 중첩) |
| 스택 | **Python**, `uv` 관리, `mcp[cli]` + `httpx`, Python ≥3.10 |
| 라이선스 | MIT |
| 성숙도 | 스타 **11** · 포크 3 · 이슈 0 |
| 생성·최종 | 2025-04-02 생성 → **2025-05-15 마지막 커밋 (이후 4개월+ 방치)** |
| 배포 | GitHub clone + `uv run mcp install`. **npm/PyPI 미배포** — 설치가 clone 전제 |
| 대상 | Claude Desktop (README가 Claude Desktop 기준으로만 서술) |

---

## 2. 핵심 — 전부 공식 API 도메인 (회색지대 0)

소스 5개를 직접 열어 호출 엔드포인트를 전수 확인했다.

| 파일 | 엔드포인트 | 성격 |
|---|---|---|
| `src/naver.py` | `openapi.naver.com/v1` (blog/news/cafe/kin/local/image/shopping) | ✅ 네이버 공식 검색 API |
| `src/kakao.py` | `dapi.kakao.com/v2` (로컬) · `apis-navi.kakaomobility.com/v1` (길찾기) | ✅ 카카오 공식 |
| `src/sk.py` | `apis.openapi.sk.com` (TMAP 대중교통) | ✅ SK/TMAP 공식 |

→ **비공식 내부 API·스크래핑·IMAP 우회가 없다.** 이는 회색지대였던 smb-mcp/amiro와 정반대이며, `naver-search-mcp`과 결정적으로 갈리는 지점이다.

### naver-search-mcp(isnow890)과의 차이

| 구분 | naver-search-mcp | **KiMCP** |
|---|---|---|
| 네이버 검색 | ✅ (공식 openapi) | ✅ (동일, 공식) |
| **카카오맵 로컬 검색** | ❌ | ✅ `dapi.kakao.com` 공식 |
| **자동차 길찾기** | ❌ | ✅ kakaomobility 공식 |
| **대중교통 길찾기** | ❌ | ✅ TMAP 공식 |
| **키 누락 시 처리** | 미검증 | ✅ **도구 자동 비활성화** (`config.py`) |
| 방향 | 네이버 검색 단일 | **3사 통합 (네이버+카카오+TMAP)** |

→ 네이버 검색은 겹치지만, KiMCP는 **카카오·TMAP 추가 + 키 게이팅**으로 기능 폭이 넓다.

---

## 3. KBizHub 관점 가치

KBizHub Reservation Agent 맥락에서 어디 쓰이는가.

| KBizHub 니즈 | KiMCP 도구 | 비고 |
|---|---|---|
| 사업자 주변 맥락 (고객에게 위치 안내) | `search_naver_local` / `search_kakao_local` | 두 플랫폼 교차 검증 가능 |
| 고객 찾아오는 길 (대중교통) | TMAP 대중교통 길찾기 | 예약 확인 메시지에 경로 첨부 |
| 고객 찾아오는 길 (자동차) | 카카오 자동차 길찾기 | 주차 안내와 결합 |
| 마케팅 리서치 (블로그/뉴스/카페) | 네이버 7종 검색 | — |

→ **"예약 확인 → 길찾기 안내" 루프의 마지막 빈칸(경로)을 메운다.** 알림톡으로 "예약 확정"만 보내는 것을 "찾아오시는 길(대중교통 N분)"까지 확장 가능. 이는 고객 경험 차별점.

**다만 직접 예약 기능은 없다.** 검색·길찾기는 읽기 전용 보조 도구이며, 예약 캘린더는 nworks/Google, 발송은 send-go/openapi가 담당. KiMCP는 그 사이 **맥락 부여(위치·경로)** 역할.

---

## 4. Metorial 통합 관점

| 항목 | 내용 | 적합성 |
|---|---|---|
| 자격증명 | API Key 3종 (`NAVER_CLIENT_ID/SECRET`, `KAKAO_REST_API_KEY`, `SK_APP_KEY`) | ✅ Key 기반, 평문 비밀번호 없음 → smb-mcp 충돌 없음 |
| 저장 방식 | `.env` / MCP config `env` (소스 `config.py` = `os.environ.get`) | ✅ Metorial credential vault 대응 가능 |
| 인증 방식 | Naver는 Client ID/Secret 헤더, Kakao/SK는 REST Key | ⚠️ 3사 제각각 → Metorial 어댑터 필요 |
| 키 게이팅 | 키 없으면 해당 도구 비활성 | ✅ 최소권한 자연 구현 (없는 키=없는 도구) |
| transport | stdio (`mcp install`) | ✅ Metorial Platform 컨테이너 래핑 가능 |
| 런타임 | Python + uv | ⚠️ Metorial 컨테이너에 Python 베이스 이미지 필요 |

**통합 포인트:** `main.py` stdio 기동 → Metorial 컨테이너 래핑 → Business MCP 뒤 배치. 3개 API Key는 credential vault 보관, 외부 에이전트 비노출.

---

## 5. 리스크 & 주의

| 리스크 | 상세 | 대응 |
|---|---|---|
| 🟠 **방치 (Stale)** | 2025-05-15 이후 **4개월+ 커밋 0**. `mcp[cli]` SDK는 빠르게 변하는데 고정 (1.6.0) | 도입 전 현재 SDK(1.x 최신)와 호환 실측. 막히면 `naver-search-mcp` 또는 포크 |
| 🟠 **PoC 성숙도** | 스타 11, README 스스로 *"현재 개발 중..."*. 미배포(clone 전제) | 프로덕션 의존 X. 보조 도구로만 |
| 🟠 **API 쿼터·과금** | 네이버 검색은 일 호출량 제한(25,000/일), TMAP은 유료 과금 가능 | 호출량 모니터링, 캐시. Metorial 감사로그로 추적 |
| 🟡 **Claude Desktop 종속** | README가 Claude Desktop 설치법만 서술. 범용 stdio 서버이긴 하나 문서 편향 | KBizHub는 Metorial 경유이므로 무관하나, README 의존 금지 |
| 🟡 **라우팅만, 예약 아님** | 길찾기는 계산 결과를 줄 뿐 예약 행위 없음 | 기대치 관리 — 보조 도구 |
| 🟡 **키 3종 관리** | 3사 제각각 인증 헤더 → 설정 복잡 | 온보딩 시 키 3종 수집 플로 내재화, 없으면 해당 도구만 비활성(이미 지원) |
| 🟢 **라이선스** | MIT — 상업 사용 허용, smb-mcp 문서 불일치 문제 없음 | 도입 장애물 아님 |
| 🟢 **공식 API** | 전 엔드포인트 공식 도메인 — Zero-Trust 훼손 없음 | ✅ nworks와 동급 신뢰 |

---

## 6. 평가 및 권고

**적합도: 중간 — "보조 위치·경로 도구"로는 가치 있으나, 직접 예약은 불가.**

**강점:**
- **전 공식 API** → 회색지대 제로, Zero-Trust 훼손 없음 (smb-mcp와 정반대)
- **키 게이팅 설계 우수** → 없는 키는 도구 자체 비활성, 최소권한 자연 구현
- **3사 통합** → 네이버 검색 단독인 naver-search-mcp보다 폭이 넓다
- **길찾기가 KBizHub 루프의 빈칸** → "예약 확정 + 찾아오시는 길" 차별화

**약점:**
- **4개월 방치 PoC** → SDK 버전 고정, 배포 미비
- **예약 기능 없음** → 읽기 전용 보조
- **길찾기·TMAP 과금** → 쿼터 관리 필요

**권고:**
1. **"예약 + 길안내" 통합에 쓰라** — send-go/openapi(발송) + KiMCP(경로)를 묶어 "내일 14시 예약, 2호선 강남역 3번 출구 도보 5분" 같은 메시지를 생성. 이게 실제 차별점.
2. **4개월 방치 감안, 프로덕 직접 의존 금지** — 보조 도구로 두고, 실패 시 수동 경로 폴백. 네이버 검색만 필요하면 더 잘 관리된 `naver-search-mcp` 검토.
3. **TMAP 유료 과금 확인** — 도입 전 SK Open API 과금 정책 확인 후 활성화 여부 결정.
4. **키 3종은 Metorial vault에** — 외부 에이전트 비노출.

---

## 7. 출처

- `https://github.com/zeikar/kimcp` (README.md / main.py / src/{naver,kakao,sk,config}.py 원문 직접 열람)
- `https://zeikar.dev/projects/kimcp/` (공식 홈)
- 교차 검증: `naver-search-mcp-analysis.md`, `nworks-analysis.md`, `smb-mcp-analysis.md`, `phase0-5-naver-booking-api.md`, `kbizhub-metorial-integration-plan.md`
- API 도메인 실측: `openapi.naver.com`, `dapi.kakao.com`, `apis-navi.kakaomobility.com`, `apis.openapi.sk.com` (소스 내 문자열 확인)
