# different-ai/openwork 소스 분석 → GoLive 차용 계획

> **요청:** openwork.network은 비공개이므로, 오픈소스 대안 `different-ai/openwork`를 분석해 GoLive.wiki에 차용할 소스를 추출·적용.
> **상태:** 분석 완료 · 차용 코드 생성
> **작성일:** 2026-10-24

---

## 0. 라이선스 (먼저 확인 — 이게 차용 가능 여부를 결정)

```text
MIT License

Copyright (c) 2024 Different AI, Inc.
...
The "ee" (enterprise) directory and `@openwork/ee-*` packages are source-available
under a separate license. Code outside those paths is MIT.
```

| 경로                         | 라이선스         | 차용 가능          |
| ---------------------------- | ---------------- | ------------------ |
| `packages/connect-link`      | **MIT**          | ✅ **가능**        |
| `packages/automations`       | **MIT**          | ✅                 |
| `packages/sandbox`           | **MIT**          | ✅                 |
| `packages/evidence-provider` | **MIT**          | ✅                 |
| **`ee/`, `packages/ee-*`**   | source-available | ❌ **복사 금지**   |
| `apps/desktop` (Electron)    | MIT              | ⚠️ 아키텍처가 다름 |

> **원칙: `ee/` 디렉터리는 열지도 않는다.** MIT 부분만 참조한다.

---

## 1. 분석 범위와 선정 기준

전체 **3,817개 TS/TSX 파일**입니다. 전부 볼 수 없으므로 **"GoLive의 지금 결함과 직접 겹치는 코드"** 만 골랐습니다.

| GoLive의 결함                           | openwork 대응 모듈                           | 판정             |
| --------------------------------------- | -------------------------------------------- | ---------------- |
| `claim_url`을 안전하게 서명·검증해야 함 | `packages/connect-link`                      | ⭐ **최우선**    |
| 글라스 이벤트 재전송 멱등성             | `packages/automations` (occurrence identity) | ⭐ **최우선**    |
| 드론 `worktree` 격리 실행               | `packages/sandbox` (stable identity + adopt) | ⭐ 높음          |
| 환경변수 오타 시 조용한 폴백            | `packages/evidence-provider` (fail-closed)   | ⭐ 중간          |
| 에이전트가 쓰는 로컬 파일 도구          | `apps/desktop`                               | ❌ 데스크톱 전용 |
| Skills / MCP 공유                       | `packages/agent-sandbox` 등                  | ⚠️ GoLive 불필요 |

---

## 2. 차용 1 — Ed25519 서명 링크 (`connect-link`)

### 2.1 openwork 방식

```ts
// packages/connect-link/src/node.ts
export function generateConnectLinkKeyPair(): ConnectLinkKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}
```

**우리 `claim_url` 문제를 정확히 해결합니다.**

현재 우리는 claim 코드를 **DB에 해시로 저장**하고 조회합니다(0005). 이건 안전하지만:

| 문제              | 우리 현재  | openwork           |
| ----------------- | ---------- | ------------------ |
| DB 조회 필요      | ✅ 매 요청 | ❌ **서명 검증만** |
| 코드 위조         | 해시 대조  | Ed25519            |
| 만료              | DB 컬럼    | **토큰 `exp`**     |
| 멱등성            | `used_at`  | `jti`              |
| 앱 이름·로고 전달 | 불가       | **토큰에 포함**    |

### 2.2 채택 판단: **부분 채택**

**전부 채택하지 않습니다.** 이유:

- openwork는 **데스크톱 앱**에 연결하는 딥링크용입니다. 우리는 **브라우저** claim 페이지입니다.
- **DB 기반 1회용 코드가 우리에게 더 적합합니다.** 이유: 우리는 claim 후 `owner_id`를 영구 저장해야 하고, 재사용 차단이 DB에 있어야 감사가 쉽습니다.

**따라서 채택할 것은 3개뿐:**

