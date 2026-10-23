import { _electron as electron } from 'playwright-core';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = resolve(root, 'tests/out');
mkdirSync(outDir, { recursive: true });
const userData = resolve(os.tmpdir(), `xiaoshen-visual-${Date.now()}`);

const env = { ...process.env, XIAOSHEN_TEST: '1', XIAOSHEN_TEST_OFFSCREEN: '1', XIAOSHEN_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;

const app = await electron.launch({ args: ['.', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'], cwd: root, env });
const logs = [];

try {
  const page = await app.firstWindow();
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (error) => logs.push(`[pageerror] ${error.message}`));
  await page.waitForFunction(() => window.__xiaoshenReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(900);

  async function hideOverlays() {
    await page.evaluate(() => {
      window.__xiaoshen.closePanel();
      document.getElementById('bubbleWrap').hidden = true;
      document.querySelectorAll('.toast').forEach((n) => n.remove());
      document.getElementById('contextMenu').hidden = true;
      window.__xiaoshen.stopTalking();
    });
    await page.waitForTimeout(250);
  }

  await hideOverlays();
  await page.evaluate(() => window.__xiaoshen.setView('front'));
  await page.waitForTimeout(1100);
  await page.screenshot({ path: resolve(outDir, 'initial.png'), omitBackground: true });

  for (const view of ['front', 'left', 'back', 'right']) {
    await page.evaluate((v) => window.__xiaoshen.setView(v), view);
    await page.waitForTimeout(950);
    await page.screenshot({ path: resolve(outDir, `view-${view}.png`), omitBackground: true });
  }
  await page.evaluate(() => window.__xiaoshen.setView('front'));
  await page.waitForTimeout(600);

  for (const tab of ['interact', 'focus', 'dress', 'settings']) {
    await page.evaluate((t) => window.__xiaoshen.openPanel(t), tab);
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(outDir, `panel-${tab}.png`), omitBackground: true });
    await page.evaluate(() => window.__xiaoshen.closePanel());
    await page.waitForTimeout(180);
  }

  await page.evaluate(() => window.__xiaoshen.openPanel('chat'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(outDir, 'chat-empty.png'), omitBackground: true });
  await page.fill('#chatInput', '今天有点累，不太想动');
  await page.press('#chatInput', 'Enter');
  await page.waitForTimeout(1700);
  await page.screenshot({ path: resolve(outDir, 'chat-reply.png'), omitBackground: true });

  await page.evaluate(() => { window.__xiaoshen.closePanel(); window.__xiaoshen.setOutfit('plaid'); window.__xiaoshen.setView('front'); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(outDir, 'outfit-plaid.png'), omitBackground: true });

  await page.evaluate(() => window.__xiaoshen.setOutfit('sweater'));
  await page.evaluate(() => window.__xiaoshen.toggleSleep());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(outDir, 'sleeping.png'), omitBackground: true });
  await page.evaluate(() => window.__xiaoshen.wake());

  console.log('PERF', JSON.stringify(await page.evaluate(() => window.__xiaoshen.getPerf())));
  console.log('LOGS', logs.join('\n') || '(none)');
} finally {
  await app.close();
  rmSync(userData, { recursive: true, force: true });
}
