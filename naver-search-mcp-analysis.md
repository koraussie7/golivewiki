# naver-search-mcp 분석 — KBizHub 관점

> 조사일: 2026-10-13 · 방법: GitHub 원문 + npm registry + **curl 실측**
> 결론부터: **Phase 0-5에서 "자동화 불가"라고 한 네이버 지도 검색은, 이 MCP로 합법적으로 가능하다.**

---

## 1. 프로젝트 성숙도 — smb-mcp과 정반대

| 항목 | smb-mcp | **naver-search-mcp** |
|---|---|---|
| 스타 / 포크 | 0 / 0 | **88 / 30** |
| 생성 → 최종 푸시 | 2026-05-02 **생긴 날 끝** | **2025-04-08 → 2026-10-07** (6개월 전까지 활발) |
| 크기 | 11 KB | 3.2 MB |
| 테스트 | 합성 fixture 전용 | **테스트 6종** (credentials·date·endpoints·error·client·removed-tools) |
| 구조 | 단일 스크립트 | clients/schemas/handlers/types/utils **계층 분리** |
| npm | 없음 | `@isnow890/naver-search-mcp` **v1.0.54, 28버전, 2025-04~2026-10 꾸준** |
| 배포 | 없음 | **Dockerfile** 포함 |
| 라이선스 | MIT인데 README 불일치 | **MIT 일관** |

→ **프로덕션 사용 가능한 성숙도.** smb-mcp은 PoC, 이건 제품입니다.

---

## 2. ⭐ 핵심 발견 — Phase 0-5의 captcha 문제를 해결한다

### 2.1 문제 제기
Phase 0-5 §3 에서 `amiro-lab/booking-mcp` README 원문을 인용했습니다.
> *"Naver Map search returned **ncaptcha** for automated place-list collection... does not bypass captcha"*

→ 즉 **장소/사업자 검색은 자동화 불가**라 판단하고, 경로 A(예약조회 MVP 제외)를 권고했습니다.

### 2.2 그런데 이 MCP에는 `search_local` 이 있다
네이버 **공식 검색 API의 지역 검색**입니다. captcha가 없습니다 — 공식 계약 하에 동작합니다.

```
도구: search_local  (지역 장소 검색)
스키마: query(필수) · display(기본10) · start(기본1) · sort(sim|date)
응답타입: NaverLocalSearchResponse
```

### 2.3 실측으로 엔드포인트 실재를 확인했다

| 플랫폼 | 엔드포인트 | 무키 응답 | 판정 |
|---|---|---|---|
| 네이버 개발자센터 (legacy) | `openapi.naver.com/v1/search/local.json` | **401** | ✅ 실재, 인증 필요 |
| NAVER API HUB (권장) | `naverapihub.apigw.ntruss.com/search/v1/local` | **401** `errorCode:200 Authentication Failed` | ✅ 실재, 인증 필요 |
| HUB — `.json` 붙인 형태 | `search/v1/local.json` | **404** `errorCode:300 URL not found` | ❌ 경로 다름 |

**핵심 판별법:** `401` 은 "엔드포인트는 있는데 네 키가 틀렸다", `404` 는 "그런 경로 없다".
HUB는 **확장자 없이** `search/v1/local` 이 정확한 경로임을 대조로 확인했습니다.

→ **결론: 네이버 공식 지역검색 API는 존재하고, captcha 없이 동작한다.**

---

## 3. 제공 도구 (19종)

| 그룹 | 도구 | KBizHub 활용 |
|---|---|---|
| **카테고리** | `find_category` | 자연어 → 쇼핑 카테고리 ID |
| **검색 (8)** | `search_webkr` `search_news` `search_blog` `search_cafearticle` `search_image` `search_kin` `search_encyc` **`search_local`** | ⭐ `search_local` = 사업자/장소 발굴 |
| **DataLab 트렌드 (10)** | `datalab_search` · `datalab_shopping_category` · `_by_device` · `_by_gender` · `_by_age` · `datalab_shopping_keywords` · `_keyword_by_device` · `_keyword_by_gender` · `_keyword_by_age` | ⭐ 시장·키워드 트렌드 |

**KBizHub에 즉시 쓰이는 2가지:**
1. **`search_local`** — 사업자 온보딩 시 **businessId 확보**가 아니라 **업체·경쟁업체 정보 수집**. 예약 에이전트의 맥락 제공.
2. **DataLab 쇼핑/키워드 트렌드** — "이번 주 어떤 메뉴가 뜨나" 같은 **프로모션 대상 선정**. 알림톡 캠페인의 내용을 데이터로 결정.

---

## 4. 🔴 주의할 점 — 자격증명 플랫폼 이관

| 항목 | 내용 |
|---|---|
| **legacy 개발자센터** | `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` — **2026-07-31 신규 발급 차단**, 기존 키는 **2027-06-30** 까지 |
| **NAVER API HUB (권장)** | `NCP_APIGW_API_KEY_ID` / `NCP_APIGW_API_KEY` — NCP 콘솔 발급 |
| **둘은 호환되지 않는다** | 어느 변수에 들었는지로 provider 판단 (`credentials.ts`) |

