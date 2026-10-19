import pkg from "jsdom";
const { JSDOM } = pkg;

const URL = "https://golive.wiki/screens-07-ride.html";
console.log(`Loading ${URL} ...`);
const dom = await JSDOM.fromURL(URL, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
});
// Long wait
await new Promise((r) => dom.window.addEventListener("load", r, { once: true }));
for (let i = 0; i < 50 && typeof dom.window.I18N_DICTIONARY === "undefined"; i++) {
  await new Promise((r) => setTimeout(r, 200));
}

console.log(`After wait:`);
console.log("I18N_DICTIONARY:", typeof dom.window.I18N_DICTIONARY);
console.log("applyLanguage:", typeof dom.window.applyLanguage);
console.log("agentShowPlan:", typeof dom.window.agentShowPlan);

const doc = dom.window.document;
console.log("\nDOM [data-i18n=agent_title]:", doc.querySelector('[data-i18n="agent_title"]')?.textContent);
console.log("DOM [data-i18n=agent_send]:", doc.querySelector('[data-i18n="agent_send"]')?.textContent);
console.log("DOM [data-i18n=agent_approve]:", doc.querySelector('[data-i18n="agent_approve"]')?.textContent);

if (typeof dom.window.applyLanguage === "function") {
  dom.window.applyLanguage("en");
  await new Promise((r) => setTimeout(r, 300));
  console.log("\nAfter en:");
  console.log("DOM [data-i18n=agent_title]:", doc.querySelector('[data-i18n="agent_title"]')?.textContent);
  console.log("DOM [data-i18n=agent_send]:", doc.querySelector('[data-i18n="agent_send"]')?.textContent);
}

dom.window.close();
