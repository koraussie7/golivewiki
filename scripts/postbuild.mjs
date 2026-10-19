#!/usr/bin/env node
/**
 * postbuild.mjs — Minify and copy external assets into dist/.
 *
 * Vite passes <script src="..."> references through unchanged (no `type="module"`),
 * so anything referenced from HTML but not bundled by Vite must be copied here.
 *
 * Currently copies:
 *   styles/   → dist/styles/   (minify .js files via terser)
 *   js/       → dist/js/       (minify .js files via terser; recurses into subdirs)
 */
import fs from "node:fs";
import path from "node:path";
import { minify } from "terser";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC_DIRS = ["styles", "js"];
const DIST_ROOT = path.join(ROOT, "dist");

let totalBefore = 0;
let totalAfter = 0;

async function processFile(srcPath, destPath) {
  const raw = fs.readFileSync(srcPath, "utf8");
  totalBefore += raw.length;
  if (srcPath.endsWith(".js")) {
    try {
      const min = await minify(raw, {
        compress: { passes: 2, pure_funcs: ["console.debug"] },
        mangle: { reserved: ["I18N_DICTIONARY", "applyLanguage", "switchLanguage", "toggleLangDropdown", "CATEGORIES"] },
        format: { comments: false },
        sourceMap: false,
      });
      fs.writeFileSync(destPath, min.code);
      const savings = ((1 - min.code.length / raw.length) * 100).toFixed(1);
      const rel = path.relative(ROOT, srcPath);
      console.log(`📦 minified ${rel} (${(raw.length/1024).toFixed(1)}KB → ${(min.code.length/1024).toFixed(1)}KB, ${savings}% smaller)`);
      totalAfter += min.code.length;
    } catch (e) {
      fs.copyFileSync(srcPath, destPath);
      console.warn(`⚠️  minify failed for ${path.relative(ROOT, srcPath)}, copied raw: ${e.message}`);
      totalAfter += raw.length;
    }
  } else {
    fs.copyFileSync(srcPath, destPath);
    console.log(`📦 copied ${path.relative(ROOT, srcPath)}`);
    totalAfter += raw.length;
  }
}

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

for (const dir of SRC_DIRS) {
  const srcDir = path.join(ROOT, dir);
  const destDir = path.join(DIST_ROOT, dir);
  fs.mkdirSync(destDir, { recursive: true });
  if (!fs.existsSync(srcDir)) {
    console.warn(`⚠️  ${dir}/ not found, skipping`);
    continue;
  }
  for (const srcFile of walk(srcDir)) {
    const rel = path.relative(srcDir, srcFile);
    const destFile = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    await processFile(srcFile, destFile);
  }
}

const totalSavings = totalBefore > 0 ? ((1 - totalAfter / totalBefore) * 100).toFixed(1) : "0";
console.log(`\n✅ postbuild complete: ${(totalBefore/1024).toFixed(1)}KB → ${(totalAfter/1024).toFixed(1)}KB (${totalSavings}% smaller)`);
