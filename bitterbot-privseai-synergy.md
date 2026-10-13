# bitterbot-desktop × privseai.com 통합 시너지 분석

> 조사일: 2026-10-13 · 출처: GitHub 원문 README + privseai.com 7개 라우트 직접 렌더링

---

## 0. 전제 (중요)

| 항목 | 내용 |
|---|---|
| privseai.com 현재 데스크톱 브리지 대상 | **my-neuro** (자사 제품 아님 — "서드파티 프로젝트이며 이곳에 번들되지 않았다"고 페이지에 명시) |
| 따라서 | bitterbot 연동은 **신규 제안 통합**이며, 기존 my-neuro 브리지를 **대체 또는 병존**시키는 설계가 필요 |
| my-neuro 정체 | 미검증. 관련 문서를 찾지 못해 내용은 추정하지 않음 |
| 라이선스 | bitterbot **MIT** → privseai 연동에 **충돌 없음** |
| 연동 계약(기존) | `{persona system prompt, greeting, personality, hobbies, voice hints, shared memory namespace}` JSON, 로컬 우선 |

---

## 1. 양측 정체성 비교

| 구분 | bitterbot-desktop | privseai.com |
|---|---|---|
| 한 줄 | 로컬 퍼스트 **개인 에이전트** + P2P 에이전트 경제 | P2P **AI 컴패니언** 플랫폼 (Candy Edition) |
| 스택 | TypeScript, pnpm, Node ≥22.12, Rust 오케스트레이터, SQLite + Markdown | React SPA, Trystero 메시, WebRTC, nostr 시그널링 |
| P2P | libp2p TCP(9100) + Gossipsub + EigenTrust + dcutr 홀펀칭 | Trystero + WebRTC + nostr |
| 기억 | ✅ **생물학적 기억** (에빙하우스 망각·호르몬·크리스탈·지식그래프) | △ 브라우저 저장 + Memos 서버 싱크 |
| 꿈/오프라인 학습 | ✅ Dream Engine (2시간 주기) | ❌ |
| 결제 | ✅ x402 + Base USDC + 바운티 + 70/20/10 수익분배 | 🚧 마켓 준비 중 (결제·NFT 비활성) |
| 컴패니언 UX | △ Control UI + 채널 (WebChat 등) | ✅ 캐릭터 라이브러리·원클릭 생성·태그·갤러리 |
| 영상 생성 | ❌ | ❌ |
| 로컬 추론 | ✅ Ollama / vLLM + 모델 독립 | ✅ Qwen3-0.6B 등 프리셋(레시피만 P2P 공유) |
| 서드파티 채널 | ✅ WhatsApp·Telegram·Discord·Signal·Slack·Email | ❌ |

**핵심 통찰:** 둘은 경쟁자가 아니라 **거의 완벽하게 상보**적이다. privseai는 "얼굴(UX·캐릭터·배포)"이 있고 "뇌(기억·학습)"가 없다. bitterbot은 "뇌"가 있는데 "얼굴"이 없다.

---

## 2. 시너지 효과 (8대)

### ① 컴패니언에게 진짜 기억력과 성격을 이식
privseai는 현재 메모리 인프라가 빈약(Memos 서버 싱크 + 브라우저 저장)하다. bitterbot을 붙이면 **자산이 되는 기억**이 들어온다.
- 에빙하우스 망각곡선 + 30분 주기 통합 파이프라인 → 오래 안 쓴 기억은 자연 소멸, 자주 쓰는 사실은 영구 격상
- 칸노니컬 팩츠 렛저 → 검색 없이 턴마다 주입되는 "너는 누구" 진실 층 (LLM 비용 0)
- 호르몬 시스템(도파민/코르티솔/옥시토신) → warmth·energy·playfulness·empathy 등 **8개 응답 차원을 매 턴 실시간 계산**
- Phenotype(진화하는 자아) → `GENOME.md` 불변 안전 공리 안에서 성격이 경험으로 성장

→ **효과: "기억하는 인형" → "함께 자란 존재".** Candy.ai Premium Plus의 20슬롯 메모리와 질적 격차가 남.

