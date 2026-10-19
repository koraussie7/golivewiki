#!/usr/bin/env node
/**
 * validate-i18n.mjs — golive.wiki i18n dictionary coverage validator
 *
 * 1. Parses styles/i18n.js (executed in a sandboxed VM)
 * 2. Collects all data-i18n and data-i18n-ph keys from the HTML pages
 * 3. Verifies every key resolves across all 7 languages
 * 4. Returns exit code 0 on success, 1 on any missing key
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const LANGS = ["ko", "en", "vi", "ja", "zh", "hi", "es"];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const HTML_FILES = [
  "index.html",
  "screens-04-dashboard.html",
  "screens-05-create-gig.html",
  "screens-06-task-detail.html",
  "screens-07-ride.html",
  "screens-admin.html",
];

function loadI18nDict() {
  const code = fs.readFileSync(path.join(ROOT, "styles", "i18n.js"), "utf8");
  const exposed = code
    .replace("const I18N_DICTIONARY = {", "I18N_DICTIONARY = {")
    .replace("function applyLanguage", "applyLanguage = function")
    .replace("function initLanguageSwitcher", "initLanguageSwitcher = function");

  const stubDocument = {
    addEventListener: () => {},
    documentElement: { setAttribute: () => {} },
    querySelectorAll: () => [],
    getElementById: () => null,
    body: { appendChild: () => {} },
    createElement: () => ({ innerHTML: "", appendChild: () => {}, style: {} }),
    cookie: "",
  };
  const ctx = {
    window: {},
    document: stubDocument,
    addEventListener: () => {},
    localStorage: { getItem: () => "ko", setItem: () => {} },
    location: { hostname: "localhost" },
    cookie: "",
  };
  vm.createContext(ctx);
  vm.runInContext(exposed, ctx);
  return ctx.I18N_DICTIONARY;
}

function resolve(dict, key, lang) {
  if (dict[lang] && dict[lang][key]) return dict[lang][key];
  if (dict[key] && dict[key][lang]) return dict[key][lang];
  return null;
}

function extractKeys(html) {
  const i18n = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  const i18nPh = [...html.matchAll(/data-i18n-ph="([^"]+)"/g)].map((m) => m[1]);
  return [...new Set([...i18n, ...i18nPh])];
}

console.log("🔍 golive.wiki i18n validator\n");

let dict;
try {
  dict = loadI18nDict();
  const size = (fs.statSync(path.join(ROOT, "styles", "i18n.js")).size / 1024).toFixed(1);
  console.log(`✅ styles/i18n.js loaded (${size} KB)`);
} catch (e) {
  console.error(`❌ Failed to load i18n.js: ${e.message}`);
  process.exit(1);
}

let totalKeys = 0;
let missing = 0;
const missingDetails = [];

for (const file of HTML_FILES) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  Skipping ${file} (not found)`);
    continue;
  }
  const html = fs.readFileSync(fullPath, "utf8");
  const keys = extractKeys(html);
  console.log(`📄 ${file.padEnd(32)} ${keys.length} unique keys`);

  for (const key of keys) {
    totalKeys++;
    for (const lang of LANGS) {
      const r = resolve(dict, key, lang);
      if (!r) {
        missing++;
        missingDetails.push({ file, key, lang });
      }
    }
  }
}

console.log("\n" + "─".repeat(60));
console.log(`Total unique keys:   ${totalKeys}`);
console.log(`Languages checked:   ${LANGS.join(", ")}`);
console.log(`Missing entries:     ${missing}`);
console.log("─".repeat(60));

if (missing > 0) {
  console.error("\n❌ Missing i18n entries:");
  for (const m of missingDetails.slice(0, 20)) {
    console.error(`   ${m.file} :: ${m.key} (${m.lang})`);
  }
  if (missingDetails.length > 20) {
    console.error(`   ... and ${missingDetails.length - 20} more`);
  }
  process.exit(1);
}

console.log("\n✅ All keys resolve across all 7 languages.");
process.exit(0);
