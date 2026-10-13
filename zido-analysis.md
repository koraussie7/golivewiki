# zido (miyu4u/zido) 분석 — KBizHub 통합 후보

> 조사일: 2026-10-13 · 방법: GitHub 원문(README + provider-router + input-validation + naver.vendor) 직접 분석
> 결론: **KBizHub 계획의 businessId 확보 문제를 공식 네이버 API로 해결하는 핵심 조각.**

---

## 0. 한 줄 요약

`zido`는 **Kakao / Naver / Google 지도 API를 공통 인터페이스로 묶어** 장소 검색(resolve)·주변 검색(nearby)·지오코딩(geocode)을 제공하는 **MCP + CLI 애플리케이션**이다. NestJS 기반 Nx monorepo이며, stdio와 Streamable HTTP transport를 모두 지원한다.

---

## 1. 기본 정보

| 항목 | 내용 |
|---|---|
| 저장소 | `miyu4u/zido` |
| 성격 | 장소 검색·지오코딩 MCP + CLI (멀티 프로바이더) |
| 스택 | NestJS, Nx monorepo, TypeScript, **streamable HTTP + stdio** |
| 프로바이더 | Kakao(로컬) / Naver(검색·지오코딩) / Google(Places·Geocoding) |
| Transport | stdio (로컬 클라이언트) + **Streamable HTTP** (원격, stateful session) |
| 라이선스 | **MIT** (© 2026 miyu4u) — 상업적 사용·수정·재배포 허용. README엔 LICENSE 섹션이 없으나 LICENSE 파일·package.json 모두 MIT로 확인 |

---

## 2. 왜 중요한가 — Phase 0-5 문제를 정면으로 해결

`phase0-5-naver-booking-api.md`에서 확정한 3가지 제약:

| 제약 | zido 이전 | zido 도입 후 |
|---|---|---|
| **businessId 확보** | 미확보 — 조회 불가 | ✅ **resolve/nearby로 businessId 자동 확보 가능** |
| **장소 검색 자동화 불가** | m.booking GraphQL에 captcha | ✅ **카카오/네이버/구글 공식 검색 API 우회** |
| **비공식 API 의존** | m.booking.naver.com/graphql (무인증) | ✅ **`openapi.naver.com` 공식 API 전환 가능** |

**핵심:** zido의 Naver 어댑터는 `openapi.naver.com/v1/search` (검색)와 `naveropenapi.apigw.ntruss.com/map-geocode/v2` (지오코딩)를 쓴다 — **둘 다 네이버 공식 Open API**다. 즉 `amiro-lab/booking-mcp`가 우회하려던 captcha를 **정식 키로 해결**한다.

> 따라서 조합은: **zido(공식 지도 검색 → businessId 확보) → Naver booking 슬롯 조회**. 후자만 비공식 의존이 남는다(§5 참조).

---

## 3. 아키텍처 (장점)

```
apps/http-server  ─┐
apps/stdio-server ─┼─ mcp-runtime ─┐
                  │                ├─ libs/map-providers (Kakao/Naver/Google + fallback)
                  │                └─ libs/place-domain (haversine)
                  └─ libs/common (config, input-validation, errors, logger)
```

### 3.1 프로바이더 폴백 라우팅 (`provider-router.ts`)
- `PROVIDER_ORDER` 순서대로 초기화, **키 없는 프로바이더는 스킵**
- 각 호출이 실패하면 **다음 프로바이더로 자동 fallback**, 첫 비어있지 않은 결과 반환
- 전원 실패 시 오류를 `McpException`으로 합침
  - 전원이 `AUTHENTICATION_FAILED` → `AUTHENTICATION_FAILED`
  - 그 외 → `NO_PROVIDER_AVAILABLE`
- 프로바이더 0개면 `NO_PROVIDER_CONFIGURED` 로 **명시적 설정 오류**

→ **신뢰성 설계가 성숙**하다. 단일 프로바이더 장애가 곧 서비스 장애로 이어지지 않는다.

### 3.2 입력 검증 (`input-validation.ts`)
- `validateStringLength` — 타입 + 길이 범위
- `sanitizeString` — `< >`, `javascript:`, `on\w+=` 제거 후 trim (범용 sanitizer 아님을 주석에 명시)
- `validateCoordinates` — 위경도 범위 + NaN/Infinity 배제
- `validateRadius` — 0 < r ≤ **50km**, 유한수

