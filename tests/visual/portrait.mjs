import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const userData = join(os.tmpdir(), `xiaoshen-portrait-${Date.now()}`);
const env = { ...process.env, XIAOSHEN_TEST: '1', XIAOSHEN_TEST_OFFSCREEN: '1', XIAOSHEN_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'], cwd: root, env });
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__xiaoshenReady === true);
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    window.__xiaoshen.closePanel();
    document.getElementById('bubbleWrap').hidden = true;
    document.querySelectorAll('.toast').forEach(n => n.remove());
    window.__xiaoshen.stopTalking();
    window.__xiaoshen.setView('front');
    window.__xiaoshen.setOutfit('sweater');
  });
  await page.waitForTimeout(500);
  let url = await page.evaluate(() => window.__xiaoshen.portrait());
  fs.writeFileSync(resolve(root, 'tests/out/portrait-updo-sweater.png'), Buffer.from(url.split(',')[1], 'base64'));
  await page.evaluate(() => window.__xiaoshen.setOutfit('plaid'));
  await page.waitForTimeout(400);
  url = await page.evaluate(() => window.__xiaoshen.portrait());
  fs.writeFileSync(resolve(root, 'tests/out/portrait-updo-plaid.png'), Buffer.from(url.split(',')[1], 'base64'));
  await page.evaluate(() => window.__xiaoshen.setOutfit('sweater'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(root, 'tests/out/updo-front.png'), omitBackground: true });
} finally { await app.close(); fs.rmSync(userData, {recursive:true, force:true}); }
