import pkg from "jsdom";
const { JSDOM } = pkg;

const URL = "https://golive.wiki/screens-07-ride.html";
console.log(`Loading ${URL} ...`);
const dom = await JSDOM.fromURL(URL, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
});
await new Promise((r) => dom.window.addEventListener("load", r, { once: true }));
await new Promise((r) => setTimeout(r, 2500));

const w = dom.window;
console.log("=== window globals ===");
console.log("applyLanguage typeof:", typeof w.applyLanguage);
console.log("switchLanguage typeof:", typeof w.switchLanguage);
console.log("toggleLangDropdown typeof:", typeof w.toggleLangDropdown);
console.log("I18N_DICTIONARY typeof:", typeof w.I18N_DICTIONARY);
console.log("agentShowPlan typeof:", typeof w.agentShowPlan);
console.log("agentSubmit typeof:", typeof w.agentSubmit);

if (w.I18N_DICTIONARY) {
  console.log("\n=== I18N_DICTIONARY check ===");
  console.log("ko keys count:", Object.keys(w.I18N_DICTIONARY.ko || {}).length);
  console.log("en keys count:", Object.keys(w.I18N_DICTIONARY.en || {}).length);
  console.log("ko agent_title:", w.I18N_DICTIONARY.ko?.agent_title);
  console.log("en agent_title:", w.I18N_DICTIONARY.en?.agent_title);
  console.log("ja agent_title:", w.I18N_DICTIONARY.ja?.agent_title);
}

const doc = w.document;
const ko = doc.querySelector('[data-i18n="agent_title"]');
console.log("\n=== DOM check (initial KO) ===");
console.log("ko el found:", !!ko);
if (ko) console.log("ko textContent:", ko.textContent);

if (typeof w.applyLanguage === "function") {
  w.applyLanguage("en");
  await new Promise((r) => setTimeout(r, 300));
  if (ko) console.log("after en textContent:", ko.textContent);
  
  w.applyLanguage("ja");
  await new Promise((r) => setTimeout(r, 300));
  if (ko) console.log("after ja textContent:", ko.textContent);
}

dom.window.close();
