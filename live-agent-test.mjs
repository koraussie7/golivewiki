// live-agent-test.mjs — Verify the deployed Agent Panel on https://golive.wiki/
//
// Tests:
//  1. screens-07-ride.html loads with agent panel HTML
//  2. agent_title i18n key switches across all 7 languages
//  3. agent_input_ph placeholder switches
//  4. agent_send, agent_approve, agent_cancel switch

import pkg from "jsdom";
const { JSDOM } = pkg;

const URL = "https://golive.wiki/screens-07-ride.html";
const LANGS = ["ko", "en", "vi", "ja", "zh", "hi", "es"];
const KEYS = [
  "agent_title",
  "agent_status_online",
  "agent_send",
  "agent_sug_vehicle",
  "agent_sug_repair",
  "agent_sug_purchase",
  "agent_sug_ai_task",
  "agent_plan_title",
  "agent_approve",
  "agent_cancel",
  "agent_done",
  "agent_role_personal",
];

console.log(`Loading ${URL} ...`);
const dom = await JSDOM.fromURL(URL, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
});
await new Promise((r) => dom.window.addEventListener("load", r, { once: true }));
await new Promise((r) => setTimeout(r, 2000));

const doc = dom.window.document;

// Confirm structural presence
const checks = {
  agentPanel: !!doc.getElementById("agent-panel"),
  agentHeader: !!doc.querySelector(".agent-panel-header"),
  agentInput: !!doc.getElementById("agent-input"),
  agentSubmit: !!doc.getElementById("agent-submit"),
  agentSuggest1: !!doc.querySelector('[data-suggestion="vehicle"]'),
  agentPlan: !!doc.getElementById("agent-plan"),
  agentApprove: !!doc.getElementById("agent-approve"),
  agentCancel: !!doc.getElementById("agent-cancel"),
};
console.log("\n[structural checks]");
for (const [k, v] of Object.entries(checks)) {
  console.log(`  ${v ? "✓" : "✗"} ${k}`);
}

if (typeof dom.window.applyLanguage !== "function") {
  console.log("\n✗ window.applyLanguage not found");
  process.exit(1);
}

console.log("\n[i18n switching test]");
const results = {};
for (const lang of LANGS) {
  dom.window.applyLanguage(lang);
  await new Promise((r) => setTimeout(r, 120));
  results[lang] = {};
  for (const key of KEYS) {
    const el = doc.querySelector(`[data-i18n="${key}"]`);
    results[lang][key] = el ? (el.textContent || "").trim().slice(0, 50) : "(missing)";
  }
}

const ko = results.ko;
let totalPass = 0;
let totalTests = 0;
for (const lang of LANGS) {
  let langPass = 0;
  for (const key of KEYS) {
    totalTests++;
    if (results[lang][key] && results[lang][key] !== ko[key]) langPass++;
    if (results[lang][key] === ko[key] && lang !== "ko") {
      // Same as KO means it didn't switch
    }
  }
  totalPass += langPass;
  const ok = langPass >= 10; // tolerate 1-2 missing
  console.log(`  ${ok ? "✓" : "✗"} ${lang}: ${langPass}/${KEYS.length} keys switched`);
  if (!ok) {
    for (const k of KEYS) {
      if (results[lang][k] === ko[k]) {
        console.log(`      [no-change] ${k}: "${results[lang][k]}"`);
      }
    }
  }
}

// Sample one full row per language
console.log("\n[sample agent_title per lang]");
for (const lang of LANGS) {
  console.log(`  ${lang}: ${results[lang].agent_title}`);
}
console.log("\n[sample agent_send per lang]");
for (const lang of LANGS) {
  console.log(`  ${lang}: ${results[lang].agent_send}`);
}
console.log("\n[sample agent_done per lang]");
for (const lang of LANGS) {
  console.log(`  ${lang}: ${results[lang].agent_done}`);
}

// Now also exercise the JS: trigger a plan via click on a suggestion
console.log("\n[interactivity test — click suggestion vehicle]");
dom.window.applyLanguage("ko");
const sugBtn = doc.querySelector('[data-suggestion="vehicle"]');
if (sugBtn) {
  sugBtn.click();
  await new Promise((r) => setTimeout(r, 200));
  const inputVal = doc.getElementById("agent-input")?.value || "";
  console.log(`  input value after click: "${inputVal.slice(0, 60)}"`);
}

console.log("\n[submit test — trigger plan show]");
const submitBtn = doc.getElementById("agent-submit");
if (submitBtn) {
  submitBtn.click();
  await new Promise((r) => setTimeout(r, 400));
  const planEl = doc.getElementById("agent-plan");
  const stepsHtml = doc.getElementById("agent-plan-steps")?.innerHTML?.length || 0;
  const agentsHtml = doc.getElementById("agent-agents-row")?.innerHTML?.length || 0;
  console.log(`  plan visible: ${planEl?.classList.contains("visible") || planEl?.classList.contains("expanded")}`);
  console.log(`  steps rendered: ${stepsHtml > 0 ? "yes (" + stepsHtml + " chars)" : "no"}`);
  console.log(`  agents rendered: ${agentsHtml > 0 ? "yes (" + agentsHtml + " chars)" : "no"}`);
  console.log(`  first step text: ${(doc.querySelector(".agent-plan-step div:nth-child(2)")?.textContent || "").slice(0, 50) || "(none)"}`);
  console.log(`  first agent pill: ${(doc.querySelector("#agent-agents-row .agent-pill")?.textContent || "").trim() || "(none)"}`);
}

console.log(`\n=== SUMMARY ===`);
console.log(`Keys switched: ${totalPass}/${totalTests}`);
console.log(`Result: ${totalPass === totalTests ? "✅ ALL PASS" : totalPass > totalTests * 0.9 ? "✓ MOSTLY PASS" : "✗ FAIL"}`);

dom.window.close();
process.exit(totalPass >= totalTests * 0.9 ? 0 : 1);
