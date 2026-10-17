# Golive.wiki / Agent Marketplace — Architecture & Implementation Spec

> Consolidated from the design artifacts reviewed in this session (layer view, flow view, topology view, service/API table, implementation spec).
> Verified against the live repo at `/tmp/golivewiki` (repo: `github.com/koraussie7/golivewiki`) and the running DB on `localhost:5433`.

---

## 0. Status Summary

| Artifact                                         | Status                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| golive.wiki integration (backend ↔ web ↔ mobile) | ✅ **Verified working** — full auth round-trip passes, both clients typecheck + build clean |
| Platform structure (current)                     | ✅ Mapped — see `PLATFORM-STRUCTURE.md`                                                     |
| Target architecture (Agent Marketplace)          | ✅ Designed (this doc)                                                                      |
| **Implementation**                               | ❌ **Not started**                                                                          |
| **DB capability**                                | ❌ **Blocker** — PostGIS + pgvector unavailable                                             |

### 🚧 Two blockers before any implementation

1. **DB rejects the spec schema.** Postgres is stock `postgres:16`. Available: `pg_trgm` only.
   `postgis` ❌ absent · `vector` (pgvector) ❌ absent
   → every `GEOGRAPHY`, `ST_DWithin`, `VECTOR(1536)`, `ivfflat` query in the spec **will not run**.
2. **No `matches` table, no impression logging.** The ML ranking model has **zero training data**. Ranking cannot be tuned until match → impression → outcome is recorded.

---

## 1. Three Views of One System

### 1.1 Logical Layers (capabilities)

```
┌──────────────────────────────────────────────────────────────┐
│                    Agent Marketplace                         │
├──────────────────────────────────────────────────────────────┤
│  1. Agent Registry                                           │
│     · Capability Profile (스킬, 입출력 스키마, 가격)         │
│     · 신뢰/평판 점수                                         │
│     · 버전 & 권한 범위                                       │
│                                                              │
│  2. Discovery & Matching                                     │
│     · Semantic Search (벡터)                                 │
│     · Capability Matching                                    │
│     · Trust-weighted Ranking                                 │
│                                                              │
│  3. Execution & Settlement                                   │
│     · Sandbox 실행                                           │
│     · Escrow 결제                                            │
│     · 결과 검증 & 분쟁 처리                                  │
│                                                              │
│  4. Reputation System                                        │
│     · 성공률, 지연, 품질 피드백                              │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow (request pipeline)

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│   Web / App / ChatGPT·Claude (MCP) / API                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      API Gateway                            │
│   Auth · Rate Limit · Request Routing                       │
└──────┬───────────────────────────────┬──────────────────────┘
       │                               │
┌──────▼──────────────┐    ┌───────────▼──────────────────────┐
│  Request Service    │    │  Matching Engine                 │
│  - NLP 파싱         │    │  - Filter (규칙)                 │
│  - 요청 정규화      │◄──►│  - Ranking (ML/벡터)             │
│  - 임베딩 생성      │    │  - Assignment / Recommendation   │
└──────┬──────────────┘    └───────────┬──────────────────────┘
       │                               │
┌──────▼──────────────┐    ┌───────────▼──────────────────────┐
│  Provider Service   │    │  Feedback & Learning             │
│  - 프로필 관리      │    │  - 성공/실패 로그                │
│  - 실시간 상태      │    │  - 모델 재학습                   │
│  - 가용성           │    │  - A/B 테스트                    │
└─────────────────────┘    └──────────────────────────────────┘
```

### 1.3 Deployment Topology (target — see §6 for ordering)

```
                          ┌──────────────────┐
                          │   API Gateway    │
                          │  (Kong / Traefik)│
                          └────────┬─────────┘
                                   │
       ┌───────────┬───────────┬───┴───┬───────────┬───────────┐
       │           │           │       │           │           │
┌──────▼─────┐ ┌───▼────┐ ┌───▼────┐ ┌─▼─────┐ ┌──▼─────┐ ┌───▼─────┐
│ User       │ │Task    │ │Provider│ │Match  │ │Payment │ │Feedback │
│ Service    │ │Service │ │Service │ │Engine │ │Service │ │Service  │
└──────┬─────┘ └───┬────┘ └───┬────┘ └──┬────┘ └──┬─────┘ └───┬─────┘
       │           │          │         │         │           │
       └───────────┴──────────┴────┬────┴─────────┴───────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Event Bus (Kafka / NATS)   │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
       ┌──────▼──────┐     ┌───────▼──────┐    ┌───────▼──────┐
       │ Notification│     │  Search      │    │  Analytics   │
       │ Service     │     │  (OpenSearch)│    │  Service     │
       └─────────────┘     └──────────────┘    └──────────────┘
```

