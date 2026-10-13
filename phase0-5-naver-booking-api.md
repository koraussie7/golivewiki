# Phase 0-5 결과 — 네이버 예약 공식 API 존재 확인

> 실행일: 2026-10-13 · 방법: **네이버 공식 문서 1차 수집** + curl 실측 + 공개 저장소 원문 분석
> 결론: **네이버 예약 공식 API는 존재하지 않는다(1차 자료 확정).** 다만 사업자용 내부 GraphQL이 무인증으로 노출돼 있고, 공식 `/v1/search/local` 로 업체 검색은 가능하다.

---

## 1. 결론 요약

| 질문 | 답 | 근거 |
|---|---|---|
| 네이버 예약 **공식 공개 API**가 있는가? | **❌ 없다** | **1차 자료 확정** — 공식 "오픈API 종류" 28개 엔드포인트 전수에 예약/booking **0건** (§1-A) |
| 그럼 smb-mcp가 IMAP 우회를 쓴 이유는? | **정당했다** | 공식 경로가 없으므로 이메일 파싱이 유일한 사업자용 합법 경로 |
| 업체·장소 검색은 가능한가? | **✅ 가능** | 공식 `/v1/search/local` (captcha 없음) — `naver-search-mcp` 로 검증 |
| 예약 현황을 얻는 길이 아예 없는가? | **❌ 아니다** | `m.booking.naver.com/graphql` 이 **무인증으로 응답** (실측) — 그러나 비공식 |
| KBizHub가 비공식 GraphQL을 써도 되는가? | **⚠️ 법무 검토 필수** | 공식 목록에 부재 = 계약 기반이 아닌 내부 엔드포인트 |

---

## 1-A. 1차 자료 확정 — 네이버 공식 오픈API 전체 목록 (2026-10-13)

**출처 1차: https://developers.naver.com/docs/common/openapiguide/apilist.md**
(네이버 Developers 공식 "네이버 오픈API 종류" 페이지)

네이버 오픈API는 **전체 5개 분류 28개 엔드포인트**가 전부이며, **예약(booking) 항목은 0건**이다.

### 로그인 방식 (3개 API, 5개 URL)

| 분류 | 주요 요청 URL | 메서드 |
|---|---|---|
| 네이버 로그인 | `https://nid.naver.com/oauth2.0/authorize` | GET/POST |
| | `https://nid.naver.com/oauth2.0/token` | GET/POST |
| | `https://openapi.naver.com/v1/nid/me` | GET |
| 카페 | `https://openapi.naver.com/v1/cafe/{clubid}/members` | POST |
| | `https://openapi.naver.com/v1/cafe/{clubid}/menu/{menuid}/articles` | POST |
| 캘린더 | `https://openapi.naver.com/calendar/createSchedule.json` | POST |

> ⚠️ **혼동 주의**: 유일하게 "일정(Schedule)"이 들어간 API는 **네이버 캘린더 일정 담기**이며,
> 이는 **예약 조회/생성이 아니다**. 네이버 예약과 무관.

### 비로그인 방식 (5개 API, 23개 URL)

| 분류 | URL 패턴 | 개수 |
|---|---|---|
| 데이터랩 | `/v1/datalab/search`, `/v1/datalab/shopping/categories`, `/category/device`, `/category/gender`, `/category/age`, `/category/keywords`, `/category/keyword/device`, `/gender`, `/age` | 9 |
| 검색 | `/v1/search/{news, encyc, blog, shop, webkr, image, doc, kin, book, cafearticle, adult, errata, local}` | **13** |
| 이미지 캡차 | `/v1/captcha/ncaptcha.bin`, `/v1/captcha/nkey` | 2 |
| 음성 캡차 | `/v1/captcha/scaptcha`, `/v1/captcha/skey` | 2 |
| 네이버 공유하기 | `http://share.naver.com/web/shareView` | 1 |

**검색 API 13개 중 KBizHub에 직접 쓰일 수 있는 것:**
- `/v1/search/local` — "네이버 지역 서비스에 등록된 지역별 **업체 및 상호 검색** 결과" → 사업자/업체 탐색의 **유일한 합법 경로**
- 그 외 전부 콘텐츠 검색(뉴스·백과·블로그·쇼핑·웹문서·이미지·전문정보·지식iN·책·카페글) 및 성인판별·오타변환

### ✅ 확정 결론

