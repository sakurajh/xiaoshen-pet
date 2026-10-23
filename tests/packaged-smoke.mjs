import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
try {
  const contexts = browser.contexts();
  const pages = contexts.flatMap((c) => c.pages());
  const page = pages.find((p) => p.url().includes('index.html')) || pages[0];
  assert.ok(page, 'packaged renderer page found');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.waitForFunction(() => window.__xiaoshenReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => window.petAPI.getAppInfo());
  assert.equal(info.packaged, true, 'packaged mode reported');
  assert.equal(info.version, '1.0.0');
  const perf = await page.evaluate(() => window.__xiaoshen.getPerf());
  assert.ok(perf.fps >= 30, `fps ${perf.fps}`);
  console.log('INFO', JSON.stringify(info));
  console.log('PERF', JSON.stringify(perf));
  await page.evaluate(() => { window.__xiaoshen.closePanel(); document.getElementById('bubbleWrap').hidden = true; window.__xiaoshen.stopTalking(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(root, 'tests/out/packaged-initial.png'), omitBackground: true });
  // Exercise a bundled UI path in the packaged renderer.
  await page.evaluate(() => window.__xiaoshen.openPanel('interact'));
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#panel').isVisible(), true);
  await page.locator('[data-testid="action-feed"]').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__xiaoshen.openPanel('chat'));
  await page.waitForTimeout(250);
  await page.fill('#chatInput', '打包版本测试');
  await page.press('#chatInput', 'Enter');
  await page.waitForTimeout(1300);
  const state = await page.evaluate(() => window.__xiaoshen.getState());
  assert.ok(state.chat.some((m) => m.text === '打包版本测试'), 'chat works in packaged app');
  assert.ok(state.chat.at(-1).text.length > 2);
  await page.evaluate(() => { window.__xiaoshen.closePanel(); document.getElementById('bubbleWrap').hidden = true; window.__xiaoshen.stopTalking(); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(root, 'tests/out/packaged-final.png'), omitBackground: true });
  assert.deepEqual(errors, []);
  console.log('PACKAGED SMOKE PASSED');
} finally {
  await browser.close();
}
