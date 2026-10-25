#!/usr/bin/env node
// extract-brand.mjs — 직접 로그인 후 브랜드 토큰 추출 (Playwright + 시스템 Chrome)
//
// web-client/public/styles/tokens.css 의 근거 데이터를 만드는 도구.
//
// 사용법 (tools/brand-extraction 폴더에서 실행):
//   node extract-brand.mjs https://www.airtasker.com/au/
//     → 브라우저 창이 열리면 직접 로그인 → 터미널에서 Enter
//     → brand-tokens-<호스트>.json + brand-<호스트>.png 저장
//   node extract-brand.mjs https://www.openwork.network/ --headless
//     → 로그인 없이 바로 추출 (동작 확인용)
//
// 주의: Cloudflare 보호 사이트는 챌린지 페이지가 그대로 추출됩니다.
//       reference/FAILURES.md 참고.

import { chromium } from 'playwright';
import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'https://www.airtasker.com/au/';
const headless = process.argv.includes('--headless');
const host = new URL(url).hostname.replace(/^www\./, '');

let browser;
try {
  browser = await chromium.launch({ headless, channel: 'chrome' });
} catch (e) {
  console.error('시스템 Chrome 실행 실패:', e.message);
  console.error('대안: npx playwright install chromium 후 channel 옵션을 지우세요.');
  process.exit(1);
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'domcontentloaded' });

if (!headless) {
  console.log('\n열린 브라우저 창에서 직접 로그인하세요 (Cloudflare 확인 포함).');
  console.log('로그인이 감지되면 자동 추출됩니다. 바로 추출하려면 Enter를 누르세요.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const entered = new Promise((resolve) => rl.once('line', () => resolve('enter')));
  const detected = (async () => {
    for (let i = 0; i < 200; i++) { // 최대 약 10분 대기
      await page.waitForTimeout(3000);
      let state;
      try {
        state = await page.evaluate(() => ({
          url: location.href,
          text: document.body.innerText.slice(0, 4000),
        }));
      } catch {
        return 'closed';
      }
      const challenge = /보안 확인|잠시만 기다리십시오|Verifying you are human|Checking your browser/i.test(state.text);
      const loggedIn = /\/dashboard|\/account|\/my-tasks|Log out|My tasks/i.test(`${state.url}\n${state.text}`);
      if (!challenge && loggedIn) return 'login';
    }
    return 'timeout';
  })();
  const how = await Promise.race([entered, detected]);
  rl.close();
  console.log(how === 'login' ? '로그인 감지 → 추출 시작' : '추출 시작');
}

await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

const tokens = await page.evaluate(() => {
  const css = (el) => getComputedStyle(el);
  const body = document.body;
  const head = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = css(el);
    return {
      text: (el.innerText || '').slice(0, 100),
      font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, color: s.color,
    };
  };
  const ctas = Array.from(document.querySelectorAll('a, button'))
    .filter((el) => {
      const bg = css(el).backgroundColor;
      return bg !== 'rgba(0, 0, 0, 0)' && (el.innerText || '').trim().length > 0;
    })
    .slice(0, 8)
    .map((el) => {
      const s = css(el);
      return {
        text: (el.innerText || '').slice(0, 30), bg: s.backgroundColor,
        color: s.color, radius: s.borderRadius, padding: s.padding,
      };
    });
  const counts = {};
  document.querySelectorAll('a, button, h1, h2, h3, p, header, nav').forEach((el) => {
    const s = css(el);
    [s.color, s.backgroundColor].forEach((c) => {
      if (c && c !== 'rgba(0, 0, 0, 0)') counts[c] = (counts[c] || 0) + 1;
    });
  });
  const topColors = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  let rootVars = '';
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText === ':root' && (rule.cssText || '').includes('--')) {
          rootVars += rule.cssText.slice(0, 2000);
        }
      }
    } catch { /* cross-origin 시트 접근 불가 — 무시 */ }
  }
  return {
    body: { bg: css(body).backgroundColor, color: css(body).color, font: css(body).fontFamily },
    h1: head('h1'),
    h2: head('h2'),
    ctas,
    topColors,
    fonts: [...document.fonts].map((f) => ({ family: f.family, weight: f.weight, style: f.style })),
    rootVars: rootVars.slice(0, 2000),
  };
});
tokens.meta = { url: page.url(), title: await page.title() };

const jsonPath = `brand-tokens-${host}.json`;
const pngPath = `brand-${host}.png`;
writeFileSync(jsonPath, JSON.stringify(tokens, null, 2));
await page.screenshot({ path: pngPath, fullPage: false });

console.log(`\n저장 완료: ${jsonPath}, ${pngPath}`);
console.log(`배경: ${tokens.body.bg} / 본문: ${tokens.body.color}`);
console.log(`CTA ${tokens.ctas.length}개, 상위 색상 ${tokens.topColors.length}개 추출`);

await browser.close();