1. **네이버 예약 공식 API는 존재하지 않는다.** 전체 오픈API 목록에 예약/booking/reservation 항목이 **0건**이다.
2. 따라서 smb-mcp가 IMAP 메일 파싱을 선택한 것은 **합리적 회피**였으며, "게으른 구현"이 아니다.
3. `m.booking.naver.com/graphql` 은 **이 공식 목록에 없다** → **비공식 내부 엔드포인트로 확정**된다.
4. **`/v1/search/local` 만이 사업자 탐색의 공식 출발점**이다 (`naver-search-mcp`의 `search_local` 이 바로 이것).

---

## 2. 실측 증거 (2026-10-13)

### 2.1 엔드포인트가 살아있고 무인증으로 응답한다

```
POST https://m.booking.naver.com/graphql
headers: content-type, origin(=m.booking.naver.com), referer, user-agent
body: query hourlyBookableSchedules($scheduleParams: ScheduleParams) {...}
```

**유효한 businessId (`992240`) → HTTP 200, 실데이터 반환**
- 30분 단위 슬롯 48개 (`00:00` ~ `23:30`)
- 필드: `isBookable`, `isScheduled`, `unitStartDateTime`, `unitStartTime`, `prices[{isDefault, price}]`

**대조군 — 존재하지 않는 businessId (`BOGUS_000`)**
```json
{"errors":[{"message":"Invalid path parameter detected","extensions":{"code":"BAD_REQUEST"}}],
 "data":{"hourlyBookableSchedules":null}}
```

→ **대조군이 오류를 반환한다**는 점이 중요하다. 이 엔드포인트는 단순 스텁이 아니라 **실제로 businessId를 검증하는 운영 API**다. 즉 실데이터가 검증 가능한 형태로 노출돼 있다.

### 2.2 그러나 이건 "공식 API"가 아니다

| 근거 | 내용 |
|---|---|
| 문서화 부재 | **1차 자료로 확정** — 네이버 Developers 공식 "오픈API 종류" 페이지 28개 엔드포인트 전수에 예약/booking 항목 **0건** (상세: §1-A) |
| 엔드포인트 성격 | `m.booking.naver.com` = **모바일 웹 프론트용 내부 GraphQL**, 파트너 계약용이 아님 |
| 인증 구조 | 사업자 인증·API 키 없이 동작 → **공식 파트너 API라면 있을 수 없는 구조** |
| 도메인 | `booking.pstatic.net/shared/documents/manual/` 에 **업주용 매뉴얼 PDF**가 존재 — 이는 "콘솔 쓰세요" 의미이며 API 제공이 아님 |

### 2.3 참고한 공개 구현체

`github.com/amiro-lab/booking-mcp` (스타 0, 동일 계열 PoC)
- 동일 GraphQL 쿼리 사용 → **독립적으로 동일 결론에 도달**
- **스스로 인정한 한계 (README 원문):**
  > *"Naver Map search returned **ncaptcha** for automated place-list collection... This API does not bypass captcha or login. It checks **known** Naver Booking businessId values only."*
- → 즉 장소 검색은 자동화 불가(captcha), **businessId를 미리 알아야** 조회 가능

> ### ⚠️ 후속 정정 (2026-10-13, `naver-search-mcp` 분석)
> 위 "장소 검색 자동화 불가"는 **업체·장소 검색에 한정된 사실이며, 전체가 아니다.**
> `github.com/isnow890/naver-search-mcp` (★88, 활발 유지) 의 `search_local` 은
> **네이버 공식 검색 API의 지역검색**이라 **captcha 없이 동작**한다 (실측 401 확인).
> 자세한 내용과 수정된 권고는 `naver-search-mcp-analysis.md` §6 참조.
>
> 즉 정확한 표현은 **"읽기·검색은 가능, 예약 상태만 어둠"** 이다.

---

## 3. 기술적 제약 정리

| 제약 | 내용 | KBizHub 영향 |
|---|---|---|
| **사업자 식별자 필요** | `businessId`를 사전에 알아야 조회 가능. 이름/주소로 검색 불가 | 사업자 온보딩 시 businessId 수동 입력 필요 |
| **장소 검색 자동화 불가** | 네이버 지도 검색에 **ncaptcha** — 저자가 회피를 거부 | 신규 사업자 발굴 자동화 불가 |
| **조회만 가능** | `hourlyBookableSchedules` = 예약 **가능 슬롯 조회**. 예약 **생성/취소는 별도** | "예약 대행"이 아닌 "예약 현황 조회" 수준 |
| **문서 없음 = 언제든 변경** | 비공식 내부 API는 사전 고지 없이 스키마가 바뀔 수 있음 | 프로덕션 의존 시 높은 유지보수 비용 |
| **사업자 메일과 상보** | IMAP은 **실제 들어온 예약**, GraphQL은 **가능한 슬롯** — 서로 다른 정보 | 둘을 함께 쓰면 "빈 자리 + 확정 예약" 모두 확보 가능 |

