# smb-mcp 분석 — KBizHub Metorial 통합과의 충돌 검토

> 조사일: 2026-10-13 · 출처: `github.com/xoqhdgh1002/smb-mcp` 전 소스 정독 (15개 파일)
> 대상 계획: `kbizhub-metorial-integration-plan.md`

---

## 0. 한 줄 결론

**기술 실증 가치는 있으나, KBizHub의 오픈 MCP 전략과 정면으로 충돌한다.**
내부 도구로는 쓸 만하나, Business MCP 공개 엔드포인트 뒤에 두면 안 된다.

---

## 1. 성숙도 실측 (낙관하지 말 것)

| 항목 | 실측치 |
|---|---|
| 저장소 크기 | **11 KB** / 파일 15개 |
| 언어·스택 | Python 3.10+, `mcp` (Anthropic FastMCP), pydantic, pytest |
| 스타 / 포크 / 이슈 | **0 / 0 / 0** |
| 생성일 / 최종 푸시 | **2026-05-02 생성 → 같은 날 4초 차이로 마지막 커밋** → 단일 세션 방출 후 **중단** |
| 계획 5개 커넥터 | **실구현 1개** (naver-booking). `kakao-biz`·`naver-store`·`toss-pay`·`baemin` = **디렉토리조재 없음** |
| 테스트 | 1개 파일 / **합성 fixture 전용** — 실제 네이버 메일 0건 |
| 라이선스 | 루트 LICENSE = **MIT (태봉호)**. 그러나 README엔 *"진행 중. 검토 후 결정"* → **문서 불일치** |
| 문서 무결성 | README가 `research/`, `shared/` 경로를 명시하나 **존재하지 않음** |
| 실행 경로 오류 | `cd test/smb-mcp/connectors/...` — 작성자 **로컬 임시 경로가 그대로 박혀있음** |

**⚠️ README 자체 인정:** `## 한계 (정직한 PoC 표시)`
- 네이버 이메일 포맷 변경 시 파서 수정 필요
- **IMAP은 push 알림 없음 → 실시간성 떨어짐 (폴링 필요)**
- 답글 발송 미지원
- 공식 API가 아니므로 약관 검토 필요

→ PoC이며 그마저도 자진 중단 상태. **프로덕션 도입 불가.**

### 다만 코드 품질은 양호
타입힌트 전면, pydantic 모델, `@contextmanager` 연결 정리, 방어적 `try/except`, 5분 TTL 메모리 캐시. **설계 의도는 명확하고 읽을 만하다.** 재작성하느니 커널만 발췌하는 편이 낫다.

---

## 2. ⚠️ 핵심 충돌 — Metorial/KBizHub 전략과 반대 지점

README 배경에 저자 스스로 이렇게 적었다:

> 한국 디지털 정보 접근 **회색지대** → 공식 API 부재 영역이 많음
> 그러나 **우회 경로(이메일 알림, 공개 API, RPA)**는 존재
> **baemin — 보류 (약관 회색지대)**

naver-booking은 **네이버 예약 공식 API가 부재**하므로 **사업자 IMAP 메일을 파싱**해 MCP 도구로 노출한다.

| KBizHub 계획 (이 문서) | smb-mcp 현실 |
|---|---|
| Business MCP = **"Zero-Trust"**, 외부 AI 에이전트가 **직접 호출**하는 오픈 엔드포인트 | 커넥터가 요구하는 것은 **특정 사업자의 메일 계정 비밀번호** |
| Metorial = 자격증명을 **표준화된 방식으로 안전 대행** | IMAP 비밀번호를 Metorial에 맡긴다는 건 **"안전 대행"이 아니라 "우회 접근 권한의 집결"** |
| Human Expert Escrow로 **신뢰**를 구축 (법률 전문가 검증) | 배민을 *"약관 회색지대"* 로 보류한 저자 스스로 회색지대를 인정 |
| KBizHub = ₩29,000 **합법적 사업자 도구** | 공식 API 부재 영역 우회 = **플랫폼 약관 리스크를 고객에게 전가** |

