# brand-extraction — 브랜드 디자인 토큰 추출 도구

`web-client/public/styles/tokens.css` 의 **근거 데이터**를 생성하는 도구입니다.

## 무엇을 하는가

브랜드 사이트(AirTasker, OpenWork 등)를 Playwright 로 실제 렌더링한 뒤,
CSS 변수(`--primary`, `--accent` 등)를 그대로 추출해 JSON + 스크린샷으로 저장합니다.

## 사용법

```bash
cd tools/brand-extraction
npm install

# 로그인 필요한 사이트 (브라우저 창이 열림 → 직접 로그인 → 터미널에서 Enter)
node extract-brand.mjs https://www.airtasker.com/au/

# 로그인 불필요 (동작 확인용)
node extract-brand.mjs https://www.openwork.network/ --headless
```

출력: `brand-tokens-<호스트>.json`, `brand-<호스트>.png`

### JSON 스키마

| 키 | 내용 |
|---|---|
| `body` | body 배경/글자색/폰트 |
| `h1` | h1 텍스트/크기/굵기/색 |
| `meta` | description, og:title, og:description |
| `ctas` | 버튼/링크 텍스트 목록 |
| `topColors` | 화면에서 가장 많이 쓰인 색 (rgb, 등장횟수) |
| `rootVars` | `<style>` 블록의 CSS 변수 원문 (`--name: value`) |

## tokens.css와의 대응

`reference/brand-tokens-openwork.network.json` 의 `rootVars` HSL 값을 HEX로 변환해
`styles/tokens.css` 와 대조한 결과입니다.

### 정확히 일치하는 값 (4/14)

| openwork 토큰 | HEX | tokens.css | |
|---|---|---|---|
| `--background` | `#09090B` | `--at-dark` | ✅ |
| `--primary` | `#14EBC0` | `--at-primary` | ✅ |
| `--foreground` | `#FAFAFA` | `--at-text-main` | ✅ |
| `--muted-foreground` | `#A1A1AA` | `--at-text-muted` | ✅ |

### 근사값 (수동 조정)

| tokens.css | 값 | openwork 대비 |
|---|---|---|
| `--at-card-bg`, `--at-surface` | `#141418` | `--card`(`#0E0E11`) 와 다름 |
| `--at-border` | `#27272A` | `--border`(`#2B2B31`) 와 다름 |
| `--at-danger` | `#EF4444` | `--destructive`(`#EF4343`) 와 다름 |
| `--at-blue` | `#0A65FC` | openwork `--accent` 는 `#14EBC0` (별도 파랑 없음) |
| `--at-gold` | `#F59E0B` | openwork `--warning`(`#F59E0B`) 동일값이나 토큰명이 다름 |

> 즉 **주요 브랜드 색(다크 배경 / 틸 액센트 / 텍스트)은 정확히 일치**하고,
> 표면·보더·상태색은 UI 설계 시 수동 조정된 값입니다.

재현성 확인: 2026-10-25 재실행 결과 `rootVars` **완전 동일**,
`topColors` 는 픽셀 카운트만 ±1 차이 (동일 렌더링).

---

## ⚠️ 알려진 실패 사례

### AirTasker — Cloudflare 차단

`https://www.airtasker.com/au/` 는 Cloudflare 보호 페이지입니다.
추출 시 **챌린지 페이지가 그대로 저장**됩니다:

```json
{
  "title": "Just a moment...",
  "h1": { "text": "Just a moment..." },
  "body": { "background": "#F9F9F9", "color": "#333" },
  "topColors": ["#F9F9F9", "#333333", ...],
  "ctas": []
}
```

스크린샷도 "Just a moment..." 화면입니다 (라이트 그레이).

**결과**: `tokens.css` 헤더의 "Airtasker × OpenWork inspired" 중
**Airtasker 쪽 실제 값은 확보하지 못했습니다.**
`index.html` 의 `--at-*` 토큰 11개는 openwork 값 + 수동 보정으로 구성된 것으로 보입니다.

**재추출 시 필요 조건**
- residential proxy 사용 (Cloudflare가 datacenter IP 차단)
- 또는 `--headless` 없이 실제 브라우저로 로그인 세션 유지
- 또는 AirTasker 공식 CSS 변수 노출 페이지 직접 확인

오염 데이터는 `reference/FAILURES.md` 에 기록되어 있습니다.
`brand-tokens-airtasker.com.json` / `brand-airtasker.com.png` 는 **의도적으로 저장하지 않았습니다** —
Cloudflare 챌린지 데이터가 실제 브랜드 팔레트로 오인될 수 있어 제외했습니다.

---

## 파일 구조

```
tools/brand-extraction/
├── extract-brand.mjs                 # 추출 스크립트
├── package.json                      # playwright 의존성
├── README.md
└── reference/
    ├── brand-tokens-openwork.network.json  # 검증된 추출 결과 (근거 데이터)
    ├── brand-openwork.network.png          # 해당 스크린샷
    └── FAILURES.md                         # 실패 사례 기록
```
