// live-agent-test2.mjs — Same as live-agent-test.mjs but with deferred-script workaround
//
// Workaround: After load, manually fetch styles/i18n.js and inject it via eval
// to mimic what a real browser would do for the deferred script.

import pkg from "jsdom";
const { JSDOM } = pkg;
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

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
];

function localServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = decodeURIComponent(req.url.split("?")[0]);
      if (url === "/") url = "/index.html";
      const fp = path.join("/Users/brianyeon/CodeGPT/integration-finalize-2/dist", url);
      if (!fs.existsSync(fp)) { res.writeHead(404).end("404"); return; }
      const ext = path.extname(fp);
      const ct = ext === ".js" ? "application/javascript; charset=utf-8"
        : ext === ".css" ? "text/css; charset=utf-8"
        : "text/html; charset=utf-8";
      res.writeHead(200, { "Content-Type": ct });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;
    get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

const server = await localServer();
const port = server.address().port;
const URL = `http://127.0.0.1:${port}/screens-07-ride.html`;
console.log(`Loading ${URL}`);

const dom = await JSDOM.fromURL(URL, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
});
await new Promise((r) => dom.window.addEventListener("load", r, { once: true }));
await new Promise((r) => setTimeout(r, 1500));

const w = dom.window;
console.log("Pre-inject — I18N_DICTIONARY:", typeof w.I18N_DICTIONARY);

// Inject i18n.js manually to mimic deferred-script execution
const i18nCode = await fetchText(`http://127.0.0.1:${port}/styles/i18n.js`);
w.eval(i18nCode);
// Trigger DOMContentLoaded manually since i18n.js binds via it
w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
await new Promise((r) => setTimeout(r, 400));

console.log("Post-inject — I18N_DICTIONARY:", typeof w.I18N_DICTIONARY);
console.log("Post-inject — applyLanguage:", typeof w.applyLanguage);
console.log("Post-inject — ko agent_title:", w.I18N_DICTIONARY?.ko?.agent_title);
console.log("Post-inject — en agent_title:", w.I18N_DICTIONARY?.en?.agent_title);

const doc = w.document;
const ko = {};
for (const k of KEYS) {
  const el = doc.querySelector(`[data-i18n="${k}"]`);
  ko[k] = (el?.textContent || "").trim();
}
console.log("\nKO snapshot agent_title:", ko.agent_title);

const results = { ko };
for (const lang of LANGS.filter((l) => l !== "ko")) {
  w.applyLanguage(lang);
  await new Promise((r) => setTimeout(r, 150));
  const r = {};
  for (const k of KEYS) {
    const el = doc.querySelector(`[data-i18n="${k}"]`);
    r[k] = (el?.textContent || "").trim();
  }
  results[lang] = r;
}

console.log("\n=== agent_title per language ===");
for (const lang of LANGS) {
  console.log(`  ${lang}: ${results[lang].agent_title}`);
}

console.log("\n=== agent_send per language ===");
for (const lang of LANGS) {
  console.log(`  ${lang}: ${results[lang].agent_send}`);
}

console.log("\n=== agent_approve per language ===");
for (const lang of LANGS) {
  console.log(`  ${lang}: ${results[lang].agent_approve}`);
}

let switched = 0;
for (const lang of LANGS.filter((l) => l !== "ko")) {
  for (const k of KEYS) {
    if (results[lang][k] && results[lang][k] !== ko[k]) switched++;
  }
}
const total = (LANGS.length - 1) * KEYS.length;
console.log(`\n=== RESULT ===`);
console.log(`Switched: ${switched}/${total}`);
console.log(`Verdict: ${switched === total ? "✅ ALL PASS" : switched > total * 0.9 ? "✓ MOSTLY PASS" : "✗ FAIL"}`);

dom.window.close();
server.close();
process.exit(switched === total ? 0 : 1);