---

## 2. Three Product Models, One Matching Spine

| 목표                    | 모델                  | 핵심 기술                                    | 발의 주체 / 비용 부담               |
| ----------------------- | --------------------- | -------------------------------------------- | ----------------------------------- |
| 사람 심부름·생활 서비스 | Airtasker형 + AI 랭킹 | 벡터 검색 + ML 점수 + 실시간 가용성          | 수요자 발의, 공급자 무료 수락       |
| 전문가 견적 비교        | 숨고형 + AI 우선노출  | 성사 확률 예측 모델                          | 수요자 발의, **공급자가 캐시 소모** |
| AI 에이전트 중개        | Agent Marketplace     | Capability Card + Semantic Matching + Escrow | Buyer Agent 발의, **입찰제**        |

**핵심:** 세 모델은 **동일한 filter → rank → settle 척추**를 공유한다. 차이는 _누가 발의하고 누가 입찰 비용을 내는가_ 뿐이다.

---

## 3. Service Boundaries & API

| Service              | 책임                              | 주요 API                                                                       | Owns               |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------ | ------------------ |
| User Service         | 회원가입, 프로필, 인증            | `POST /users`, `GET /users/{id}`, `PUT /users/{id}/location`                   | `users`            |
| Task Service         | 요청 생성·수정·상태관리           | `POST /tasks`, `GET /tasks/{id}`, `PATCH /tasks/{id}/status`                   | `tasks`            |
| Provider Service     | 공급자(사람/에이전트) 프로필·상태 | `POST /providers`, `PUT /providers/{id}/availability`, `GET /providers/nearby` | `providers`        |
| Matching Engine      | 필터 + 랭킹 + 배정                | `POST /match`, `GET /match/{task_id}/candidates`, `POST /match/{id}/accept`    | `matches`          |
| Payment Service      | 에스크로·정산·환불                | `POST /payments/hold`, `/release`, `/refund`                                   | escrow/ledger      |
| Feedback Service     | 평점·리뷰·학습 데이터             | `POST /feedback`, `GET /providers/{id}/stats`                                  | ratings, event log |
| Notification Service | 푸시·알림·웹훅                    | `POST /notify` (내부)                                                          | —                  |
| Search Service       | 벡터 + 텍스트 검색                | `POST /search/providers`, `POST /search/tasks`                                 | denormalized index |
| Dispute Service      | 분쟁 제기·중재                    | `POST /disputes`, `PATCH /disputes/{id}/resolve`                               | `disputes`         |

### Event contracts

```
task.created         → Matching Engine, Notification
match.recommended    → Notification (공급자에게)
match.accepted       → Payment (에스크로 홀드)
task.completed       → Payment (정산), Feedback
feedback.submitted   → Matching Engine (모델 업데이트)
dispute.opened       → Payment (지급 보류)
```

> ⚠️ If the event bus is adopted, add a **schema registry** (Avro/Protobuf) or a versioned envelope. Loose typing across 9 services produces silent breakage.

---

## 4. Target Schema

### 4.1 Core (proposed)

```sql
CREATE TABLE providers (
  id              UUID PRIMARY KEY,
  type            TEXT CHECK (type IN ('human','ai_agent')),
  name            TEXT,
  skills          TEXT[],
  skill_embedding VECTOR(1536),
  service_area    GEOGRAPHY(POLYGON),
  hourly_rate     NUMERIC,
  rating          NUMERIC DEFAULT 0,
  completion_rate NUMERIC DEFAULT 0,
  is_available    BOOLEAN DEFAULT true,
  metadata        JSONB,                    -- agent: input/output schema
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES users(id),
  title           TEXT,
  description     TEXT,
  category        TEXT,
  location        GEOGRAPHY(POINT),
  budget_min      NUMERIC,
  budget_max      NUMERIC,
  preferred_time  TSTZRANGE,
  status          TEXT DEFAULT 'open',
  embedding       VECTOR(1536),
  extracted_attrs JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE matches (
  id              UUID PRIMARY KEY,
  task_id         UUID REFERENCES tasks(id),
  provider_id     UUID REFERENCES providers(id),
  score           NUMERIC,
  status          TEXT,          -- recommended|accepted|rejected|completed
  feedback_score  NUMERIC,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON providers USING ivfflat (skill_embedding vector_cosine_ops);
CREATE INDEX ON tasks     USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON providers USING GIST (service_area);
```

### 4.2 Live location

