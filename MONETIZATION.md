# Golive.wiki / Agent Marketplace — Monetization Design

> Consolidated from the monetization discussion. Read with `ARCHITECTURE.md`.

---

## 0. Executive Summary

**Recommended model:** 기본 무료 + AI 크레딧 과금 + (선택) 성공 수수료

> "플랫폼 자체는 무료로 열고, AI가 실제로 일한 만큼만 합리적으로 과금하되, 완전 무제한 무료는 피하고 사용량 상한과 성공 기반 수익을 함께 둔다."

**Direction: correct. But the sequencing and two risks are missing** (see §3, §4).

---

## 1. Option Comparison (as proposed)

| 방식                | 설명                                    | 추천도 | 평가                                   |
| ------------------- | --------------------------------------- | ------ | -------------------------------------- |
| AI 크레딧제         | 월 무료 크레딧 + 초과분 LLM 사용량 과금 | ★★★★★  | ✅ 단, **LLM 원가가 낮을 때만**        |
| 성공 시 소액 수수료 | 기본 매칭 무료, 성사 시 1~3% 또는 고정  | ★★★★   | ⚠️ **결제 인프라 없이는 불가**         |
| 프리미엄 기능       | 우선 매칭, 고급 분석, 대량 요청, API    | ★★★★   | ⚠️ **유저 규모 필요** (초기 매출 0)    |
| 공급자 프로 플랜    | 무료 기본, 노출 상위·통계·자동응대 구독 | ★★★    | ⚠️ 공급자 > 수요자일 때만 성립         |
| Agent 실행 수수료   | AI 에이전트 실제 작업 수행 시 과금      | ★★★★   | ✅ 가장 차별화 — **단 실행 계층 없음** |

---

## 2. 🔴 Critical Dependency Problem

The monetization table is **inverted**: 5 of 5 revenue streams depend on features that **do not exist yet**.

```
성공 수수료       → 에스크로/결제 필요      → golive.wiki에 없음 ❌
Agent 실행 수수료  → Sandbox 실행 필요      → 없음 ❌
프리미엄/프로 플랜  → 트래픽 + 분석 필요     → 없음 ❌
AI 크레딧제       → LLM 파싱 필요          → 없음 ❌
──────────────────────────────────────────────────
미구현 의존성:  5 / 5
```

**The monetization design is sound; the product it monetizes does not exist yet.** Build order matters more than pricing here.

---

## 3. ⚠️ Credit Margin Trap

### 3.1 "LLM 원가" is not just token cost

Real per-request cost:

```
LLM 토큰비
+ 임베딩 생성비 (요청마다 1536차원)
+ 벡터 검색 컴퓨팅 (pgvector KNN)
+ 매칭 엔진 재랭킹 (LightGBM 추론)
+ 인프라 (PostGIS, Redis, 서버)
+ 결제 수수료 (Stripe 2.9% + $0.30)
```

### 3.2 Fixed payment fees kill micro-transactions

```
Agent 실행 건당 과금 $0.15
Stripe 고정비        $0.30
────────────────────────────
건당 손실           -$0.15   ← 적자
```

→ Micro-escrow must be **batched** or **credit-netted**. Never settle sub-$1 jobs individually.

### 3.3 "1.5~3배 마진" cannot fund the proposed free tier

```
무료 티어: 월 10~20회
마진:      2배
전환율:    5% 가정
─────────────────────────────────────────────
전환 유저 1명이 무료 유저 19명 부양
유료 유저 실효 마진 = 2 ÷ 20 = 0.1배 → 적자
```

**Fix:** start free tier at **3–5회**, not 10–20, and make credits **prepaid**.

---

## 4. ⚠️ Missing Abuse Vector: Prompt-Injection Cost Bomb

The proposed defenses — 요청당 최소 정보 요구, 다량 요청 제한, 봇 탐지, 본인 인증 — are all good. But they miss the **biggest risk unique to credit-based billing**:

> A malicious user can craft **deliberately expensive** requests (huge inputs, recursive parsing) to burn LLM budget. Since credits meter _our_ LLM calls, this is a direct cost attack.

