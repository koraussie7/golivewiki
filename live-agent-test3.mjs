// live-agent-test3.mjs — Proper deferred-script wait
import pkg from "jsdom";
const { JSDOM } = pkg;
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const LANGS = ["ko", "en", "vi", "ja", "zh", "hi", "es"];
const KEYS = ["agent_title", "agent_status_online", "agent_send",
  "agent_sug_vehicle", "agent_sug_repair", "agent_sug_purchase",
  "agent_sug_ai_task", "agent_plan_title", "agent_approve", "agent_cancel"];

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/") url = "/index.html";
  const fp = path.join("/Users/brianyeon/CodeGPT/integration-finalize-2/dist", url);
  if (!fs.existsSync(fp)) { res.writeHead(404).end("404"); return; }
  const ext = path.extname(fp);
  res.writeHead(200, { "Content-Type": ext === ".js" ? "application/javascript; charset=utf-8" : "text/html; charset=utf-8" });
  fs.createReadStream(fp).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const dom = await JSDOM.fromURL(`http://127.0.0.1:${port}/screens-07-ride.html`, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
});

// Wait for both load and DOMContentLoaded with a generous delay
await new Promise((r) => dom.window.addEventListener("load", r, { once: true }));
// Check if I18N_DICTIONARY exists, else keep waiting
for (let i = 0; i < 30 && typeof dom.window.I18N_DICTIONARY === "undefined"; i++) {
  await new Promise((r) => setTimeout(r, 200));
}
console.log(`Waited up to 30 ticks. I18N_DICTIONARY:`, typeof dom.window.I18N_DICTIONARY);
console.log("applyLanguage:", typeof dom.window.applyLanguage);
console.log("agentShowPlan:", typeof dom.window.agentShowPlan);
console.log("agentSubmit:", typeof dom.window.agentSubmit);

const doc = dom.window.document;
const ko = {};
for (const k of KEYS) {
  ko[k] = (doc.querySelector(`[data-i18n="${k}"]`)?.textContent || "").trim();
}

const results = { ko };
for (const lang of LANGS.filter((l) => l !== "ko")) {
  dom.window.applyLanguage(lang);
  await new Promise((r) => setTimeout(r, 150));
  const r = {};
  for (const k of KEYS) {
    r[k] = (doc.querySelector(`[data-i18n="${k}"]`)?.textContent || "").trim();
  }
  results[lang] = r;
}

console.log("\n=== agent_title ===");
for (const lang of LANGS) console.log(`  ${lang}: ${results[lang].agent_title}`);
console.log("\n=== agent_send ===");
for (const lang of LANGS) console.log(`  ${lang}: ${results[lang].agent_send}`);
console.log("\n=== agent_approve ===");
for (const lang of LANGS) console.log(`  ${lang}: ${results[lang].agent_approve}`);

let switched = 0;
for (const lang of LANGS.filter((l) => l !== "ko")) {
  for (const k of KEYS) {
    if (results[lang][k] && results[lang][k] !== ko[k]) switched++;
  }
}
const total = (LANGS.length - 1) * KEYS.length;
console.log(`\nSwitched: ${switched}/${total}`);
console.log(`Verdict: ${switched === total ? "✅ ALL PASS" : switched > total * 0.9 ? "✓ MOSTLY" : "✗ FAIL"}`);

dom.window.close();
server.close();
process.exit(switched === total ? 0 : 1);
