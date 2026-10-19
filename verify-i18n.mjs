// verify-i18n.mjs — Real DOM verification of multilingual UI on all pages
//
// Approach: launch one HTTP server, then for each page build a fresh JSDOM
// with runScripts="dangerously" + resources="usable" so that the deferred
// <script src="../styles/i18n.js"> gets fetched and executed. After the
// "load" event we wait 800 ms for the DOMContentLoaded handler to wire up
// initLanguageSwitcher and then call window.applyLanguage(lang) directly.
//
// Each page uses its own JSDOM instance + waits for "load" + post-load delay
// to avoid cross-page I18N_DICTIONARY pollution.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import pkg from "jsdom";
const { JSDOM } = pkg;

const ROOT = process.cwd();
const PAGES = [
  "index.html",
  "screens-04-dashboard.html",
  "screens-05-create-gig.html",
  "screens-06-task-detail.html",
  "screens-admin.html",
];
const LANGS = ["ko", "en", "vi", "ja", "zh", "hi", "es"];

// --- Static HTTP server that resolves /<page> and /styles/<file> ----
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = decodeURIComponent(req.url.split("?")[0]);
      if (url === "/") url = "/index.html";
      const fp = path.join(ROOT, url);
      if (!fs.existsSync(fp)) {
        res.writeHead(404);
        res.end("404");
        return;
      }
      const ext = path.extname(fp);
      const ct =
        ext === ".js"
          ? "application/javascript; charset=utf-8"
          : ext === ".css"
            ? "text/css; charset=utf-8"
            : "text/html; charset=utf-8";
      res.writeHead(200, { "Content-Type": ct });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
  });
}

// --- Custom loader: ignore missing tokens.css so the deferred script runs ---
// (ResourceLoader is not exposed in this jsdom build; missing CSS does not
//  block <script> execution in JSDOM, so we just tolerate the 404.)

async function verifyOne(server, port, pageFile) {
  const url = `http://127.0.0.1:${port}/${pageFile}`;
  const dom = await JSDOM.fromURL(url, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
  });

  // Wait for the "load" event so all <script src> tags finish
  await new Promise((r) =>
    dom.window.addEventListener("load", r, { once: true }),
  );
  // Wait for the DOMContentLoaded handler in i18n.js to run initLanguageSwitcher
  await new Promise((r) => setTimeout(r, 800));

  const doc = dom.window.document;
  const probe = doc.querySelector("[data-i18n]");
  if (!probe) {
    dom.window.close();
    return { page: pageFile, ok: false, reason: "no data-i18n key" };
  }

  const sampleKey = probe.getAttribute("data-i18n");
  const sampleTag = probe.tagName.toLowerCase();
  const langResults = {};

  for (const lang of LANGS) {
    try {
      dom.window.applyLanguage(lang);
      const el = doc.querySelector(`[data-i18n="${sampleKey}"]`);
      langResults[lang] = el ? el.innerText.trim() : "(missing)";
    } catch (e) {
      langResults[lang] = `ERR: ${e.message}`;
    }
  }

  dom.window.close();
  return { page: pageFile, sampleKey, sampleTag, langResults };
}

(async () => {
  const { server, port } = await startServer();
  console.log(`HTTP server: http://127.0.0.1:${port}`);

  let pass = 0;
  let fail = 0;
  const summary = [];

  for (const p of PAGES) {
    try {
      const r = await verifyOne(server, port, p);
      // Pass criteria: at least 6/7 languages yield non-empty text that
      // differs from the initial KO state
      const ko = r.langResults.ko || "";
      const changedLangs = LANGS.filter(
        (l) => r.langResults[l] && r.langResults[l] !== ko,
      );
      const ok = changedLangs.length >= 5; // tolerate 1 missing
      if (ok) pass++;
      else fail++;
      summary.push(r);
      console.log(
        `\n=== ${p} === ${ok ? "✅ PASS" : "❌ FAIL"} (${changedLangs.length}/7 switched)`,
      );
      console.log(`  sample key: ${r.sampleKey} (${r.sampleTag})`);
      for (const lang of LANGS) {
        const v = (r.langResults[lang] || "").slice(0, 60);
        const marker =
          v === ko ? "  (= ko)" : v.startsWith("ERR") ? "  ⚠" : "  ✔";
        console.log(`    ${lang}: ${v}${marker}`);
      }
    } catch (e) {
      fail++;
      console.log(`\n=== ${p} === ❌ ERROR: ${e.message}`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`PASS: ${pass} / ${PAGES.length}`);
  console.log(`FAIL: ${fail} / ${PAGES.length}`);

  server.close();
  process.exit(fail > 0 ? 1 : 0);
})();