1. **Ed25519 서명** (DB 조회 없이 1차 검증 → DB 부하 감소)
2. **`jti` + `exp`** (토큰 자체에 만료·식별자)
3. **HTTPS 강제 + loopback 예외** (SSRF 방지)

```ts
// packages/connect-link/src/index.ts — 이 함수가 핵심
export function findRefusedConnectLinkUrl(
  claims,
  allowInsecureLoopback = false,
): string | null {
  const candidates = [
    claims.den.baseUrl,
    claims.den.apiBaseUrl,
    claims.brand.logoUrl,
    claims.brand.iconUrl,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return candidate;
    }
    if (
      parsed.protocol !== "https:" &&
      !(allowInsecureLoopback && isLoopbackUrl(candidate))
    )
      return candidate;
  }
  return null;
}
```

**이 함수가 막는 것:** 관리자가 악의적인 `logoUrl`을 넣어 서버가 내부 주소를 fetch하게 만드는 SSRF.

---

## 3. 차용 2 — 멱등성 있는 실행 식별자 (`automations`)

### 3.1 openwork 방식

```ts
export function automationOccurrenceIdentity(input): {
  occurrenceId;
  idempotencyKey;
} {
  if (input.scheduledFor === null && !input.nonce)
    throw new Error("A manual occurrence needs a nonce");
  const occurrence =
    input.scheduledFor === null
      ? `manual:${input.nonce}`
      : String(input.scheduledFor);
  const stable = [input.automationId, occurrence]
    .map(encodeURIComponent)
    .join(":");
  return {
    occurrenceId: `automation-occurrence:${stable}`,
    idempotencyKey: `automation:${stable}`,
  };
}
```

### 3.2 우리 문제와의 대응

우리 글라스 이벤트는 `client_event_id`를 클라이언트가 보냈습니다. **openwork는 더 엄격합니다:**

| 우리 방식              | openwork                               | 개선점             |
| ---------------------- | -------------------------------------- | ------------------ |
| `clientEventId` (선택) | **필수** (manual이면 `nonce` 강제)     | **누락 불가**      |
| 문자열 ID              | `automationId + occurrence` **정규화** | 충돌 없음          |
| —                      | `encodeURIComponent` 구분자            | `:` 포함 ID도 안전 |
| —                      | **stable digest** (FNV)                | 내용 변경 감지     |

**핵심 차이:** 우리는 클라이언트가 ID를 안 보내면 **중복이 생깁니다.** openwork는 **"ID 없으면 거부"** 입니다.

> **채택:** 우리 `addEvent`에 **`clientEventId` 필수화** + 정규화 함수 도입.

---

## 4. 차용 3 — 샌드박스 stable identity (`sandbox`)

```ts
export function sandboxName(scope: string, job: string, key: string): string {
  const prefix = (`${scope}-${job}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-")...);
  const hash = createHash("sha256").update(JSON.stringify([scope, job, key])).digest("hex").slice(0, 24);
  return `${prefix}-${hash}`;
}