```sql
CREATE TABLE provider_locations (
  provider_id   UUID PRIMARY KEY REFERENCES providers(id),
  location      GEOGRAPHY(POINT),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  heading       REAL,
  speed         REAL
);
CREATE INDEX idx_provider_loc ON provider_locations USING GIST (location);
```

### 4.3 Geo + skill filter (soft-filter warning in §5.3)

```sql
SELECT p.id, p.name, p.rating,
       ST_Distance(pl.location, ST_MakePoint($lng,$lat)::geography) AS distance_m
FROM providers p
JOIN provider_locations pl ON p.id = pl.provider_id
WHERE p.is_available = true
  AND p.skills && $required_skills
  AND ST_DWithin(pl.location, ST_MakePoint($lng,$lat)::geography, 5000)
ORDER BY distance_m
LIMIT 50;
```

### 4.4 Escrow state machine

```
created → held → released
              ↘ refunded
              ↘ disputed → resolved_buyer / resolved_provider / split
```

```http
POST /payments/hold
{ "task_id","amount","currency","buyer_agent_id","provider_agent_id" }

POST /payments/{payment_id}/release
POST /payments/{payment_id}/refund

POST /disputes
{ "payment_id","reason":"output_quality","evidence":["url1","url2"],"requested_action":"partial_refund" }
```

**Escrow implementation notes**

- Actual money via Stripe Connect / PayPal / crypto escrow
- Platform manages **only** `payment_intent` state
- Auto-settle locked during dispute window
- SLA timeout → rule-based auto-refund

---

## 5. Known Correctness Issues (must fix before implementing)

### 5.1 Distance radius is hard-coded

```python
distance_score = max(0, 1 - distance_km / 30)   # ❌ 30 is magic
```

Should derive from the **task's** service radius. A 5 km task and a 50 km task score identically today.

### 5.2 Price scoring is directionally wrong

```python
price_score = 1 - abs(provider.hourly_rate - task.budget_max) / task.budget_max  # ❌
```

This rewards a rate _closest to budget_max_, penalizing cheaper providers who are **better value**. Prefer surplus (`budget_max - rate`). Also fix the same bug in the feature:

```python
price_diff_ratio = (provider.hourly_rate - task.budget_max) / task.budget_max  # ❌ signed, may invert meaning
```

Test signed vs. surplus variants; let SHAP decide.

### 5.3 Hard skill filter kills recall

`p.skills && $required_skills` is exact array overlap. `["plumbing","general_repair"]` will not match a task needing `["pipe_fitting"]` despite clear qualification. With vectors available, **skill overlap should be a boost, not a filter**. Reserve hard filters for legal/licence/region constraints.

### 5.4 Dual-write location has no failure handling

The spec writes Redis _then_ DB inline. If the DB write fails, the two silently diverge — **recreating the exact Postgres-vs-Redis drift bug currently in golive.wiki**. Fix by making DB authoritative and Redis a TTL read-cache, or by queueing writes to a single persister.

### 5.5 No normalization contract

`rating_score = rating/5` vs `success_pred = completion_rate` (already 0–1) will silently break if rating storage changes scale. Define an explicit 0–1 normalization contract per feature.

---

## 6. Execution & Settlement — the thinnest layer

Across all reviewed diagrams, Execution & Settlement is the least specified and the hardest. Human vs. AI paths differ fundamentally:

|        | Human (Airtasker)               | AI Agent                                   |
| ------ | ------------------------------- | ------------------------------------------ |
| 검증   | client approval + photo/receipt | **automated** — `output_schema` validation |
| 분쟁   | mediation queue, refund policy  | deterministic replay / SLA breach          |
| Escrow | Stripe Connect / Toss           | micro-escrow, often **sub-$1**             |

> ⚠️ **Sub-$1 escrow breaks on fixed payment fees** (e.g. Stripe $0.30 + 2.9% makes a $0.15 job loss-making). Batch or credit-net micro-transactions.

---

## 7. Feature Engineering (ranking model)

**Label**

```
1 = recommended → accepted → completed
0 = recommended but rejected / no response / cancelled
```

**Feature groups**

| 그룹          | 예시                                                                   | 설명               |
| ------------- | ---------------------------------------------------------------------- | ------------------ |
| Task          | category, budget_log, hour_of_day, weekday, urgency, text_length       | 요청 특성          |
| Provider      | rating, completion_rate, response_time_avg, job_count_30d, price_level | 공급자 이력        |
| 교차          | skill_jaccard, embedding_cosine, distance_km, price_diff_ratio         | 양자 관계          |
| 상황          | provider_current_load, is_peak_hour, weather                           | 실시간             |
| 과거 상호작용 | past_success_count, past_reject_count                                  | **이 조합의 이력** |

