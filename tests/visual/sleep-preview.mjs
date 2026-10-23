import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const userData = join(os.tmpdir(), `xiaoshen-sleep-${Date.now()}`);
const env = { ...process.env, XIAOSHEN_TEST: '1', XIAOSHEN_TEST_OFFSCREEN: '1', XIAOSHEN_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'], cwd: root, env });
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__xiaoshenReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.__xiaoshen.closePanel();
    document.getElementById('bubbleWrap').hidden = true;
    document.querySelectorAll('.toast').forEach(n => n.remove());
    window.__xiaoshen.stopTalking();
    window.__xiaoshen.toggleSleep();
    window.__xiaoshen.setView('front');
  });
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    document.getElementById('bubbleWrap').hidden = true;
    document.querySelectorAll('.toast, .particle-z, .particle-dizzy').forEach(n => n.remove());
    document.getElementById('particles').style.display = 'none';
  });
  await page.screenshot({ path: resolve(root, 'tests/out/sleep-clean.png'), omitBackground: true });
  console.log('sleep screenshot saved');
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