→ MCP 오픈 엔드포인트에서 특히 중요한 **좌표·반경·검색어 검증이 견고**하다.

---

## 4. KBizHub 통합 포인트

| KBizHub 니즈 | zido가 주는 것 |
|---|---|
| "내 가게 위치 기준 반경 안 고객" | `searchNearby(lat,lng,keyword,radiusM)` |
| 주소 → 좌표 (가게 좌표) | `geocode(address)` |
| "강남역 카페" → 좌표·장소 | `resolve(query)` |
| 원격 에이전트 노출 | Streamable HTTP (stateful session, `MCP-Session-Id`) |
| 공식 데이터 사용 (법적 안전) | Naver 공식 Open API (`openapi.naver.com`) |

**businessId 확보 플로우 (제안):**
```
resolve("가게명") → Place(businessId 후보)
  → m.booking.naver.com/graphql (슬롯 조회)   [이 단계만 비공식]
```
또는 zido의 resolve 결과를 KBizHub 온보딩에서 **사업자에게 확인받아 저장** → 비공식 호출 최소화.

---

## 5. 리스크 & 주의

| 리스크 | 상세 | 대응 |
|---|---|---|
| 🟢 라이선스 | **MIT으로 확인 완료** — GitHub API가 `mit`으로 분류, LICENSE 본문 MIT 원문, package.json `"license": "MIT"`. 상업 사용 가능하나, KBizHub 고유 코드와 혼용 시 귀속 표기 권장 |
| ⚠️ **Session registry = process-local** | README 명시: *"여러 instance로 운영 시 sticky session 또는 shared store 필요"* | KBizHub 멀티 인스턴스 시 Redis 등 외부 세션 저장소 연결 |
| 🔴 **여전히 비공식 booking 호출 잔존** | 슬롯 조회는 여전히 m.booking GraphQL. zido는 businessId 확보만 해결 | 슬롯 조회는 내부 도구로 제한(기존 권고 유지), 공식 파트너 API 확인 |
| 🟡 **API 키 필요** | Kakao/Naver/Google 키 발급 필요 (무료이나 발급 절차) | KBizHub BYOK 정책과 정합 (사업자 자기 키) |
| 🟡 **프로바이더 비용** | Google Places는 사용량 과금 | fallback 순서를 kakao,naver 우선으로 두면 비용 억제 |
| 🟢 sanitize 한계 | 주석 자인: 범용 HTML sanitizer 아님 | 추가 검증 레이어는 KBizHub 게이트웨이에서 (기존 Zero-Trust) |

---

## 6. 평가 및 권고

**적합도: 높음.** 다만 용도가 다르다.

- smb-mcp / amiro booking-mcp = "예약 데이터 직접 확보" (비공식·우회)
- **zido = "위치·좌표·장소 인프라" (공식 API)**

즉 zido는 예약 조회를 대체하지 않고, **그 전단계(businessId·좌표 확보)를 공식적으로 메우는 인프라 레이어**다. KBizHub의 "MCP 오픈 엔드포인트" 전략에 쓰이려면:

1. **외부 에이전트 노출 전** — `resolve/nearby/geocode` 를 KBizHub Gateway 뒤에 두고, zido API 키는 **KBizHub 서버가 보관**(사업자/외부 에이전트에게 키 비노출)
2. **businessId는 zido resolve 후 사람 확인** — captcha 우회가 아닌 공식 확보라 신뢰 가능
3. **booking 슬롯 조회는 계속 내부 전용** — 비공식 의존 제거 전까지 공개 금지(기존 0-6 유지)
4. **session 외부 저장소** — 멀티 인스턴스 확장 시 Redis 등 연결(README 자인 제약)

**라이선스(MIT)는 도입을 막는 장애물이 아니다.** Phase 0-5의 "businessId 확보 불가"를 해결한다는 점이 더 중요하다.

---

## 7. 출처

- `https://github.com/miyu4u/zido` (README.md, provider-router.ts, input-validation.ts, naver.vendor.ts 원문)
- 교차 검증: `phase0-5-naver-booking-api.md` (비공식 GraphQL 실측), `smb-mcp-analysis.md`, `naver-search-mcp-analysis.md`
- 네이버 공식 API: `https://openapi.naver.com/v1/search`, `https://naveropenapi.apigw.ntruss.com/map-geocode/v2`