### ② 원클릭 생성 + 지식 그래프
privseai 킬러기능 "한 문장 → 롤플레이 카드 자동 생성"이 bitterbot의 **타입드 지식 그래프**(사람·프로젝트·관계 엣지)를 만나면, 캐릭터가 사용자의 실제 삶 맥락을 이해한 상태로 시작한다. Dream 모드가 대화를 채굴해 엣지를 계속 추가.

### ③ privseai 최대 약점(복제 방지 불가)을 bitterbot이 메워줌
privseai 마켓은 스스로 인정한다 — *"평문 전달 후 복제를 P2P로 막을 수 없다."* bitterbot은 **실제 구현**을 갖췄다.
- Ed25519 서명 envelope + provenance trailer
- **EigenTrust** 평판, 전송 검증 게이트 + 성숙 기간 통과 스킬만 공개
- 수신측 검역(quarantine)
- 가격 = 실행 성공률 × 수요 × 평판 × 희소성

→ **효과: 마켓이 "단계별 공개"에서 실제 거래 가능 상태로.** 가장 값진 시너지.

### ④ 미완 결제 레이어를 x402/USDC로 즉시 충당
privseai 로드맵 03("선택형 에디션과 결제 — 지갑 소유, 검증 결제, 환불, 정산, 감사된 계약")이 미래인데 bitterbot은 이미 갖췄다.
- x402 마이크로페이먼트 + Base USDC 지갑
- 거래당/일간/세션 **스펜드 캡 $25/$50/$50** (지갑 서비스가 강제)
- 오너 외 송금 불가 + `review.spend: "ask"` 기본 승인 대기
- **바운티**: 네트워크에 없는 역량을 USDC로 의뢰, 품질 게이트 통과 후 지급
- A2A 발견 + 48시간 홀드 후 수익 분배

→ **효과: 크리에이터 경제를 수년이 아닌 즉시 개시.**

### ⑤ 채널 폭발 — 컴패니언이 사용자를 따라 이동
privseai는 웹에 갇혀 있다. bitterbot을 붙이면 **동일 아이덴티티**로 WhatsApp·Telegram·Discord·Signal·Slack·Email·WebChat에 상주.
→ **효과: "사이트에 접속하는 AI" → "내 메신저에 사는 AI."** 리텐션 구조가 바뀐다.

### ⑥ privseai 로컬 프리셋의 실행기
privseai는 프리셋 **레시피만** P2P 공유(모델 파일 비공유)하고 "내 기기에서 직접 운영"을 약속한다. bitterbot은 그 실행 런타임을 제공한다.
- Ollama / vLLM 완전 로컬 추론 + **프로바이더 자동 페일오버**
- 모델 카탈로그 실시간 디스커버리
- 모델 독립 (Anthropic/OpenAI/OpenRouter/Bedrock/Together/Venice)

→ **효과: 프라이버시 약속이 실제로 성립.** 단, §4 전제 필요.

### ⑦ Circles로 "동의 기반 프라이버시" 차별화
- 수신 텍스트 **즉시 인젝션 스캔** → `circle_agent` 클래스로 래핑, 도구 트리거·리콜 영원 불가
- `circles.ask`는 **카테고리·서클별 기본 거부 공개 allowlist** + 인간 승인 대기 → 사적 메모리 자동 노출 0
- 오프라인 편지함 X25519 + AES-256-GCM → **호스트는 읽지 못하는 암호문만 저장**
- Ed25519 체인, 포크는 변조 증거

→ **효과: "친구의 AI에게 물어보기"를 안전 제공.** Candy.ai로는 불가능한 카테고리.

### ⑧ 보안 성숙도 향상
privseai는 "모델 생성물 — 공유 전 검토하라"고 사용자에게 떠넘긴다. bitterbot은 **구조적 안전장치**를 갖췄다.
- 인바운드 DM = 기본 비신뢰 입력 + 페어링 승인
- 비메인 세션 Docker 샌드박스
- 셸 allowlist 밖은 사전 질의, 돈/브라우저/코드 실행 도구는 **오너 전용**
- 공개 게시·첫 메시지·커넥터 쓰기는 리뷰 큐 대기
- egress 전 연결 문서화 + 그렉 검증 가능 (모든 dial에 스위치 존재)

