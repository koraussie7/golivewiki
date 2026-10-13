# sendgo-mcp

KBizHub Business MCP 서버 — **카카오 알림톡 / SMS** 발송.

`send-go/openapi` (OpenAPI 3.0.3, 58개 엔드포인트)를 기반으로, KBizHub 예약 안내
루프에 필요한 **4개만 선별 노출**한다. 표면을 최소화하는 것이 Zero-Trust 원칙에 부합.

| 도구 | 근거 엔드포인트 | 용도 |
|---|---|---|
| `list_kakao_senders` | `GET /alimtalk/message/senders` | 발신프로필(채널) 조회 |
| `list_alimtalk_templates` | `GET /alimtalk/templates` | 승인된 템플릿 + 변수명 조회 |
| `send_alimtalk` | `POST /alimtalk/messages` | 알림톡 발송 (+ SMS 자동 대체) |
| `get_message_result` | `GET /alimtalk/messages/{messageId}` | 발송 결과 조회 |

## 설치

```bash
cd sendgo-mcp
npm install
```

외부 런타임 의존성 0개 — Node 18+ 내장 `fetch` 사용. MCP SDK만 필요.

## 자격증명 (환경변수만)

| 변수 | 필수 | 설명 |
|---|---|---|
| `SENDGO_ACCESS_KEY` | ✅ | 발급받은 access key |
| `SENDGO_SECRET_KEY` | ✅ | 발급받은 secret key |
| `SENDGO_API_VERSION` | | `v1` \| `v2` (기본 `v2`) |
| `SENDGO_BASE_URL` | | 기본 `https://sendgo.io` |
| `SENDGO_KAKAO_SENDER_KEY` | | 기본 발신프로필 (요청마다 줄 수도 있음) |

> **키를 인자·설정 파일·Git 에 넣지 마세요.** 환경변수 또는 시크릿 매니저로만 주입.
> 인증은 `accessKey:secretKey` Base64 Basic 으로 토큰을 발급받아 Bearer 로 호출한다.
> (v1 은 토큰을 한 번 더 Base64 인코딩 — `client.mjs` 가 버전별로 처리)

## Claude Desktop 연동

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sendgo": {
      "command": "node",
      "args": ["/절대/경로/sendgo-mcp/src/server.mjs"],
      "env": {
        "SENDGO_ACCESS_KEY": "${SENDGO_ACCESS_KEY}",
        "SENDGO_SECRET_KEY": "${SENDGO_SECRET_KEY}",
        "SENDGO_API_VERSION": "v2"
      }
    }
  }
}
```

키는 셸 프로파일에서 export 한 뒤 참조하거나, 1Password/Doppler 등 시크릿 주입기를 거쳐라.

## 사용 흐름

```
1. list_kakao_senders          → 발신프로필 키 확보
2. list_alimtalk_templates     → templateCode + variableKeys 확인
3. send_alimtalk               → 변수명 정확히 맞춰 발송
4. get_message_result          → 실결과 확인 (카카오 측 비동기)
```

`send_alimtalk` 은 템플릿을 먼저 조회해 **`#{var}` 키를 추출**하고, 누락·초과 변수를
발송 전에 거절한다. 카카오 검수 단계에서 반려당하는 것을 API 호출 전에 막는다.

## 설계 결정

| 결정 | 이유 |
|---|---|
| 엔드포인트 4개만 노출 | 58개 중 예약 안내에 필요한 것만. 공격면·토큰 비용 최소화 |
| `fallbackSms` 90바이트 검사 | 초과 시 LMS 승격 필요 → `subject` 없으면 사전 거절 |
| 템플릿 변수 사전 검증 | 누락 변수는 카카오 검수에서 반려. 호출 전에 잡는 편이 빠름 |
| 에러 메시지 마스킹 | `redact()` 로 키·Bearer·Basic 값 제거. 변수명은 유지 |
| 키 없이도 서버 기동 | 클라이언트가 도구 목록은 봐야 하므로, 호출 시에만 실패 |
| 토큰 50분 캐시 + 401 재시도 | Sendgo 토큰 24시간. 재발급 최소화하되 만료에 안전 |

## 검증

```bash
npm run inspect   # 예정 — OpenAPI 스펙과 도구 목록 대조
node scripts/smoke-test.mjs
```

스모크 테스트는 **실제 MCP 프로토콜(stdio)** 로 서버를 띄워 검증한다. 외부 API 호출
없음(키 불필요): 핸드셰이크 · `tools/list` · 에러 경로 · 입력 검증 · 마스킹.

```
[sendgo-mcp] 19 passed / 0 failed
```

## 범위 외 (의도적)

- **예약 생성/취소** — Sendgo 는 발송만. 예약 데이터는 사업자가 입력하거나 별도 소스
- **네이버 예약 조회** — 공식 API 부재. `../phase0-5-naver-booking-api.md` 참조
- **브랜드메시지(구 친구톡)** — 마케팅성. KBizHub 은 정보성 알림톡에 집중
- **결제·에스크로** — Metorial 계층의 몫

## 한계

- **실제 Sendgo 호출은 미검증.** 키가 없어 발송 경로는 로컬에서 테스트하지 못했다.
  첫 실사용 전 `list_kakao_senders` 로 연결을 확인하세요.
- 엔드포인트 경로는 OpenAPI 3.0.3 스펙 기준이나, 실제 응답 래퍼(`data.token` vs
  `data.access_token` 등)는 **스펙에 명시되지 않아** 양쪽 형태를 모두 처리했다.
  실응답을 확인한 뒤 불필요한 분기를 제거하세요.

## 출처

- `send-go/openapi` — OpenAPI 3.0.3, 58 엔드포인트 (근거)
- `send-go/node` — `@sendgo/node` SDK v1.6.0, MIT (인증·토큰 관리 방식 참조)
- `sendgo.io` — HTTP 200 확인
- 상세 조사: `../phase0-5-naver-booking-api.md`
