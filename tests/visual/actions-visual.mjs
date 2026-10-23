import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'tests/out');
fs.mkdirSync(out, { recursive: true });
const userData = join(os.tmpdir(), `xiaoshen-actions-${Date.now()}`);
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
  const clean = async () => {
    await page.evaluate(() => {
      window.__xiaoshen.closePanel();
      document.getElementById('bubbleWrap').hidden = true;
      document.querySelectorAll('.toast').forEach(n => n.remove());
      window.__xiaoshen.stopTalking();
      window.__xiaoshen.setView('front');
    });
  };
  await clean();
  for (const action of ['heart', 'laugh', 'grumpy', 'yawn', 'cheer', 'dizzy', 'startled']) {
    await page.evaluate((a) => { window.__xiaoshen.closePanel(); document.getElementById('bubbleWrap').hidden = true; window.__xiaoshen.stopTalking(); window.__xiaoshen.playAction(a); }, action);
    await page.waitForTimeout(340);
    await page.screenshot({ path: resolve(out, `action-${action}.png`), omitBackground: true });
  }
  await page.evaluate(() => window.__xiaoshen.setDragging(true));
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(out, 'action-dragging.png'), omitBackground: true });
  await page.evaluate(() => window.__xiaoshen.setDragging(false));
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__xiaoshen.closePanel(); document.getElementById('bubbleWrap').hidden = true; window.__xiaoshen.toggleSleep(); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve(out, 'sleep-chair-front.png'), omitBackground: true });
  await page.evaluate(() => window.__xiaoshen.setView('left'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve(out, 'sleep-chair-left.png'), omitBackground: true });
  const sleepChar = await page.evaluate(() => window.__xiaoshen.getCharacter());
  await page.evaluate(() => { window.__xiaoshen.setView('front'); window.__xiaoshen.wake(); });
  await page.waitForTimeout(500);
  const wakeChar = await page.evaluate(() => window.__xiaoshen.getCharacter());
  await page.evaluate(() => window.__xiaoshen.openPanel('interact'));
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(out, 'actions-panel.png'), omitBackground: true });
  console.log('SLEEP', JSON.stringify({sleepChar, wakeChar}));
  console.log('LOGS', logs.join('\n') || '(none)');
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