---

## 3. 기술 연동 설계 (실현 가능성)

privseai 계약은 `{system prompt, greeting, personality, hobbies, voice hints, memory namespace}` JSON.
bitterbot은 `GENOME.md` + Phenotype + SQLite/Markdown. **플러그앤플레이가 아닌 어댑터 필요.**

| 계층 | privseai | bitterbot | 브리지 |
|---|---|---|---|
| 캐릭터 스키마 | 롤플레이 카드 JSON | GENOME.md(불변) + Phenotype(진화) | Phenotype→card 내보내기 / card→GENOME 시드 임포트 |
| 메모리 | Memos 서버 2방향 싱크 | Crystals SQLite + MD | **Memos를 공유 메모리 평면으로** (양측 모두 지원) |
| 음성 | gpt-sovits (권한 확인 게이트) | Voice 도구 + 승인 큐 | 참조 음성 권한 확인 유지, 합성은 bitterbot 실행 |
| 추론 | Qwen3-0.6B 프리셋 레시피 | Ollama/vLLM | **프리셋 → bitterbot 프로바이더 프로파일 자동 변환** |
| P2P | Trystero/WebRTC/nostr | libp2p/TCP/Gossipsub | 트랜스포트 브리지 또는 이중 스택 게이트웨이 |
| 에이전트 API | — | **A2A**(`/.well-known/agent.json`, JSON-RPC, SSE) / ACP / CLI | privseai가 bitterbot을 A2A 에이전트로 위임 호출 |
| 스킬 | 마켓 카탈로그(예정) | SKILL.md | 양측 동일 파일 포맷 → 형식 충돌 없음 |

**가장 저렴한 1차 연동:** privseai가 이미 구현한 **my-neuro JSON 브리지에 bitterbot 어댑터를 끼우는 것**.
내보내기(Asuka → 프로필)는 그대로 쓰고, 가져오기를 `~/.bitterbot` 시드 주입으로 연결하면 컴패니언·음성힌트·메모리 네임스페이스 3축이 한 번에 해결된다. 메모리는 양측 모두 메모 서버 싱크를 지원하므로 **Memos를 공유 평면**으로 삼으면 추가 구현이 거의 없다.

---

## 4. 리스크 & 상쇄 방안

| 리스크 | 심각도 | 상쇄 |
|---|---|---|
| **프라이버시 약점 훼손** — bitterbot 메모리는 클라우드 모델 사용 시 프롬프트(리콜 포함)가 제공자로 전송. privseai 약속은 "공유 안 하면 기기를 벗어나지 않음" | 🔴 높음 | 로컬 추론 강제 모드에서만 컴패니언 싱크 허용, UI에 추론 위치 명시 |
| **공격면 확대** — 컴패니언 UI 뒤에 셸·브라우저·**지갑**을 가진 에이전트 | 🔴 높음 | 컴패니언 모드에서 exec/지갑 도구 비노출, 승인 큐 기본 ask 유지 |
| **결제 레이어 미검증** — bitterbot 스스로 "제3자 감사 없음, 실험적, 기본 OFF" | 🟠 중 | privseai 마켓이 의존성을 상속 → 감사·스테이징 전 테스트넷 한정 |
| **무거움** — Node≥22.12 + pnpm + ffmpeg/ripgrep/jq + playwright chromium. privseai는 즉시 접속 웹 | 🟠 중 | 경량 게이트웨이 모드(싱크·음성만) 분리, 데스크톱 브리지 옵트인 |
| **트랜스포트 불일치** — Trystero/WebRTC/nostr ↔ libp2p | 🟡 낮 | 이중 스택 브리지 노드 |
| **규모** — bitterbot 2.5k★/417포크·이슈 3개, 마켓 "유의미한 거래량 없음" 자인 | 🟡 낮 | 뇌/기억 계층만 가져다 쓰면 마켓 성숙도와 무관 |
| 귀속·Attribution | 🟢 | bitterbot은 OpenClaw(pi-mono) 등 서드파티 귀속을 ATTRIBUTION.md로 분리 관리 → 존중 |
| 채널 우회 위험 | 🟢 | DM 페어링 + 인젝션 스캔 + 서클 allowlist가 이미 방어 |