export async function ensure(provider, spec, opts) {
  const existing = await provider.find({ idempotencyKey: spec.idempotencyKey, labels: spec.labels });
  if (existing && existing.state !== "missing") return existing;
  try {
    return await provider.create(spec, opts);
  } catch (error) {
    if (!isSandboxError(error) || error.code !== "conflict") throw error;
    const adopted = await provider.find({ idempotencyKey: spec.idempotencyKey, labels: spec.labels });
    if (!adopted) throw error;   // ← "blindly repeat create" 하지 않음
    return adopted;
  }
}
```

**우리 드론 worktree에 그대로 적용 가능합니다.**

| 우리 현재 (`DADABOT-AUTONOMOUS-DESIGN.md` §6) | 문제                     | openwork             |
| --------------------------------------------- | ------------------------ | -------------------- |
| `workspace/job-$(date +%s)`                   | **같은 초에 2개면 충돌** | `scope+job+key` 해시 |
| 생성 실패 시 즉시 에러                        | 일시 오류에 취약         | **conflict면 adopt** |
| 재시도 없음                                   | 재시도 허용              |

---

## 5. 차용 4 — fail-closed 환경변수

```ts
export function evidenceProviderFromEnv(env = process.env): EvidenceProviderId {
  const raw = env[EVIDENCE_PROVIDER_ENV]?.trim().toLowerCase();
  if (!raw) return DEFAULT_EVIDENCE_PROVIDER;
  if (isEvidenceProvider(raw)) return raw;
  throw new Error(
    `${EVIDENCE_PROVIDER_ENV} must be one of ... (got "${raw}").`,
  ); // ← 조용한 폴백 없음
}
```

**우리 문제와 직결:** `DEPLOY-A.md`에서 "`.env`가 로드 안 되면 `(memory)`로 뜬다"는 결함이 있었습니다. **오타 난 환경변수가 조용히 기본값으로 가는 것이 근본 원인입니다.**

---

## 6. 생성할 코드 (GoLive용 재작성)

MIT 코드를 **그대로 복사하지 않고 구조만 차용**해 우리 스택(Node ESM, 의존성 최소)으로 다시 씁니다.

| 파일                                  | 역할                                   | 출처              |
| ------------------------------------- | -------------------------------------- | ----------------- |
| `server/security/connect-link.mjs`    | Ed25519 서명 claim 링크 + SSRF 가드    | connect-link      |
| `server/security/idempotency.mjs`     | 정규화된 실행 식별자                   | automations       |
| `server/security/fail-closed-env.mjs` | 환경변수 검증                          | evidence-provider |
| `server/agent-link.mjs`               | claim_url 발급·검증 (기존 0005와 연동) | connect-link      |
| `server/security/*.test.mjs`          | 테스트                                 | —                 |

---

## 7. 적용 순서

| 단계  | 작업                                       | 위험     | 롤백      |
| ----- | ------------------------------------------ | -------- | --------- |
| **1** | `idempotency.mjs` + `clientEventId` 필수화 | 중간     | 플래그    |
| **2** | `fail-closed-env.mjs` 적용                 | **낮음** | 즉시      |
| **3** | `connect-link.mjs` (Ed25519)               | 낮음     | 파일 삭제 |
| **4** | `agent-link.mjs`로 claim_url 교체          | 중간     | 기존 유지 |
| **5** | worktree 이름 `sandboxName()` 방식으로     | 낮음     | —         |

---

## 8. 채택하지 않는 것

| 모듈                       | 이유                                                 |
| -------------------------- | ---------------------------------------------------- |
| `ee/`, `ee-*`              | **라이선스: 복사 금지**                              |
| `apps/desktop` (Electron)  | GoLive는 브라우저. 아키텍처 불일치                   |
| Skills / MCP 공유          | 우리는 MCP를 별도로 이미 계획(`mcp/bash`)            |
| 50+ LLM provider           | 우리는 `token-free-gateway`로 확정                   |
| W3C Verifiable Credentials | GoLive에 과잉. `competences` JSON으로 충분           |
| Trajectory Matching        | **미확인** — 이 저장소에 없음(openwork.network 기능) |

---

## 9. 이 계획이 보장하지 않는 것

- **3,817개 파일 전체를 읽지 않았습니다.** 선정 기준(§1)에 해당하는 **5개 패키지만** 읽었습니다. 다른 곳에 더 나은 패턴이 있을 수 있습니다.
- **실행 검증은 생성한 코드에 대해서만** 합니다. openwork 원본 코드를 실행해보지 않았습니다.
- **`ee/` 내용을 보지 않았습니다.** 볼 이유도 없고(라이선스), 보면 차용 범위 판단이 오염됩니다.
- **openwork.network(W3C 자격증명·Trajectory Matching)는 이 저장소에 없습니다.** 별개 제품입니다.