### ⚠️ KBizHub가 지금 발급받으면?
2026-10-13 시점이므로 **legacy는 신규 발급 불가 → 반드시 NAVER API HUB**를 써야 합니다.
레거시 키로 시작하면 **2027-06-30에 갑자기 전부 중단**됩니다.

### 코드가 이관을 배려한 점 (잘 됨)
`credentials.ts` 는 HUB 키가 **반쪽**이어도 서버를 죽이지 않는다:
```ts
// HUB 키가 반쪽이어도 개발자센터 키가 온전하면 서버를 죽이지 않는다.
// 이관 중에 HUB 키를 반만 넣어둔 기존 사용자를 막지 않되, 실수는 경고로 드러낸다.
```
→ warning 으로만 알리고 legacy 로 폴백. **이관 기간의 운영 중단을 막는 설계.**

---

## 5. KBizHub 아키텍처 정합성

| 항목 | 평가 |
|---|---|
| Metorial 연동 | ✅ **표준 MCP 서버** — Claude Desktop/Cursor/Claude Code/Cline 설정만으로 연결 |
| 자격증명 | ✅ **env 로만 주입**, 메일 비밀번호 같은 위험 자격증명 불필요 (smb-mcp과 결정적 차이) |
| 법적 성격 | ✅ **네이버 공식 API** — Phase 0-5 의 비공식 GraphQL 리스크와 정반대 |
| OpenClaw/ClawHub | `openclaw skills install naver-search-mcp` — bitterbot 계열(pi-mono)과도 궁합 |
| 라이선스 | ✅ MIT |

→ **smb-mcp(IMAP 평문 비밀번호) 대비 모든 축에서 안전합니다.**

---

## 6. Phase 0-5 결론 수정

### 변경 전
> "장소 검색 자동화 불가 (ncaptcha)" → 경로 A만 제시 (예약조회 MVP 제외)

### 변경 후
> **장소·사업자 검색은 `search_local` 로 합법적으로 가능.** 단 이건 **검색**이지 **예약 조회/생성**은 아니다.

| 기능 | 가능 여부 | 수단 |
|---|---|---|
| 업체/장소 검색 | ✅ **가능** | `search_local` (공식, captcha 없음) |
| 시장·키워드 트렌드 | ✅ **가능** | DataLab 10종 |
| 예약 **가능 슬롯** 조회 | ⚠️ 비공식 GraphQL (법무검토) | `m.booking.naver.com/graphql` |
| 확정 **예약** 수신 | ⚠️ IMAP 우회 (취약) | smb-mcp |
| 알림톡/SMS **발신** | ✅ **가능** | `sendgo-mcp` (0-4 완료) |

→ **경로 A(MVP 축소) 권고 자체는 유지.** 다만 "네이버와 연결 불가"가 아니라
**"읽기는 가능, 예약 상태만 어둠"** 이 정확한 표현입니다.

### 권고 보강
KBizHub 사업자 온보딩 플로에 `search_local` 을 넣어 **업체 검증·경쟁분석** 기능을 제공할 수 있습니다. 이건 법적으로 안전하고 즉시 구현 가능합니다.

---

## 7. KBizHub 적용 권고

| 순위 | 항목 | 근거 |
|---|---|---|
| 1 | **NAVER API HUB 키 발급** (legacy 금지) | 2026-07-31 이후 legacy 신규발급 차단. 지금 HUB로 시작해야 2027-06-30 중단 회피 |
| 2 | `search_local` 을 온보딩/마케팅 도구로 편입 | 공식·합법·즉시 가능 |
| 3 | Metorial provider deployment 등록 | env 자격증명만 있으면 연결 끝 |
| 4 | DataLab 트렌드를 캠페인 추천에 활용 | 알림톡 내용을 데이터 기반으로 결정 |

**즉시 실행:** NCP 콘솔 > All Services > Application Services > **NAVER API HUB** > Application 등록 → `NCP_APIGW_API_KEY_ID` / `NCP_APIGW_API_KEY` 발급.

---

## 8. 검증 방법 (재현 가능)

```bash
# legacy 지역검색 실재 확인 (401 = 엔드포인트는 살아있다)
curl -sS -o /dev/null -w '%{http_code}\\n' \
  'https://openapi.naver.com/v1/search/local.json?query=강남%20한식당&display=3' \
  -H 'X-Naver-Client-Id: x' -H 'X-Naver-Client-Secret: y'

# HUB 지역검색 (401 = 실재). ⚠️ .json 붙이면 404 난다
curl -sS -o /dev/null -w '%{http_code}\\n' \
  'https://naverapihub.apigw.ntruss.com/search/v1/local?query=test&display=2' \
  -H 'X-NCP-APIGW-API-KEY-ID: x' -H 'X-NCP-APIGW-API-KEY: y'
```

---

## 9. 출처

- https://github.com/isnow890/naver-search-mcp (README.md · src/config/credentials.ts · src/clients/naver-api-endpoints.ts · naver-search.client.ts · search.schemas.ts 원문)
- npm registry: `@isnow890/naver-search-mcp` v1.0.54, 28버전, 2025-04-24 ~ 2026-10-07
- 실측: `curl` 직접 호출 (2026-10-13), 위 §8 명령어로 재현 가능
- 관련: `phase0-5-naver-booking-api.md` (예약 조회는 여전히 비공식)
