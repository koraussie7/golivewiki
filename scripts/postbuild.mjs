#!/usr/bin/env node
/**
 * postbuild.mjs — Minify and copy styles/ assets into dist/.
 *
 * Vite passes <script src="styles/i18n.js"> through unchanged (no `type="module"`).
 * We use Terser here to minify i18n.js (Vite's internal terser only minifies bundled chunks).
 */
import fs from "node:fs";
import path from "node:path";
import { minify } from "terser";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "styles");
const DEST = path.join(ROOT, "dist", "styles");

fs.mkdirSync(DEST, { recursive: true });

const files = fs.readdirSync(SRC);
let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const srcPath = path.join(SRC, file);
  const destPath = path.join(DEST, file);

  if (!fs.statSync(srcPath).isFile()) continue;

  const raw = fs.readFileSync(srcPath, "utf8");
  totalBefore += raw.length;

  // Try to minify if it's a JS file
  if (file.endsWith(".js")) {
    try {
      const min = await minify(raw, {
        compress: { passes: 2, pure_funcs: ["console.debug"] },
        mangle: { reserved: ["I18N_DICTIONARY", "applyLanguage", "switchLanguage", "toggleLangDropdown"] },
        format: { comments: false },
        sourceMap: false,
      });
      fs.writeFileSync(destPath, min.code);
      const savings = ((1 - min.code.length / raw.length) * 100).toFixed(1);
      console.log(`📦 minified styles/${file} (${(raw.length/1024).toFixed(1)}KB → ${(min.code.length/1024).toFixed(1)}KB, ${savings}% smaller)`);
      totalAfter += min.code.length;
    } catch (e) {
      // Minification failed (e.g. syntax error) — copy as-is
      fs.copyFileSync(srcPath, destPath);
      console.warn(`⚠️  minify failed for ${file}, copied raw: ${e.message}`);
      totalAfter += raw.length;
    }
  } else {
    fs.copyFileSync(srcPath, destPath);
    console.log(`📦 copied styles/${file}`);
    totalAfter += raw.length;
  }
}

const totalSavings = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
console.log(`\n✅ postbuild complete: ${(totalBefore/1024).toFixed(1)}KB → ${(totalAfter/1024).toFixed(1)}KB (${totalSavings}% smaller)`);

// =====================================================================
// Phase 5: Inject <link rel="alternate" hreflang="..."> tags into every
// HTML file in dist/. This is a manual SEO best practice for sites
// without per-locale URLs (we use single URLs with browser-detected
// language switching rather than /ko/, /en/, etc. subpaths).
//
// Convention emitted:
//   <link rel="alternate" hreflang="x-default" href="<page>">
//   <link rel="alternate" hreflang="ko" href="<page>">
//   <link rel="alternate" hreflang="en" href="<page>">
//   ... (one per SUPPORTED_LANGS)
//   <link rel="canonical" href="<page>">
//
// Notes:
//   - x-default signals to Google which URL to show to users whose
//     language preference doesn't match any of our 7 supported languages.
//   - hreflang + canonical self-pointing is required because we serve
//     the same URL regardless of language; hreflang tells crawlers that
//     the URL is the canonical representation of all 7 translations.
// =====================================================================
const SUPPORTED_LANGS = ["ko", "en", "vi", "ja", "zh", "hi", "es"];
const SITE_ORIGIN = "https://golive.wiki";

const distDir = path.join(ROOT, "dist");
const htmlFiles = fs.readdirSync(distDir).filter(f => f.endsWith(".html"));

for (const file of htmlFiles) {
  const filePath = path.join(distDir, file);
  let html = fs.readFileSync(filePath, "utf-8");
  // Use clean URL for the homepage: prefer "/" over "/index.html" because
  // most web servers serve the same content for both. This avoids duplicate
  // canonical signals and matches what users see in the address bar.
  const pageUrl = file === "index.html"
    ? `${SITE_ORIGIN}/`
    : `${SITE_ORIGIN}/${file}`;

  // Skip if we've already injected (idempotent on re-runs)
  if (html.includes('rel="alternate" hreflang=')) {
    continue;
  }

  const tags = [
    `    <link rel="canonical" href="${pageUrl}">`,
    `    <link rel="alternate" hreflang="x-default" href="${pageUrl}">`,
    ...SUPPORTED_LANGS.map(lang =>
      `    <link rel="alternate" hreflang="${lang}" href="${pageUrl}">`
    ),
  ].join("\n");

  // Inject just before the closing </head>
  if (html.includes("</head>")) {
    html = html.replace("</head>", `${tags}\n  </head>`);
    fs.writeFileSync(filePath, html, "utf-8");
    totalAfter += 1;
  }
}

console.log(`[postbuild] hreflang: injected into ${htmlFiles.length} HTML files`);