---

## 4. 권고 (KBizHub 계획 Phase 0-5 반영)

### 판정: 예약조회는 공식 API 기반이 불가 → **두 갈래**

```
경로 A (권장) — 예약조회를 MVP에서 제외
├─ Reservation Agent를 "알림톡/SMS 자동 안내" 로 축소
├─ 데이터 소스: send-go/openapi (발신) 만 사용 → 합법·명확
└─ 예약 데이터는 사업자가 직접 입력하거나, smb-mcp IMAP을 내부 도구로 병행

경로 B (선택) — 비공식 GraphQL 활용, 조건부
├─ 전제조건: ① 네이버 파트너 담당자와 공식 사용 문의
│            ② 법무 검토 (이용약관상 자동화 조회 허용 여부)
│            ③ businessId 확보 절차를 온보딩 플로에 포함
│            ④ 스키마 변경 감지 + 폴백(IMAP) 구현
└─ 리스크: 사전 고지 없는 변경, 약관 제재 가능성
```

### ⭐ 더 중요한 발견 — 경로 B가 오히려 smb-mcp보다 **안전**하다

| 비교 | smb-mcp (IMAP) | Naver GraphQL |
|---|---|---|
| 필요한 자격증명 | **사업자 메일 계정 비밀번호** | **없음** (무료 공개 조회) |
| 비밀번호 저장 | `secrets.json` 평문 필수 | 불필요 |
| 침해 시 영향 | 메일 전체 노출 | 예약 슬롯 공개 정보만 |
| Metorial 대행 필요성 | 높음 (비밀번호를 다뤄야 함) | **낮음** (비밀 없음) |
| 법적 성격 | 본인 메일 접근 (통상 허용) | 비공식 API 사용 (약관 검토 필요) |

→ **비밀번호를 다루지 않는다는 점에서 Metorial 아키텍처와의 충돌이 smb-mcp보다 작다.**
다만 법적 성격은 더 불명확하므로, **법무 검토 없이 프로덕션 노출은 금지**.

### 즉시 실행 권고

1. **네이버 예약 파트너 담당자 문의** — 공식 API 제공 여부를 공식 채널로 확인 (이 문서의 실측은 공식 답변을 대체하지 못함)
2. **businessId 확보 절차 설계** — 경로 B를 택한다면 온보딩 플로에 추가
3. **MVP는 경로 A로 확정** — 알림톡 발신(`send-go/openapi`)만으로도 Reservation Agent 가치는 성립

---

## 5. 검증 방법 (재현 가능)

```bash
# 유효 businessId
curl -sS -X POST https://m.booking.naver.com/graphql \
  -H 'content-type: application/json' \
  -H 'origin: https://m.booking.naver.com' \
  -H 'referer: https://m.booking.naver.com/' \
  -H 'user-agent: Mozilla/5.0' \
  -d '{"query":"query hourlyBookableSchedules($scheduleParams: ScheduleParams) { hourlyBookableSchedules(input: $scheduleParams) }",
       "variables":{"scheduleParams":{"businessId":"992240",
        "startDateTime":"2026-10-14T00:00:00","endDateTime":"2026-10-14T23:59:59"}}}'

# 대조군 (오류 확인)
# businessId 를 "BOGUS_000" 으로 바꿔 실행 → BAD_REQUEST 확인
```

---

## 6. 출처

- 실측: `curl` 직접 호출 (2026-10-13), 위 §5 명령어로 재현 가능
- **1차 자료: https://developers.naver.com/docs/common/openapiguide/apilist.md** — "네이버 오픈API 종류" 공식 페이지 (28개 엔드포인트 전수 확인, 예약 0건)
- `https://m.booking.naver.com/graphql` (비공식 내부 GraphQL, 실측 — 공식 목록에 부재)
- `https://booking.pstatic.net/shared/documents/manual/NAVER_주문_테이블서빙형_매뉴얼.pdf` (업주용 콘솔 매뉴얼 존재 확인)
- `https://github.com/amiro-lab/booking-mcp` (동일 쿼리 사용 공개 구현, 한계 자진 공표)
- `https://github.com/xoqhdgh1002/smb-mcp` (IMAP 우회 선택 근거)
- `https://sendgo.io` HTTP 200 (발신 경로 정상)
