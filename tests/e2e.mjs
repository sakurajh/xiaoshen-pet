import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { OUTFITS } from '../src/renderer/features/outfits.js';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'tests/out');
fs.mkdirSync(outDir, { recursive: true });
const userData = join(os.tmpdir(), `xiaoshen-e2e-${Date.now()}`);
const photoPath = join(outDir, `portrait-${Date.now()}.png`);

const aiRequests = [];
const aiServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      });
      res.end();
      return;
    }
    try {
      aiRequests.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
    } catch {
      aiRequests.push({ url: req.url, auth: req.headers.authorization, body });
    }
    const payload = {
      choices: [{ message: { role: 'assistant', content: '这是本地测试模型的回复。' } }]
    };
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    }, 120);
  });
});
await new Promise((done) => aiServer.listen(0, '127.0.0.1', done));
const aiPort = aiServer.address().port;

const env = { ...process.env, XIAOSHEN_TEST: '1', XIAOSHEN_TEST_OFFSCREEN: '1', XIAOSHEN_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;

const app = await electron.launch({
  args: ['.', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  cwd: root,
  env
});
const page = await app.firstWindow();
const mainLogs = [];
app.process().stdout?.on('data', (d) => mainLogs.push(String(d)));
app.process().stderr?.on('data', (d) => mainLogs.push(String(d)));
const errors = [];
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

const checks = [];
function pass(name) {
  checks.push(name);
  console.log(`PASS ${name}`);
}
const getState = () => page.evaluate(() => window.__xiaoshen.getState());
const getChar = () => page.evaluate(() => window.__xiaoshen.getCharacter());
const debug = () => app.evaluate(() => global.__xiaoshenDebug());
const perf = () => page.evaluate(() => window.__xiaoshen.getPerf());
const logCtx = async (label) => {
  const ui = await page.evaluate(() => ({
    tab: window.__xiaoshen.activeTab(),
    open: window.__xiaoshen.isPanelOpen(),
    char: window.__xiaoshen.getCharacter(),
    panelVisible: !document.getElementById('panel').hidden
  }));
  console.log('CTX', label, JSON.stringify(ui));
};
const closePanel = async () => {
  await page.evaluate(() => window.__xiaoshen.closePanel());
  await page.waitForTimeout(120);
};
const openPanel = async (tab) => {
  await page.evaluate((t) => window.__xiaoshen.openPanel(t), tab);
  await page.waitForTimeout(220);
};

async function moveTo(x, y, expected, label) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.mouse.move(x, y, { steps: 2 });
    await page.waitForTimeout(220);
    const interactive = await page.evaluate(() => window.__xiaoshen.windowInteractive());
    const mainState = await debug();
    if (interactive === expected && mainState.ignore === !expected) return;
  }
  throw new Error(`interactive state did not become ${expected} at ${x},${y} (${label})`);
}