**Required additional controls:**

- 요청당 **입력 토큰 상한**
- 요청당 **크레딧 상한** (초과 시 거부)
- 이상 사용 패턴 **자동 서킷브레이커**

---

## 5. Recommended Tier Design

### Free tier

- 월 **N회 (3~5회부터)** 요청/매칭 무료
- 기본 LLM 파싱 + 추천 포함

### Credit / usage billing

- 초과 시 "AI 사용 크레딧" 차감 — **선불 구매**
- 크레딧 가격 = **총 원가**(§3.1) × 1.5~3배
- 입력 토큰 상한 + 크레딧 상한 + 서킷브레이커

### Success fee (optional)

- 거래 금액의 2~5% 또는 건당 고정
- 명분: _"플랫폼이 가치를 만들었을 때만 돈 받는다"_
- ⚠️ 에스크로 선행 필요. 소액 건은 배치/상계 처리

### Premium features

- 우선 매칭, 고급 분석, 대량 요청, API 연동
- 유저 규모 확보 후

### Provider Pro plan

- 노출 상위, 통계, 자동 응대
- 공급자 풀이 충분해진 후

### Agent execution fee

- Sandbox 실행 계층 구현 후

---

## 6. Abuse Prevention

| Defense                                      | Status         |
| -------------------------------------------- | -------------- |
| 요청당 최소 정보 요구 (위치, 카테고리, 설명) | ✅ proposed    |
| 동일 유저 단시간 다량 요청 제한              | ✅ proposed    |
| 봇 탐지 + 전화번호/계좌 인증                 | ✅ proposed    |
| **요청당 입력 토큰 상한**                    | ❌ **missing** |
| **요청당 크레딧 상한**                       | ❌ **missing** |
| **자동 서킷브레이커**                        | ❌ **missing** |

---

## 7. Implementation Order

```
Phase 0  매칭 제품 자체를 먼저 작동시킨다        ← 수익화 이전 필수
Phase 1  AI 크레딧 (가장 빨리 붙일 수 있음)
         └ 선불 크레딧 + 입력 상한 + 서킷브레이커
Phase 2  에스크로 → 성공 수수료
         └ Stripe Connect (건당 고정비 회피: 목표 $5+)
Phase 3  공급자 프로 플랜 (공급자 풀 확보 후)
Phase 4  Agent 실행 수수료 (Sandbox 실행 계층 구현 후)
```

---

## 8. One-Line Counterpoint

> "플랫폼 자체는 무료로 열고, AI가 실제로 일한 만큼만 과금"

**Agreed — but be careful how "AI가 일한 만큼" is framed.**

파싱·임베딩·추천은 **우리가 제공하는 가치**이므로 과금 대상이 맞다. 그러나 유저 인식에서 *"글 쓴 것뿐인데 돈을 낸다"*가 되면 이탈한다. **Airtasker·숨고 모두 게시 자체는 무료**다.

**Recommendation:** 파싱·매칭을 무료 티어에 충분히 넣고, 과금은 **초과 사용 + 프리미엄 노출 + 성공 수수료**에 집중. "AI 크레딧"을 전면에 내세우기보다 **백엔드 과금 단위**로 두는 편이 심리적 저항이 적다.

---

## 9. Key Risks Table

| Risk                             | Severity | Mitigation                      |
| -------------------------------- | -------- | ------------------------------- |
| 매출원 5개 전부 미구현 기능 의존 | 🔴 High  | 제품 먼저, 수익화는 Phase 1부터 |
| 소액 결제 고정수수료 적자        | 🔴 High  | 배치/상계, $5+ 이상만 개별 결제 |
| 무료 티어가 마진 잠식            | 🔴 High  | 3~5회로 축소 + 선불 크레딧      |
| 프롬프트 인젝션 비용 폭탄        | 🔴 High  | 토큰/크레딧 상한 + 서킷브레이커 |
| "게시=유료" 인식 이탈            | 🟡 Med   | 파싱·매칭 무료화, 과금 후순위화 |
| 공급자 프로 플랜 조기 도입       | 🟡 Med   | 공급자 풀 확보 후 도입          |
