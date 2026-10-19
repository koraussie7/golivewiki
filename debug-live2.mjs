import pkg from "jsdom";
const { JSDOM } = pkg;

const URL = "https://golive.wiki/screens-07-ride.html";
console.log(`Loading ${URL} ...`);

// Use a local HTTP server that serves from dist/ to bypass JSDOM CDN limitations
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split("?")[0]);
  if (url === "/") url = "/index.html";
  // Map /styles/, /js/ etc to dist/
  const fp = path.join("/Users/brianyeon/CodeGPT/integration-finalize-2/dist", url);
  if (!fs.existsSync(fp)) { res.writeHead(404).end("404"); return; }
  const ext = path.extname(fp);
  const ct = ext === ".js" ? "application/javascript; charset=utf-8"
    : ext === ".css" ? "text/css; charset=utf-8"
    : "text/html; charset=utf-8";
  res.writeHead(200, { "Content-Type": ct });
  fs.createReadStream(fp).pipe(res);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
console.log(`Local server on http://127.0.0.1:${port}`);

const dom = await JSDOM.fromURL(`http://127.0.0.1:${port}/screens-07-ride.html`, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
});
await new Promise((r) => dom.window.addEventListener("load", r, { once: true }));
await new Promise((r) => setTimeout(r, 2500));

const w = dom.window;
console.log("I18N_DICTIONARY typeof:", typeof w.I18N_DICTIONARY);
console.log("agentShowPlan typeof:", typeof w.agentShowPlan);
console.log("agentSubmit typeof:", typeof w.agentSubmit);
console.log("ko agent_title:", w.I18N_DICTIONARY?.ko?.agent_title);
console.log("en agent_title:", w.I18N_DICTIONARY?.en?.agent_title);

const doc = w.document;
const titleEl = doc.querySelector('[data-i18n="agent_title"]');
console.log("\nDOM agent_title textContent:", titleEl?.textContent);

if (typeof w.applyLanguage === "function") {
  w.applyLanguage("en");
  await new Promise((r) => setTimeout(r, 300));
  console.log("after en:", titleEl?.textContent);
  w.applyLanguage("ja");
  await new Promise((r) => setTimeout(r, 300));
  console.log("after ja:", titleEl?.textContent);
}

dom.window.close();
server.close();
