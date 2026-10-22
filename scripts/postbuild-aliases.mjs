#!/usr/bin/env node
/**
 * postbuild-aliases.mjs — Generate short-URL alias HTML files for every
 * screens-NN-*.html in dist/, AND copy preserved static pages from
 * scripts/static-pages into dist/.
 *
 * Runs after `vite build` (via `postbuild` in package.json).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const DIST = path.join(ROOT, "dist");
const STATIC_PAGES = path.join(ROOT, "scripts", "static-pages");
const SITE_ORIGIN = "https://golive.wiki";

// Step 1: copy preserved static pages (e.g. 301.html) from source control.
let copiedStatic = 0;
if (fs.existsSync(STATIC_PAGES)) {
  for (const f of fs.readdirSync(STATIC_PAGES)) {
    if (!f.endsWith(".html")) continue;
    const src = path.join(STATIC_PAGES, f);
    const dst = path.join(DIST, f);
    fs.copyFileSync(src, dst);
    copiedStatic++;
  }
}

// Step 2: generate short-URL aliases for every screens-NN-*.html in dist/.
const htmlFiles = fs
  .readdirSync(DIST)
  .filter((f) => /^screens-\d{2}-[A-Za-z0-9_-]+\.html$/.test(f));

let created = 0;
for (const file of htmlFiles) {
  const shortName = file.replace(/^screens-/, "");
  const aliasPath = path.join(DIST, shortName);
  if (fs.existsSync(aliasPath)) continue;

  const targetUrl = `${SITE_ORIGIN}/${file}`;
  const aliasHtml = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${shortName} — golive.wiki</title>
<meta http-equiv="refresh" content="0; url=${targetUrl}"/>
<link rel="canonical" href="${targetUrl}"/>
<style>
  body { background:#0a0a0c; color:#fafafa; font-family:"Plus Jakarta Sans",system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
  .redirect-note { text-align:center; }
  .redirect-note a { color:#14ebc0; }
</style>
</head>
<body>
<div class="redirect-note">
  <p>대시보드로 이동 중…</p>
  <p><a href="${targetUrl}">클릭하여 계속</a></p>
</div>
<script>setTimeout(function(){window.location.replace(${JSON.stringify(targetUrl)});}, 100);</script>
</body>
</html>
`;
  fs.writeFileSync(aliasPath, aliasHtml, "utf-8");
  created++;
}

console.log(
  `[postbuild-aliases] copied ${copiedStatic} static pages + created ${created} short-URL alias HTML files in dist/`,
);