**Model:** LightGBM (`n_estimators=300, lr=0.05, max_depth=7, class_weight="balanced"`)

**Monitoring:** `emb_cosine`, `skill_jaccard`, `distance_km`, `prov_rating` typically rank highest. Check SHAP periodically for **bias** (region, gender proxies). Retrain daily or weekly.

**Serving notes**

- Realtime features (load, location) from Redis
- Pre-compute provider embeddings; generate **task embedding only on request**
- Use `P(success)` directly, or blend with business rules

> **Sleeper feature:** `past_success_count` / `past_reject_count` per _(user, provider)_ pair. Reputation is **pair-relative**, not global — this likely outperforms raw `prov_rating`.

---

## 8. Recommended Build Order

⚠️ The proposed order ("1단계 마이크로서비스 분리") is **backwards**. You have 3 tables, 1 process, zero traffic, and no `matches` data. Splitting into 9 services before the ranking works costs months and delivers nothing measurable.

```
Phase 0  DB unblock        PostGIS + pgvector image; unify geo (kill Redis GEO duality)
Phase 1  Registry          providers: skills, agent capability card, versions,
                           permissions, availability heartbeat
Phase 2  Request Service   LLM parse → extracted_attrs + embedding
Phase 3  Matching Engine   filter → vector rank → weighted score (fix §5.1–5.5)
                           write `matches` WITH impression logging
Phase 4  Settlement        escrow + verification + dispute (split human/AI paths)
Phase 5  Feedback loop     event log → 성사 확률 model → A/B
Phase 6  MCP/A2A surface   expose as MCP tools for ChatGPT/Claude
```

Phases 0–3 yield a working semantic matching marketplace. **Phase 4 is the hard, unglamorous part** and is the thinnest section of the spec.

### On microservice extraction

This topology is **correct for scale, wrong for now**. Today's system is ~14 source files in 1 process. 9 services × (deploy + monitor + schema + contract) ≈ **20× the operational surface**, with no traffic to justify it.

```
NOW    modular monolith (extract modules internally, not processes)
NEXT   extract the 2 with genuinely different profiles:
       · Matching Engine (CPU/GPU-bound — different scaling)
       · Notification    (async, stateless)
LATER  Payment/Escrow (needs a saga anyway — do it when payments are real)
       Feedback / Analytics / Search (when data volume hurts)
```

Premature splitting usually yields a **distributed monolith**: all the coupling of a monolith, plus network failures.

---

## 9. Standards Surface

| Protocol                         | Role                                                    |
| -------------------------------- | ------------------------------------------------------- |
| **MCP (Model Context Protocol)** | 도구/서비스 연결 — Client Layer의 ChatGPT·Claude 진입점 |
| **A2A (Agent-to-Agent)**         | 에이전트 간 통신                                        |
| **Capability Card / Agent Card** | 에이전트 능력 선언 표준                                 |

### Agent capability card example

```json
{
  "agent_id": "pdf-extractor-v2",
  "name": "PDF Table Extractor",
  "type": "ai_agent",
  "capabilities": ["pdf_parsing", "table_extraction", "csv_export"],
  "input_schema": {
    "type": "object",
    "properties": {
      "file_url": { "type": "string" },
      "pages": { "type": "string", "default": "all" }
    },
    "required": ["file_url"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "csv_url": { "type": "string" },
      "row_count": { "type": "integer" }
    }
  },
  "pricing": { "model": "per_job", "price_usd": 0.15 },
  "trust_score": 0.92,
  "avg_latency_sec": 8.3
}
```

---

## Appendix: Current golive.wiki vs. Target

| This spec                                | golive.wiki today                          | Gap                 |
| ---------------------------------------- | ------------------------------------------ | ------------------- |
| `providers.skill_embedding VECTOR(1536)` | ❌ none                                    | new                 |
| `providers.service_area GEOGRAPHY`       | partial — `Task.lat/lng` + Redis GEO point | **schema mismatch** |
| `tasks.embedding` + `extracted_attrs`    | ❌ raw `title`/`description`               | new                 |
| `matches` table                          | ❌ none — direct `UPDATE tasks`            | new                 |
| Escrow                                   | ❌ none (`price` is a display float)       | new                 |
| Reputation 성공률/지연                   | ⚠️ `Review.rating` only                    | extend              |
| API Gateway rate limit                   | ❌ none                                    | new                 |
| pgvector / PostGIS                       | ❌ neither installed                       | **blocker**         |
| NLP 파싱                                 | ❌ none                                    | new                 |
