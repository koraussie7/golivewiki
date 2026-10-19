// final-live-verify.mjs
//
// Comprehensive verification of the LIVE site by fetching the actual deployed
// assets and running them through JSDOM in a way that mirrors browser behavior:
//
// 1. Fetch screens-07-ride.html from golive.wiki
// 2. Fetch styles/i18n.js from golive.wiki
// 3. Fetch js/screens-07-bundle.js from golive.wiki
// 4. Build JSDOM with runScripts="dangerously", resources="usable"
// 5. Wait for both inline + external scripts to settle
// 6. Apply each language and read the agent_* DOM text

import pkg from "jsdom";
const { JSDOM } = pkg;
import https from "node:https";
import http from "node:http";

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} on ${url}`));
        return;
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

const BASE = "https://golive.wiki";
console.log("Fetching live assets...");
const [html, i18nCode, bundleCode] = await Promise.all([
  fetchText(`${BASE}/screens-07-ride.html`),
  fetchText(`${BASE}/styles/i18n.js`),
  fetchText(`${BASE}/js/screens-07-bundle.js`),
]);
console.log(`HTML: ${html.length} chars`);
console.log(`i18n.js: ${i18nCode.length} chars`);
console.log(`bundle.js: ${bundleCode.length} chars`);

console.log("\nLoading into JSDOM with resources=usable...");
const dom = new JSDOM(html, {
  url: `${BASE}/screens-07-ride.html`,
  runScripts: "outside-only", // We control script injection ourselves
  pretendToBeVisual: true,
});

// Strip external <script src> from the HTML (we'll inject manually)
const doc = dom.window.document;
const scriptTags = [...doc.querySelectorAll("script[src]")];
const inlineScripts = [...doc.querySelectorAll("script:not([src])")];

// Remove external scripts from DOM (they'll be injected as text)
scriptTags.forEach((s) => s.remove());

// Execute scripts in order: leaflet (sync), then bundle (defer), then inline
console.log("\nExecuting scripts...");

// 1. i18n.js (was in <head>, no defer)
try {
  dom.window.eval(i18nCode);
  console.log("✓ i18n.js executed");
} catch (e) {
  console.log("✗ i18n.js error:", e.message);
}

// 2. bundle.js (was defer, after DOMContentLoaded would have fired by now)
// First, ensure DOMContentLoaded has been dispatched so bundle's listener fires
dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
await new Promise((r) => setTimeout(r, 200));
try {
  dom.window.eval(bundleCode);
  console.log("✓ bundle.js executed");
} catch (e) {
  console.log("✗ bundle.js error:", e.message);
}

// 3. Inline scripts
inlineScripts.forEach((s, i) => {
  try {
    dom.window.eval(s.textContent);
    console.log(`✓ inline script ${i + 1} executed`);
  } catch (e) {
    console.log(`✗ inline script ${i + 1} error:`, e.message);
  }
});

await new Promise((r) => setTimeout(r, 200));

const w = dom.window;
console.log("\n=== Window globals ===");
console.log("I18N_DICTIONARY:", typeof w.I18N_DICTIONARY);
console.log("applyLanguage:", typeof w.applyLanguage);
console.log("agentShowPlan:", typeof w.agentShowPlan);
console.log("agentSubmit:", typeof w.agentSubmit);
console.log("agentSuggest:", typeof w.agentSuggest);
console.log("initAgentPanel:", typeof w.initAgentPanel);
console.log("switchLanguage:", typeof w.switchLanguage);
console.log("toggleLangDropdown:", typeof w.toggleLangDropdown);

const LANGS = ["ko", "en", "vi", "ja", "zh", "hi", "es"];
const KEYS = ["agent_title", "agent_status_online", "agent_send",
  "agent_sug_vehicle", "agent_sug_repair", "agent_sug_purchase",
  "agent_sug_ai_task", "agent_plan_title", "agent_plan_vehicle",
  "agent_plan_repair", "agent_plan_purchase", "agent_plan_ai_task",
  "agent_step_v1_personal", "agent_step_v1_discovery", "agent_step_v1_task",
  "agent_role_personal", "agent_role_discovery", "agent_role_task",
  "agent_role_negotiation", "agent_role_verification",
  "agent_approve", "agent_cancel", "agent_done"];

console.log("\n=== Static i18n switching test ===");
const koSnap = {};
for (const k of KEYS) {
  const el = doc.querySelector(`[data-i18n="${k}"]`);
  koSnap[k] = (el?.textContent || "").trim();
}

const results = { ko: koSnap };
for (const lang of LANGS.filter((l) => l !== "ko")) {
  try {
    w.applyLanguage(lang);
  } catch (e) {
    console.log(`  ⚠ applyLanguage(${lang}) failed:`, e.message);
  }
  await new Promise((r) => setTimeout(r, 100));
  results[lang] = {};
  for (const k of KEYS) {
    const el = doc.querySelector(`[data-i18n="${k}"]`);
    results[lang][k] = (el?.textContent || "").trim();
  }
}

console.log("\nagent_title per language:");
for (const lang of LANGS) console.log(`  ${lang}: ${results[lang].agent_title}`);

console.log("\nagent_send per language:");
for (const lang of LANGS) console.log(`  ${lang}: ${results[lang].agent_send}`);

console.log("\nagent_approve per language:");
for (const lang of LANGS) console.log(`  ${lang}: ${results[lang].agent_approve}`);

console.log("\nagent_cancel per language:");
for (const lang of LANGS) console.log(`  ${lang}: ${results[lang].agent_cancel}`);

console.log("\nagent_done per language (rendered dynamically by JS):");
console.log(`  ko (I18N_DICTIONARY): ${w.I18N_DICTIONARY?.ko?.agent_done}`);
console.log(`  en: ${w.I18N_DICTIONARY?.en?.agent_done}`);
console.log(`  ja: ${w.I18N_DICTIONARY?.ja?.agent_done}`);

// Score
let switched = 0;
let total = 0;
for (const lang of LANGS.filter((l) => l !== "ko")) {
  for (const k of KEYS) {
    if (results[lang][k] && results[lang][k] !== koSnap[k]) switched++;
    total++;
  }
}
console.log(`\n=== STATIC RESULT ===`);
console.log(`Static data-i18n keys switched: ${switched}/${total}`);

const dynamicOK = ["agent_done", "agent_plan_default"];
let dynOK = 0;
for (const k of dynamicOK) {
  for (const lang of LANGS) {
    if (w.I18N_DICTIONARY?.[lang]?.[k]) dynOK++;
  }
}
console.log(`Dynamic agent keys (7 langs × ${dynamicOK.length}): ${dynOK}/${dynamicOK.length * LANGS.length}`);

// Now exercise the agent interactivity
console.log("\n=== Agent interactivity test ===");
const inter = await w.eval(`
  (function() {
    const out = {};
    // Click first suggestion
    const sug = document.querySelector('[data-suggestion="vehicle"]');
    out.sugFound = !!sug;
    if (sug) sug.click();
    out.inputAfterClick = (document.getElementById('agent-input')?.value || '').slice(0, 60);
    // Click submit
    const sub = document.getElementById('agent-submit');
    out.submitFound = !!sub;
    if (sub) sub.click();
    return new Promise(r => setTimeout(() => r({
      ...out,
      planVisible: document.getElementById('agent-plan')?.classList.contains('visible'),
      stepCount: document.querySelectorAll('.agent-plan-step').length,
      pillCount: document.querySelectorAll('#agent-agents-row .agent-pill').length,
      firstStep: (document.querySelector('.agent-plan-step div:nth-child(2)')?.textContent || '').slice(0, 50),
      firstPill: (document.querySelector('#agent-agents-row .agent-pill')?.textContent || '').trim(),
    }), 400));
  })()
`);

console.log(JSON.stringify(inter, null, 2));

const verdict =
  switched === total &&
  dynOK === dynamicOK.length * LANGS.length &&
  inter.sugFound &&
  inter.submitFound &&
  inter.stepCount >= 5 &&
  inter.pillCount >= 5
    ? "✅ ALL PASS"
    : "❌ FAIL";

console.log(`\n=== FINAL VERDICT: ${verdict} ===`);

dom.window.close();
process.exit(verdict.includes("✅") ? 0 : 1);