async function findHit(zone) {
  return page.evaluate((wanted) => {
    const rect = document.getElementById('scene').getBoundingClientRect();
    const hits = [];
    for (let y = rect.top + 2; y < rect.bottom - 2; y += 4) {
      for (let x = rect.left + 4; x < rect.right - 4; x += 4) {
        const hit = window.__xiaoshen.hitTest(x, y);
        if (hit.hit && hit.zone === wanted) hits.push({ x, y });
      }
    }
    if (!hits.length) return null;
    const cx = hits.reduce((sum, p) => sum + p.x, 0) / hits.length;
    const cy = hits.reduce((sum, p) => sum + p.y, 0) / hits.length;
    let best = hits[0];
    let bestD = Infinity;
    for (const p of hits) {
      const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }, zone);
}

try {
  await page.waitForFunction(() => window.__xiaoshenReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(1200);

  const initialDebug = await debug();
  assert.equal(initialDebug.visible, true, 'window is visible');
  assert.equal(initialDebug.tray, true, 'tray created');
  assert.equal(initialDebug.windowCount, 1, 'single window');
  pass('app launches with one visible window and tray');

  const initial = await getState();
  assert.equal(initial.settings.outfit, 'sweater');
  assert.equal(initial.settings.scale, 0.9);
  assert.equal(initial.pomodoro.mode, 'focus');
  pass('default state restored');

  const rafDiagnostic = await page.evaluate(() => new Promise((done) => {
    let n = 0;
    const start = performance.now();
    function tick() {
      n += 1;
      if (performance.now() - start < 1000) requestAnimationFrame(tick);
      else done({ n, hidden: document.hidden, state: document.visibilityState, focus: document.hasFocus() });
    }
    requestAnimationFrame(tick);
  }));
  console.log('RAF_DIAGNOSTIC', JSON.stringify(rafDiagnostic));
  const firstPerf = await perf();
  assert.ok(firstPerf.fps >= 30, `fps ${firstPerf.fps}`);
  assert.ok(firstPerf.drawCalls < 300, `draw calls ${firstPerf.drawCalls}`);
  assert.ok(firstPerf.triangles < 260000, `triangles ${firstPerf.triangles}`);
  pass(`render performance ${firstPerf.fps} fps / ${firstPerf.drawCalls} calls`);

  // Hit testing + window click-through contract
  const headPoint = await findHit('head');
  const bodyPoint = await findHit('body');
  assert.ok(headPoint, 'head hit point');
  assert.ok(bodyPoint, 'body hit point');
  await moveTo(headPoint.x, headPoint.y, true, 'head');
  assert.equal((await debug()).ignore, false, 'window accepts mouse over pet');
  await moveTo(60, 180, false, 'blank');
  assert.equal((await debug()).ignore, true, 'window ignores blank area');
  pass('3D hit testing toggles transparent window click-through');

  // Petting via real pointer coordinates
  const petsBefore = (await getState()).totalPets;
  await moveTo(headPoint.x, headPoint.y, true, 'head-click');
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(220);
  const afterPet = await getState();
  assert.equal(afterPet.totalPets, petsBefore + 1, 'pet click counted');
  assert.equal((await getChar()).action, 'pet', 'pet animation running');
  assert.equal(await page.locator('#bubbleWrap').isVisible(), true, 'speech bubble visible');
  pass('petting a head with the real mouse works');

  // Context menu
  await page.mouse.click(bodyPoint.x, bodyPoint.y, { button: 'right' });
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#contextMenu').isVisible(), true, 'context menu opens');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#contextMenu').isHidden(), true, 'context menu closes');
  pass('right-click context menu');

  // Dock + interaction panel
  const dockChat = page.getByTestId('dock-chat');
  const dockBox = await dockChat.boundingBox();
  await page.mouse.move(dockBox.x + dockBox.width / 2, dockBox.y + dockBox.height / 2);
  await page.waitForTimeout(160);
  await page.mouse.click(dockBox.x + dockBox.width / 2, dockBox.y + dockBox.height / 2);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#panel').isVisible(), true, 'panel opens from dock');
  assert.equal(await page.evaluate(() => window.__xiaoshen.activeTab()), 'chat');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#panel').isHidden(), true, 'Escape closes panel');
  pass('dock hover/click opens chat and Escape closes it');

  // Interactions
  await openPanel('interact');
  const satietyBefore = (await getState()).satiety;
  await page.getByTestId('action-feed').click();
  await page.waitForTimeout(250);
  const fed = await getState();
  assert.ok(fed.satiety > satietyBefore, 'feeding increases satiety');
  assert.equal((await getChar()).action, 'eat');
  await page.waitForTimeout(300);
  assert.equal(await page.getByTestId('action-sleep').isVisible(), true);
  await page.getByTestId('action-sleep').click();
  await page.waitForTimeout(300);
  assert.equal((await getState()).sleeping, true, 'sleep state stored');
  assert.equal((await getChar()).sleeping, true, 'character sleeps');
  assert.equal((await getChar()).chair, true, 'sleep chair visible');
  await page.getByTestId('action-sleep').click();
  await page.waitForTimeout(300);
  assert.equal((await getState()).sleeping, false, 'wake works');
  assert.equal((await getChar()).chair, false, 'sleep chair hidden after wake');
  await page.getByTestId('action-pet').click();
  await page.getByTestId('action-photo').waitFor();
  for (const action of ['heart', 'laugh', 'grumpy', 'yawn', 'cheer']) {
    await page.getByTestId(`action-${action}`).click();
    await page.waitForTimeout(260);
    assert.equal((await getChar()).action, action, `action ${action}`);
  }
  await page.getByTestId('action-random').click();
  await page.waitForTimeout(260);
  assert.ok((await getChar()).action, 'random action starts');
  pass('feed, sleep chair, wake, pet, talent actions and random action');

  // Four views and outfit
  await openPanel('dress');
  await page.getByTestId('outfit-plaid').click();
  await page.waitForTimeout(120);
  await page.getByTestId('outfit-windbreakerLilac').click();
  await page.waitForTimeout(120);
  await page.getByTestId('outfit-crabTee').click();
  await page.waitForTimeout(300);
  assert.equal((await getChar()).action, 'dizzy', 'rapid outfit change reaction');
  assert.match(await page.locator('#bubbleText').textContent(), /别换/);
  await page.getByTestId('outfit-plaid').click();
  await page.waitForTimeout(250);
  assert.equal((await getChar()).outfit, 'plaid');
  await page.getByTestId('outfit-sweater').click();
  await page.waitForTimeout(250);
  assert.equal((await getChar()).outfit, 'sweater');
  assert.equal((await getState()).settings.outfit, 'sweater');
  for (const outfit of OUTFITS) {
    await page.getByTestId(`outfit-${outfit.id}`).click();
    await page.waitForTimeout(180);
    assert.equal((await getChar()).outfit, outfit.id, `character outfit ${outfit.id}`);
    assert.equal((await getState()).settings.outfit, outfit.id, `stored outfit ${outfit.id}`);
  }
  await page.getByTestId('outfit-sweater').click();
  await page.waitForTimeout(180);
  const glasses = page.locator('[data-accessory="glasses"]');
  await glasses.evaluate((el) => el.click());
  await page.waitForTimeout(200);
  assert.equal((await getChar()).accessories.glasses, false);
  assert.equal((await getState()).settings.accessories.glasses, false);
  await page.locator('[data-accessory="glasses"]').evaluate((el) => el.click());
  await page.waitForTimeout(200);
  assert.equal((await getChar()).accessories.glasses, true);
  const capSwitch = page.locator('[data-accessory="cap"]');
  assert.equal(await capSwitch.count(), 1, 'cap accessory control exists');
  await capSwitch.evaluate((el) => el.click());
  await page.waitForTimeout(200);
  assert.equal((await getChar()).accessories.cap, true, 'cap visible');
  assert.equal((await getState()).settings.accessories.cap, true, 'cap persisted in state');
  await page.locator('[data-accessory="cap"]').evaluate((el) => el.click());
  await page.waitForTimeout(200);
  assert.equal((await getChar()).accessories.cap, false, 'cap toggles off');
  await page.locator('[data-command="view:back"]').click();
  await page.waitForTimeout(500);
  const backChar = await getChar();
  assert.ok(Math.abs(backChar.targetView - Math.PI) < 0.01);
  await page.locator('[data-command="view:front"]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-command="scale:0.88"]').click();
  await page.waitForTimeout(200);
  assert.equal((await getChar()).scale, 0.88);
  await page.locator('[data-command="quality:power"]').click();
  await page.waitForTimeout(300);
  assert.equal((await perf()).quality, 'power');
  await page.locator('[data-command="quality:high"]').click();
  await page.waitForTimeout(200);
  await page.getByTestId('outfit-windbreakerNavy').click();
  await page.waitForTimeout(900);
  const storedJson = await page.evaluate(() => JSON.parse(localStorage.getItem('xiaoshen.state.v1')));
  assert.equal(storedJson.settings.outfit, 'windbreakerNavy', 'outfit saved to localStorage');
  await page.reload();
  await page.waitForFunction(() => window.__xiaoshenReady === true, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  assert.equal((await getState()).settings.outfit, 'windbreakerNavy', 'outfit restored after reload');
  assert.equal((await getChar()).outfit, 'windbreakerNavy', '3D outfit restored after reload');
  await page.evaluate(() => window.__xiaoshen.openPanel('dress'));
  await page.waitForTimeout(300);
  await page.getByTestId('outfit-sweater').click();
  await page.waitForTimeout(250);
  await logCtx('after-wardrobe');
  pass('wardrobe, accessories, cap, four views, scale, quality and persistence');

  // Timer lifecycle including completion
  await openPanel('focus');
  await logCtx('focus-open');
  await page.getByTestId('timer-toggle').click();
  await page.waitForTimeout(400);
  assert.equal((await getState()).pomodoro.running, true);
  assert.equal(await page.locator('#focusChip').isVisible(), true);
  await page.getByTestId('timer-toggle').click();
  await page.waitForTimeout(250);
  assert.equal((await getState()).pomodoro.running, false);
  await page.evaluate(() => window.__xiaoshen.setPomodoro(1200));
  await page.waitForFunction(() => {
    const s = window.__xiaoshen.getState();
    return s.today.focusMinutes > 0 && s.pomodoro.mode === 'break';
  }, null, { timeout: 6000 });
  await logCtx('after-timer-complete');
  assert.equal(await page.evaluate(() => window.__xiaoshen.isPanelOpen()), true, 'focus panel stays open');
  assert.equal(await page.evaluate(() => window.__xiaoshen.activeTab()), 'focus', 'focus tab stays selected');
  assert.equal((await getState()).settings.outfit, 'sweater', 'outfit stays sweater during timer');
  const completed = await getState();
  assert.equal(completed.today.focusMinutes, 25, 'focus minutes credited');
  assert.equal(completed.pomodoro.mode, 'break', 'switched to break');
  pass('pomodoro start, pause, completion and focus stats');
  await page.locator('[data-command="timer-reset"]').click();
  await page.waitForTimeout(200);

  // Water and reminders
  await page.locator('[data-change="water-enabled"]').evaluate((el) => el.click());
  await page.waitForTimeout(300);
  assert.equal((await getState()).settings.water.enabled, true);
  const waterBefore = (await getState()).settings.water.lastAt;
  await page.getByTestId('water-drink').click();
  await page.waitForTimeout(250);
  assert.ok((await getState()).settings.water.lastAt >= waterBefore);
  assert.equal(await page.locator('#bubbleWrap').isVisible(), true);
  const reminderTime = new Date(Date.now() + 40 * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  const reminderValue = `${reminderTime.getFullYear()}-${pad(reminderTime.getMonth() + 1)}-${pad(reminderTime.getDate())}T${pad(reminderTime.getHours())}:${pad(reminderTime.getMinutes())}`;
  await page.fill('#reminderTitle', '喝水测试提醒');
  await page.fill('#reminderAt', reminderValue);
  await page.selectOption('#reminderRepeat', 'once');
  await page.getByTestId('add-reminder').click();
  await page.waitForTimeout(350);
  const withReminder = await getState();
  assert.equal(withReminder.reminders.length, 1);
  assert.equal(withReminder.reminders[0].title, '喝水测试提醒');
  await page.evaluate(() => window.__xiaoshen.fireNextReminderForTest());
  await page.waitForTimeout(300);
  const fired = await getState();
  assert.ok(fired.reminders[0].lastFired > 0, 'reminder fired');
  assert.equal(fired.reminders[0].done, true);
  pass('water reminder, drink action and one-off reminder firing');

  // Chat fallback (local)
  await openPanel('chat');
  const chatBefore = (await getState()).chat.length;
  await page.fill('#chatInput', '今天有点累，不太想动');
  await page.press('#chatInput', 'Enter');
  await page.waitForTimeout(1400);
  const afterChat = await getState();
  assert.equal(afterChat.chat.length, chatBefore + 2, 'chat stores user and reply');
  assert.equal(afterChat.chat.at(-2).role, 'user');
  assert.equal(afterChat.chat.at(-1).role, 'assistant');
  assert.ok(afterChat.chat.at(-1).text.length > 5);
  assert.ok((await getState()).today.chats >= 1);
  pass('local chat replies and persists');

  // AI path against a local OpenAI-compatible server
  await openPanel('settings');
  await page.locator('[data-change="ai-enabled"]').evaluate((el) => el.click());
  await page.waitForTimeout(300);
  await page.locator('details.advanced summary').click();
  await page.fill('#aiBaseUrl', `http://127.0.0.1:${aiPort}/v1`);
  await page.fill('#aiModel', 'test-model');
  await page.fill('#aiApiKey', 'sk-test-key');
  await page.locator('form[data-form="ai"] button[type="submit"]').click();
  await page.waitForTimeout(300);
  const aiState = await getState();
  assert.equal(aiState.settings.ai.model, 'test-model');
  assert.equal(aiState.settings.ai.enabled, true);
  await openPanel('chat');
  const aiChatBefore = (await getState()).chat.length;
  await page.fill('#chatInput', '用测试接口回答我');
  await page.press('#chatInput', 'Enter');
  await page.waitForTimeout(1800);
  const afterAi = await getState();
  assert.equal(afterAi.chat.length, aiChatBefore + 2);
  assert.equal(afterAi.chat.at(-1).text, '这是本地测试模型的回复。');
  assert.ok(aiRequests.length >= 1, 'AI endpoint called');
  assert.equal(aiRequests[0].auth, 'Bearer sk-test-key');
  assert.equal(aiRequests[0].body.model, 'test-model');
  pass('AI chat via OpenAI-compatible endpoint');

  // Settings toggles
  await openPanel('settings');
  await page.locator('[data-change="voice"]').evaluate((el) => el.click());
  await page.waitForTimeout(200);
  assert.equal((await getState()).settings.voice, false);
  await page.locator('[data-change="voice"]').evaluate((el) => el.click());
  await page.waitForTimeout(200);
  assert.equal((await getState()).settings.voice, true);
  await page.locator('[data-change="always-on-top"]').evaluate((el) => el.click());
  await page.waitForTimeout(500);
  assert.equal((await debug()).alwaysOnTop, false);
  await page.locator('[data-change="always-on-top"]').evaluate((el) => el.click());
  await page.waitForTimeout(500);
  assert.equal((await debug()).alwaysOnTop, true);
  pass('voice and always-on-top settings');

  // Photo export with a stubbed native save dialog
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, photoPath);
  await openPanel('dress');
  await page.locator('.panel-body [data-command="photo"]').click();
  for (let i = 0; i < 30 && !fs.existsSync(photoPath); i += 1) await page.waitForTimeout(100);
  assert.equal(fs.existsSync(photoPath), true, 'portrait file saved');
  const png = fs.readFileSync(photoPath);
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(width, 1080);
  assert.equal(height, 1350);
  pass('portrait export saves a 1080x1350 PNG');

  // Hide / show through tray-level window controls
  await openPanel('settings');
  await page.locator('.panel-body [data-command="hide-app"]').click();
  await page.waitForTimeout(400);
  assert.equal((await debug()).visible, false, 'window hidden');
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].showInactive();
  });
  await page.waitForTimeout(400);
  assert.equal((await debug()).visible, true, 'window restored');
  pass('hide to tray and restore');

  // Hover the panel enables the window; empty space ignores it again
  await openPanel('interact');
  await page.mouse.move(200, 200);
  await page.waitForTimeout(150);
  assert.equal((await debug()).ignore, false, 'panel area accepts mouse');
  await page.mouse.move(620, 180);
  await page.waitForTimeout(150);
  assert.equal((await debug()).ignore, true, 'empty space remains click-through');
  await closePanel();
  pass('click-through does not leak while panel is open');

  // Real-ish drag pose, rapid mouse shake and rapid pokes
  const gesturePoint = await findHit('head');
  assert.ok(gesturePoint, 'gesture head point');
  await page.mouse.move(gesturePoint.x, gesturePoint.y);
  await page.waitForTimeout(200);
  await page.mouse.down();
  await page.mouse.move(gesturePoint.x + 34, gesturePoint.y + 12, { steps: 4 });
  await page.waitForTimeout(250);
  assert.equal((await getChar()).dragging, true, 'drag pose active');
  await page.mouse.up();
  await page.waitForTimeout(320);
  assert.equal((await getChar()).dragging, false, 'drag pose released');

  await page.evaluate(() => { window.__xiaoshen.closePanel(); document.getElementById('bubbleWrap').hidden = true; });
  await page.waitForTimeout(200);
  await page.mouse.move(gesturePoint.x, gesturePoint.y);
  for (let i = 0; i < 10; i += 1) {
    await page.mouse.move(gesturePoint.x + (i % 2 ? 60 : -60), gesturePoint.y + (i % 2 ? 12 : -12));
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(300);
  assert.equal((await getChar()).action, 'dizzy', 'mouse shake triggers dizzy');
  assert.ok((await page.locator('#bubbleText').textContent()).length > 2, 'shake bubble shown');
  await page.waitForTimeout(1900);

  await page.mouse.move(gesturePoint.x, gesturePoint.y);
  for (let i = 0; i < 3; i += 1) { await page.mouse.click(gesturePoint.x, gesturePoint.y); await page.waitForTimeout(90); }
  await page.waitForTimeout(260);
  assert.equal((await getChar()).action, 'startled', 'rapid pokes trigger startled');
  assert.match(await page.locator('#bubbleText').textContent(), /别戳/);
  pass('drag pose, mouse-shake reaction and rapid-poke reaction');

  // Stability loop
  for (let i = 0; i < 8; i += 1) {
    await openPanel(i % 2 ? 'dress' : 'chat');
    await closePanel();
    await page.evaluate((name) => window.__xiaoshen.playAction(name), ['wave', 'nod', 'jump', 'spin'][i % 4]);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1200);
  const finalPerf = await perf();
  assert.ok(finalPerf.fps >= 30, `stability fps ${finalPerf.fps}`);
  assert.ok(finalPerf.rendererInfo.geometries < 400, 'no geometry leak');
  const metrics = await app.evaluate(({ app: electronApp }) => electronApp.getAppMetrics().map((p) => ({
    type: p.type,
    rss: p.memory?.workingSetSize || 0
  })));
  const rssMb = Math.round(metrics.reduce((sum, m) => sum + m.rss, 0) / 1024);
  assert.ok(rssMb < 1500, `RSS ${rssMb} MB`);
  pass(`stability loop, ${finalPerf.fps} fps, RSS ${rssMb} MB`);

  await page.screenshot({ path: resolve(outDir, 'e2e-final.png'), omitBackground: true });
  assert.deepEqual(errors, [], `renderer errors: ${errors.join(' | ')}`);
  pass('no renderer console or page errors');

  console.log(`\nE2E PASSED (${checks.length} checks)`);
} catch (error) {
  console.error('E2E FAILED:', error);
  try {
    await page.screenshot({ path: resolve(outDir, 'e2e-failure.png'), omitBackground: true });
    const state = await getState();
    console.error('STATE', JSON.stringify(state));
    console.error('ERRORS', errors.join('\n'));
    console.error('DEBUG', JSON.stringify(await debug()));
  } catch (inner) {
    console.error('failed to capture diagnostics', inner);
  }
  process.exitCode = 1;
} finally {
  await app.close().catch(() => {});
  aiServer.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
