import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const userData = join(os.tmpdir(), `xiaoshen-boundary-${Date.now()}`);
const env = { ...process.env, XIAOSHEN_TEST: '1', XIAOSHEN_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'], cwd: root, env });
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__xiaoshenReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const initial = (await app.evaluate(() => global.__xiaoshenDebug())).bounds;
  const patch = await app.evaluate(({ screen }) => {
    global.__realGetCursor = screen.getCursorScreenPoint.bind(screen);
    global.__fakeCursor = { x: 1200, y: 700 };
    try {
      screen.getCursorScreenPoint = () => ({ x: global.__fakeCursor.x, y: global.__fakeCursor.y });
      return screen.getCursorScreenPoint().x === 1200;
    } catch (e) { return String(e); }
  });
  assert.equal(patch, true, 'fake cursor patch');
  await page.evaluate(() => window.petAPI.startDrag());
  await page.waitForTimeout(70);
  await app.evaluate(() => { global.__fakeCursor = { x: 150, y: 200 }; });
  await page.waitForTimeout(220);
  await page.evaluate(() => window.petAPI.endDrag());
  await page.waitForTimeout(180);
  const dragged = (await app.evaluate(() => global.__xiaoshenDebug())).bounds;
  assert.equal(dragged.x, initial.x - 1050, 'x follows the cursor without whole-window clamp');
  assert.equal(dragged.y, initial.y - 500, 'y follows the cursor without whole-window clamp');
  assert.ok(dragged.x < 0 || dragged.y < 0, 'window is allowed off-screen to reach the pet edge');
  const anchor = { x: dragged.x + 640, y: dragged.y + 590 };
  const area = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().workArea);
  assert.ok(anchor.x > area.x && anchor.x < area.x + area.width, 'pet anchor remains on screen');
  assert.ok(anchor.y > area.y && anchor.y < area.y + area.height, 'pet anchor remains on screen vertically');

  // Opening a panel from the off-screen window must bring the panel back into view.
  await page.evaluate(() => window.__xiaoshen.openPanel('interact'));
  await page.waitForTimeout(350);
  assert.equal(await page.locator('#panel').isVisible(), true, 'panel opened');
  const withPanel = (await app.evaluate(() => global.__xiaoshenDebug())).bounds;
  assert.ok(withPanel.x + 18 >= area.x + 8, 'panel left is reachable');
  assert.ok(withPanel.x + 18 + 392 <= area.x + area.width - 8, 'panel right is inside');
  assert.ok(withPanel.y + 26 >= area.y + 8, 'panel top is reachable');
  assert.ok(withPanel.y + 26 + 748 <= area.y + area.height - 8, 'panel bottom is inside');

  await page.evaluate(() => window.__xiaoshen.closePanel());
  await page.waitForTimeout(350);
  const restored = (await app.evaluate(() => global.__xiaoshenDebug())).bounds;
  assert.equal(restored.x, dragged.x, 'closing panel restores pet position x');
  assert.equal(restored.y, dragged.y, 'closing panel restores pet position y');

  // At the right edge, the menu dock flips inward and bubbles stay readable.
  await app.evaluate(({ BrowserWindow, screen }) => {
    const a = screen.getPrimaryDisplay().workArea;
    BrowserWindow.getAllWindows()[0].setPosition(a.x + a.width - 640, a.y + 180);
  });
  await page.waitForTimeout(1300);
  const dockEdge = await page.evaluate(() => document.getElementById('dock').classList.contains('edge-left'));
  assert.equal(dockEdge, true, 'dock flips inward at right screen edge');
  await page.evaluate(() => window.__xiaoshen.showBubble('边缘气泡测试，确认不会跑出屏幕。', { immediate: true, talk: false }));
  await page.waitForTimeout(220);
  const bubbleBox = await page.evaluate(() => {
    const r = document.getElementById('bubbleWrap').getBoundingClientRect();
    return { left: r.left + window.screenX, right: r.right + window.screenX, top: r.top + window.screenY, bottom: r.bottom + window.screenY, availLeft: window.screen.availLeft, availTop: window.screen.availTop, availWidth: window.screen.availWidth, availHeight: window.screen.availHeight };
  });
  assert.ok(bubbleBox.left >= bubbleBox.availLeft + 4, 'bubble left stays on screen');
  assert.ok(bubbleBox.right <= bubbleBox.availLeft + bubbleBox.availWidth - 4, 'bubble right stays on screen');
  assert.ok(bubbleBox.top >= bubbleBox.availTop + 4, 'bubble top stays on screen');
  assert.ok(bubbleBox.bottom <= bubbleBox.availTop + bubbleBox.availHeight - 4, 'bubble bottom stays on screen');
  console.log(JSON.stringify({ initial, dragged, anchor, withPanel, restored, bubbleBox }));
  console.log('BOUNDARY TEST PASSED');
} finally {
  await app.evaluate(({ screen }) => {
    if (global.__realGetCursor) screen.getCursorScreenPoint = global.__realGetCursor;
  }).catch(() => {});
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}
