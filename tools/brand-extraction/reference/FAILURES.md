# 추출 실패 사례 기록

오염되었거나 실패한 추출 결과를 기록합니다.
**이 파일들의 데이터는 디자인 근거로 사용하면 안 됩니다.**

---

## 1. AirTasker — Cloudflare 챌린지 페이지 (2026-10-15 수집)

### 대상
```
https://www.airtasker.com/au/
```

### 결과
추출에 "성공"했지만 실제론 Cloudflare 보호 화면을 수집했습니다.

```json
{
  "title": "Just a moment...",
  "h1": {
    "text": "Just a moment...",
    "fontSize": "44px",
    "fontWeight": "400"
  },
  "body": {
    "background": "#F9F9F9",
    "color": "#333",
    "fontSize": "16px"
  },
  "topColors": [
    "#F9F9F9",
    "#333333",
    "#CCCCCC",
    "#F0F0F0",
    "#E5E5E5"
  ],
  "ctas": []
}
```

### 판정
| 항목 | 기대값 | 실제값 |
|---|---|---|
| 배경 | 다크 (AirTasker는 다크 테마) | `#F9F9F9` 라이트 |
| 글자색 | 밝음 | `#333` 어두움 |
| CTA | 다수 | **0개** |
| 스크린샷 | 실제 사이트 | "Just a moment..." (40KB) |

→ 라이트 그레이 + CTA 0개는 Cloudflare 챌린지 화면의 전형입니다.

### 폐기 사유
이 팔레트를 그대로 쓰면 AirTasker의 실제 다크 테마와 **정반대**가 됩니다.
`tokens.css` 는 이미 `index.html` 의 `--at-*` 토큰을 통해
openwork 값 기반 다크 팔레트를 사용하므로, 잘못된 라이트 값이 섞이면 회귀가 납니다.

### 파일 상태
| 파일 | 처리 |
|---|---|
| `brand-tokens-airtasker.com.json` | ❌ **의도적으로 제외** (이관하지 않음) |
| `brand-airtasker.com.png` | ❌ **의도적으로 제외** (이관하지 않음) |

원본은 `kbizhub-dashboard` 저장소에 untracked 상태로 남아 있습니다.

### 재추출 조건

1. **residential proxy** — Cloudflare 는 datacenter IP 를 차단합니다.
   ```js
   // extract-brand.mjs 의 launch 옵션에 추가 필요
   const context = await browser.newContext({
     proxy: { server: 'http://<residential-proxy-host>:port' },
   })
   ```
2. **headed 모드 + 로그인 세션 유지** — `--headless` 없이 실행하고
   실제 로그인 후 Enter.
3. **AirTasker 공식 CSS 변수 확인** — 로그인 없이도 토큰을 공개하는 페이지가 있다면
   그쪽을 대상으로 실행.

### 현재 `--at-*` 토큰의 출처

`web-client/public/index.html` 의 `--at-*` 11개는 AirTasker 실측값이 아니라
**openwork 추출값 + 수동 보정**으로 구성된 것으로 보입니다 (커밋 `89359c0`).

| `--at-*` | 값 | tokens.css 대응 | 출처 |
|---|---|---|---|
| `--at-primary` | `#14EBC0` | `--accent` | ✅ openwork `--primary` **정확 일치** |
| `--at-dark` | `#09090B` | `--bg` | ✅ openwork `--background` **정확 일치** |
| `--at-text-main` | `#FAFAFA` | `--fg` | ✅ openwork `--foreground` **정확 일치** |
| `--at-text-muted` | `#A1A1AA` | `--muted` | ✅ openwork `--muted-foreground` **정확 일치** |
| `--at-blue` | `#0A65FC` | `--accent-2` | ⚠️ openwork 에 파랑 없음 (`--accent`=`#14EBC0`) |
| `--at-card-bg` / `--at-surface` | `#141418` | `--surface-2` | ⚠️ openwork `--card`=`#0E0E11` |
| `--at-border` | `#27272A` | `--border` | ⚠️ openwork `--border`=`#2B2B31` |
| `--at-danger` | `#EF4444` | `--danger` | ⚠️ openwork `--destructive`=`#EF4343` |
| `--at-gold` | `#F59E0B` | `--warn` | ⚠️ openwork `--warning`=`#F59E0B` (동일값, 토큰명 상이) |
| `--at-primary-hover` | `#0FD2AB` | (없음) | 수동 보정 |
| `--at-border-hover` | `#3F3F46` | (없음) | 수동 보정 |
| `--at-pill-bg` | `#1F1F24` | (없음) | 수동 보정 |
| `--at-success` | `#10B981` | (없음) | 수동 보정 |

**정확 일치 4/14** — 주요 브랜드 색 4개가 실측값 기반이고,
표면/보더/상태색 6개는 UI 설계 시 수동 조정되었습니다.

> 참고: `tokens.css` 의 `--navy: #061257` 는 openwork `rootVars` 에 원본이 없고
> UI 참조도 0건입니다. 정리 대상.

---

## 2. 추출 도구 자체의 이관 (2026-10-25)

`extract-brand.mjs` 는 원래 `kbizhub-dashboard` 에만 untracked 로 존재했습니다
(3개 golive 저장소 모두 git history 포함 미존재).

`tools/brand-extraction/` 로 이관하면서 수행한 변경:

| 변경 | 내용 |
|---|---|
| 헤더 주석 | kbizhub 전용 문구 → 이 저장소 컨텍스트로 일반화 |
| `package.json` | `playwright@1.59.1` devDependency 추가 |
| 재현성 검증 | openwork 재실행 → `rootVars` 완전 동일 확인 |

재실행 결과 차이:

| 항목 | reference | 재실행 | 판정 |
|---|---|---|---|
| `rootVars` | 원본 | **완전 동일** | ✅ |
| `body` / `h1` / `meta` | 원본 | 동일 | ✅ |
| `ctas` | 8개 | 8개 | ✅ |
| `topColors` | rgb(161,161,170) × 45 | × 46 | ±1 픽셀 (동일 렌더링) |

→ 추출은 **재현 가능**합니다.
