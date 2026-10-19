export default async function run(page, ui) {
  // 1. Wait for agent panel
  await page.waitForSelector('[data-i18n="agent_title"]');

  // 2. Get initial KO state
  const ko = await page.evaluate(() => ({
    title: document.querySelector('[data-i18n="agent_title"]')?.textContent,
    send: document.querySelector('[data-i18n="agent_send"]')?.textContent,
    approve: document.querySelector('[data-i18n="agent_approve"]')?.textContent,
    label: document.getElementById('current-lang-label')?.innerText,
    panelVisible: document.getElementById('agent-panel')?.classList.contains('expanded'),
  }));

  // 3. Snapshot the page to find language buttons
  const tree = await ui.snapshot({ full: true });
  console.log("Snapshot contains 'KO':", tree.includes('KO'));
  console.log("Snapshot contains 'EN':", tree.includes('EN'));

  // 4. Click on EN button via selector
  const enBtn = await page.$('.lang-opt');
  // Actually, click the EN option directly
  await page.evaluate(() => {
    // Find EN option
    const opts = document.querySelectorAll('.lang-opt');
    for (const o of opts) {
      if (o.textContent.includes('EN')) { o.click(); return 'clicked'; }
    }
    return 'not found';
  });
  await page.waitForTimeout(500);

  // 5. Get state after EN
  const en = await page.evaluate(() => ({
    title: document.querySelector('[data-i18n="agent_title"]')?.textContent,
    send: document.querySelector('[data-i18n="agent_send"]')?.textContent,
    approve: document.querySelector('[data-i18n="agent_approve"]')?.textContent,
    label: document.getElementById('current-lang-label')?.innerText,
  }));

  // 6. Switch to JA
  await page.evaluate(() => {
    const opts = document.querySelectorAll('.lang-opt');
    for (const o of opts) {
      if (o.textContent.includes('JA')) { o.click(); return; }
    }
  });
  await page.waitForTimeout(500);
  const ja = await page.evaluate(() => ({
    title: document.querySelector('[data-i18n="agent_title"]')?.textContent,
    send: document.querySelector('[data-i18n="agent_send"]')?.textContent,
    approve: document.querySelector('[data-i18n="agent_approve"]')?.textContent,
    label: document.getElementById('current-lang-label')?.innerText,
  }));

  // 7. Test agent interactivity
  const interactivity = await page.evaluate(() => {
    // Click first suggestion
    const sug = document.querySelector('[data-suggestion="vehicle"]');
    if (!sug) return { sugFound: false };
    sug.click();
    const inputVal = document.getElementById('agent-input')?.value || '';
    // Click submit
    document.getElementById('agent-submit')?.click();
    return new Promise(r => setTimeout(() => r({
      sugFound: true,
      inputAfterClick: inputVal.slice(0, 60),
      planVisible: document.getElementById('agent-plan')?.classList.contains('visible'),
      stepCount: document.querySelectorAll('.agent-plan-step').length,
      pillCount: document.querySelectorAll('#agent-agents-row .agent-pill').length,
      firstStepText: document.querySelector('.agent-plan-step div:nth-child(2)')?.textContent,
      firstPillText: document.querySelector('#agent-agents-row .agent-pill')?.textContent,
    }), 400));
  });

  return { ko, en, ja, interactivity };
}
