import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'tests/out');
fs.mkdirSync(out, { recursive: true });
const userData = join(os.tmpdir(), `xiaoshen-outfits-${Date.now()}`);
const env = { ...process.env, XIAOSHEN_TEST: '1', XIAOSHEN_TEST_OFFSCREEN: '1', XIAOSHEN_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'], cwd: root, env });
const logs = [];
try {
  const page = await app.firstWindow();
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', (e) => logs.push(`PAGEERROR ${e.message}`));
  await page.waitForFunction(() => window.__xiaoshenReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    window.__xiaoshen.closePanel();
    document.getElementById('bubbleWrap').hidden = true;
    document.querySelectorAll('.toast').forEach(n => n.remove());
    window.__xiaoshen.stopTalking();
    window.__xiaoshen.setView('front');
  });
  const ids = ['sweater', 'plaid', 'windbreakerLilac', 'windbreakerNavy', 'windbreakerBlack', 'crabTee', 'crabCargo', 'blackTop'];
  for (const id of ids) {
    await page.evaluate((outfit) => { window.__xiaoshen.setOutfit(outfit); window.__xiaoshen.setView('front'); }, id);
    await page.waitForTimeout(450);
    await page.screenshot({ path: resolve(out, `new-outfit-${id}.png`), omitBackground: true });
    const url = await page.evaluate(() => window.__xiaoshen.portrait());
    fs.writeFileSync(resolve(out, `new-portrait-${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  // cap on the navy set
  await page.evaluate(() => window.__xiaoshen.setOutfit('windbreakerNavy'));
  await page.evaluate(() => window.__xiaoshen.openPanel('dress'));
  await page.waitForTimeout(350);
  await page.locator('[data-accessory="cap"]').evaluate((el) => el.click());
  await page.waitForTimeout(350);
  const capState = await page.evaluate(() => window.__xiaoshen.getCharacter());
  await page.evaluate(() => { window.__xiaoshen.closePanel(); document.getElementById('bubbleWrap').hidden = true; window.__xiaoshen.stopTalking(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(out, 'new-outfit-cap.png'), omitBackground: true });
  await page.evaluate(() => window.__xiaoshen.openPanel('dress'));
  await page.waitForTimeout(300);
  await page.locator('[data-accessory="cap"]').evaluate((el) => el.click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(out, 'new-wardrobe.png'), omitBackground: true });
  console.log('CAP', JSON.stringify(capState.accessories));
  console.log('LOGS', logs.join('\n') || '(none)');
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
