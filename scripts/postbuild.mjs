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