**→ 그대로 채택하면 KBizHub가 세우려는 신뢰 기반과 정면충돌한다.**


---

## 3. 그런데도 가치가 있다 — 3가지 실질 기여

### ① `send-go/openapi`와 직교 → "예약 → 자동 안내" 루프 완성
| 저장소 | 담당 | 인터페이스 |
|---|---|---|
| **smb-mcp** (naver-booking) | **예약 수신** | IMAP 메일 파싱 |
| **send-go/openapi** | **고객 안내 발신** | 카카오 알림톡 / SMS |

KBizHub README의 `예약 → 알림톡 자동 안내` 흐름이 **두 저장소 합치면 양끝이 다 채워진다.** smb-mcp 원래 개발 순서 1→2번이 정확히 이 조합이다.

### ② 도구 설계가 사업자 운영에 실제로 맞음
`list_bookings`·`get_booking`·`search_bookings`·`today_checkins`·`summary`
→ Reservation Agent(₩14,900/월)의 도구 정의로 그대로 참고 가능. **도구 스키마 설계 선례**로서 가치가 있다.

### ③ IMAP은 특정 플랫폼 비종속
네이버 예약만이 아니라 구글·다음·자체 도메인 메일의 예약 알림을 모두 흡수한다. 네이버 전용 하드코딩이 아닌 **범용 메신저 레이어**다.

---

## 4. 기술 세부 (재작성 시 참고)

**노출 도구 5개** (`server.py`, `@mcp.tool()` 데코레이터)

| 도구 | 역할 | 주의 |
|---|---|---|
| `list_bookings(days_ahead=30, refresh=False)` | 향후 N일 확정 예약 | `status != confirmed` 제외, 체크인 ±범위 필터 |
| `get_booking(booking_id)` | 단건 상세 | 전체 캐시 선형탐색 |
| `search_bookings(query)` | 게스트명/전화/메모 검색 | 부분일치 `in` 매칭 |
| `today_checkins()` | 금일 체크인 목록 | |
| `summary()` | 메일함 요약 (총/확정/취소/예정/다음체크인) | |

**설정 주입 2중 경로**
1. `~/.openclaw/secrets.json` → `naver_booking_imap` 블록
2. env: `NAVER_BOOKING_IMAP_HOST/_USER/_PASSWORD/_PORT/_MAILBOX`
→ 둘 다 없으면 `RuntimeError` (한글로 원인 명시). **구조는 건전.**

**데이터 모델** (`Booking`, pydantic)
`booking_id`(Message-ID) · `received_at` · `guest_name` · `guest_phone` · `party_size` · `checkin` · `checkout` · `place_name` · `memo` · `status` · `raw_subject`

**파서 전략** (`parser.py`)
- 제목 키워드 6종: `네이버 예약`·`스마트플레이스`·`예약 신청`·`예약 확정`·`예약이 접수`·`[NAVER]`
- 본문 라벨 정규식 7종: 예약자/연락처/인원/업소/요청사항/체크인/체크아웃
- **IMAP SEARCH는 `SINCE` 만 사용**, 한글 SUBJECT 검색은 클라이언트 필터 — *"UTF-8 charset 한글 SUBJECT 검색은 서버에 따라 다름, 안정 우선"*. **이 판단은 옳다.**
- multipart: `text/plain` 우선 → 폴백 `text/html` 태그제거

---

## 5. KBizHub 계획에 대한 영향 및 권고

### 리스크 표 추가 항목

| 리스크 | 심각도 | 대응 |
|---|---|---|
| **예약 데이터 소스가 공식 API 부재** — 네이버 예약 API 미공개, IMAP 우회에 의존 | 🔴 높음 | 공식 API 존재 여부 **최우선 확인**. 없으면 내부 도구로 격리 |
| **회색지대 커넥터를 공개 MCP에 노출** — KBizHub Zero-Trust 주장과 충돌 | 🔴 높음 | Business MCP 공개 엔드포인트에서 **제외**. 내부 운영 도구로만 |
| **IMAP 비밀번호 평문 저장** — Metorial 도입 취지와 반하는 보안 수준 | 🟠 중 | Metorial 비밀 저장소로 이관, 또는 사용 자체를 제한 |
| **다중 사업자 캐시 교차 오염** — 전역 메모리 캐시 | 🟠 중 | 사업자별 캐시 키 분리, Redis 등 외부 캐시 검토 |
| **파서 포맷 취약** — 실제 메일 0건 검증 | 🟠 중 | 실데이터 스냅샷 회귀 테스트 구축 후 사용 |
| 프로젝트 중단 (2026-05-02 이후 무활동) | 🟡 낮 | MIT이므로 **커널 포크 후 자체 유지보수** |

