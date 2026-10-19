// verify-i18n.mjs — Real DOM verification of multilingual UI on all 5 pages
// Uses HTTP server so JSDOM has a proper origin (localStorage works)
import { JSDOM } from "jsdom";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PAGES = [
  "/",
  "/screens-04-dashboard.html",
  "/screens-05-create-gig.html",
  "/screens-06-task-detail.html",
  "/screens-admin.html",
];

const LANGS = ["ko", "en", "vi", "ja", "zh", "hi", "es"];

let totalPass = 0;
let totalFail = 0;
const pageResults = [];

// 1) Spin up a local HTTP server
const server = http.createServer((req, res) => {
  let url = req.url.split("?")[0];
  if (url === "/") url = "/index.html";
  const filePath = path.join(process.cwd(), url);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404).end();
    return;
  }
  const ext = path.extname(filePath);
  const ctype = ext === ".js" ? "application/javascript"
              : ext === ".css" ? "text/css"
              : "text/html; charset=utf-8";
  res.writeHead(200, { "Content-Type": ctype });
  fs.createReadStream(filePath).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
console.log(`Server: ${base}\n`);

// 2) For each page, load via JSDOM and verify
for (const pagePath of PAGES) {
  console.log(`=== ${pagePath} ===`);
  const url = base + pagePath;
  const dom = await JSDOM.fromURL(url, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    url: url,
  });

  // Wait for DOMContentLoaded and defer scripts to execute
  await new Promise((r) => {
    if (dom.window.document.readyState === "complete" || dom.window.document.readyState === "interactive") {
      r();
    } else {
      dom.window.addEventListener("load", r);
    }
  });
  // Give deferred scripts time to execute
  await new Promise((r) => setTimeout(r, 1000));

  const doc = dom.window.document;
  const sampleKey = doc.querySelector("[data-i18n]")?.getAttribute("data-i18n");
  if (!sampleKey) {
    console.log("  ⚠️  No data-i18n key found");
    totalFail++;
    pageResults.push({ page: pagePath, pass: false });
    continue;
  }

  const results = {};
  let pagePass = true;
  
  // Prefer switchLanguage (which calls applyLanguage internally), fall back to applyLanguage
  const applyFn = dom.window.switchLanguage || dom.window.applyLanguage;
  if (typeof applyFn !== "function") {
    console.log("  ⚠️  switchLanguage/applyLanguage not available on window");
    totalFail++;
    pageResults.push({ page: pagePath, pass: false });
    continue;
  }
  
  for (const lang of LANGS) {
    try {
      applyFn(lang);
      const el = doc.querySelector(`[data-i18n="${sampleKey}"]`);
      const txt = el?.innerText || el?.textContent || "";
      results[lang] = txt.slice(0, 80);
    } catch (e) {
      results[lang] = `ERR: ${e.message}`;
      pagePass = false;
    }
  }
  try { applyFn("ko"); } catch (e) {}

  console.log(`  sample key: ${sampleKey}`);
  for (const [lang, txt] of Object.entries(results)) {
    console.log(`    ${lang}: ${txt}`);
  }

  // Check uniqueness across langs (each lang should produce a different string)
  const langVals = Object.values(results);
  const uniqueVals = new Set(langVals);
  if (uniqueVals.size < 4) {
    console.log(`  ⚠️  Only ${uniqueVals.size} unique values across 7 langs — language switching may not work`);
    pagePass = false;
  }

  if (pagePass) {
    console.log("  ✅ PASS");
    totalPass++;
  } else {
    console.log("  ❌ FAIL");
    totalFail++;
  }
  pageResults.push({ page: pagePath, pass: pagePass });
  dom.window.close();
}

server.close();

console.log("\n=== SUMMARY ===");
console.log(`PASS: ${totalPass} / ${PAGES.length}`);
console.log(`FAIL: ${totalFail} / ${PAGES.length}`);
console.log("\nResults table:");
for (const r of pageResults) {
  console.log(`  ${r.pass ? "✅" : "❌"} ${r.page}`);
}
process.exit(totalFail > 0 ? 1 : 0);