---

## 5. 단계별 실행 로드맵

| 단계 | 내용 | 난이도 | 효과 |
|---|---|---|---|
| **0** | 어댑터 PoC: bitterbot 캐릭터 → my-neuro JSON 프로필 내보내기/가져오기 | 낮 | 기존 브리지 활용, Phenotype 매핑만 |
| **1** | Memos 공유 메모리 평면 (양방향 싱크 활성) | 낮 | 기억 지속성 확보 |
| **2** | gpt-sovits 음성 연동 + 권한 게이트 유지 | 중 | 음성 메시지 |
| **3** | 로컬 추론 프리셋 → Ollama/vLLM 프로바이더 프로파일 변환 | 중 | **프라이버시 약속 성립** |
| **4** | A2A 연동: privseai가 bitterbot 에이전트 발견·위임 | 중 | 다중 에이전트, 크로스 노드 역량 |
| **5** | Dream Engine 백그라운드 연결 (유휴 시 메모리 통합·스킬 증류) | 중 | 캐릭터 자율 성장 |
| **6** | 채널 확장 (Telegram/Discord 등) | 중 | 리텐션 |
| **7** | 마켓 + EigenTrust 서명·검역 도입 | 높 | 크리에이터 경제 (감사 후) |
| **8** | x402/USDC 결제 + 바운티 | 높 | 수익화 (감사 후) |

---

## 6. 결론

**시너지 등급: 높음 (상보적 결합).** 경쟁 제품을 합친 것이 아니라 **빈 약탈**이다.

- **privseai가 얻는 것:** 진짜 기억·자율 학습·지식그래프·평판·결제·멀티채널 — 즉 "뇌"와 "신뢰 인프라". 특히 ③④가 치명적 약점(복제 방지 불가, 결제 미완)을 정확히 메워준다.
- **bitterbot이 얻는 것:** 성숙한 컴패니언 UX·캐릭터 카탈로그·원클릭 생성·한국어 우선 다국어·웹 배포 — 즉 "얼굴". 메신저 에이전트에서 대중 컴패니언 제품으로 진입.
- **사용자가 얻는 것:** 고정 요금 + 로컬 추론 + 데이터 로컬 우선 + 영원히 기억하는 캐릭터 + 숨은 비용 없음. 이 조합은 Candy.ai로도, 어느 쪽 단독으로도 불가능하다.

**단, 2가지 선행 조건 없이는 시너지가 역효과**다.
1. **로컬 추론 강제** — 그렇지 않으면 bitterbot 메모리가 클라우드 제공자로 새 privseai의 핵심 판매 포인트(프라이버시)를 무너뜨린다.
2. **컴패니언 모드에서 위험 도구 차단** — 셸·브라우저·지갑을 노출한 채로는 대중용 컴패니언 UI가 공격면이 된다.

또한 privseai의 기존 브리지는 **my-neuro**이므로 이 통합은 신규 어댑터 개발을 전제로 하며, **0~1단계(JSON 어댑터 + Memos)만으로도 체감 가치의 대부분**을 얻을 수 있다.

---

## 7. 출처

- https://github.com/Bitterbot-AI/bitterbot-desktop (README.md 원문 — Quick Start / Architecture / Agent Economy / Circles / Agent Interoperability / Security / Models)
- https://about.bitterbot.ai · `docs/marketplace/`, `docs/network/circles.md`, `docs/protocol/circle-v1/SPEC.md`
- https://privseai.com (/, /pricing, /hub, /world, /marketplace, /integrations, /studio 직접 렌더링 수집)
- Candy.ai 비교 기준: https://candy.ai + companionhunt.com (2026-09-26 검증)