### 3단계 활용 권고

```
1단계  내부 도구로 사용 ⭕
       KBizHub 자체 사업장 운영. "사업자 본인 메일 접근은 통상 허용" (저자 주장)
       → 예약 현황 파악용. 고객에게 노출 금지

2단계  네이버 공식 파트너 API 확인 🔍  ← 가장 중요
       네이버 스마트플레이스 파트너 API / 예약 제휴 채널 존재 시
       → smb-mcp 전체가 불필요해짐. 이걸로 대체

3단계  공개 MCP 노출 ❌ (현재 상태로는 불가)
       전제조건: ① 공식 API 확보 ② Metorial 자격증명 대행
                ③ 파서 실데이터 검증 ④ 약관 법무 검토
       → 4가지 모두 충족 전까지 Business MCP에서 제외
```

### 핵심 판단

**smb-mcp는 "안 되는 이유"를 알려주는 저장소이지, "되는 방법"을 알려주는 저장소가 아니다.**

- **기술 실증**: 한국 플랫폼을 MCP로 감싸는 것이 가능하다는 점, 그리고 **예약 수신 + 알림톡 발신 루프가 완성 가능**하다는 점을 보여줬다
- **그러나**: 공식 API 부재라는 구조적 한계가 그대로 남아있고, 이것은 smb-mcp가 아니라 **네이버의 정책** 문제다
- **따라서**: 도구 스키마 설계 참고자료 + 내부 운영 도구로서는 가치가 있으나, KBizHub가 내세우는 Zero-Trust·Human Expert Escrow 신뢰 모델과는 **공존할 수 없다**

**KBizHub 계획(KB-01) 수정 제안:**
> Phase 0에 **"네이버 예약 공식 API 존재 확인"** 항목을 신설하고,
> Reservation Agent의 예약 데이터 소스를 smb-mcp IMAP이 아닌 **공식 API 우선**으로 전제하도록 수정.
> 공식 API가 없다면 Reservation Agent의 예약 조회 기능을 **범위 외**로 분리하고,
> 알림톡 발신(`send-go/openapi`)만으로 MVP를 축소.

---

## 6. 출처

- https://github.com/xoqhdgh1002/smb-mcp (README.md, LICENSE, connectors/naver-booking/ 전 소스)
  - `README.md` · `connectors/naver-booking/README.md`
  - `src/naver_booking/{server,config,parser,imap_client,models}.py`
  - `tests/test_parser.py` · `pyproject.toml`
- GitHub API 저장소 메타 (2026-10-13 기준)
- 비교 기준: `send-go/openapi` OpenAPI 3.0.3 (2026-10-13 확인)
- 대상 계획: `kbizhub-metorial-integration-plan.md`

- docstring에 *"휴리스틱 + 폴백 구조, 실 데이터로 테스트하며 점진 보강"* → **미완성 자진 공표**

### 재작성 시 반드시 고칠 4가지
1. **파서 취약** — 라벨 정규식만으로 실제 메일 포맷 변동에 취약. 스냅샷 회귀 테스트 필수
2. **캐시가 프로세스 메모리** — `_CACHE` 전역 dict. 다중 사업자/다중 워커 환경에서 **교차 오염 위험**
3. **폴링 의존** — IMAP push 없음. `today_checkins` 최대 5분 지연 가능
4. **비밀번호 평문 취급** — `secrets.json`/env 에 IMAP 비밀번호 직접 저장. Metorial 구조 대비 **보안 수준 크게 떨어짐**
