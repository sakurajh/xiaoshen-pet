const { app, BrowserWindow, ipcMain, screen, Notification, Tray, Menu, nativeImage, dialog, globalShortcut, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { PET_ANCHOR, keepPetVisible, keepPanelVisible } = require('./windowGeometry');

const APP_NAME = '小申桌宠';

// A desktop pet must keep animating even when it does not own keyboard focus
// or is partially covered. Chromium otherwise throttles rAF heavily.
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
const WINDOW_WIDTH = 840;
const WINDOW_HEIGHT = 800;
const TEST_OFFSCREEN = process.env.XIAOSHEN_TEST_OFFSCREEN === '1';

app.setName(APP_NAME);
if (process.env.XIAOSHEN_USER_DATA) {
  app.setPath('userData', process.env.XIAOSHEN_USER_DATA);
}
if (process.platform === 'win32') {
  app.setAppUserModelId('com.xiaoshen.pet');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let win = null;
let tray = null;
let dragSession = null;
let dragTimer = null;
let panelReturnBounds = null;
let panelMainOpen = false;
let interactive = false;
let isQuitting = false;
let lastRendererCrash = null;
let trayHiddenNoticeShown = false;

const userDataFile = (name) => path.join(app.getPath('userData'), name);
const prefsPath = () => userDataFile('preferences.json');

function readPrefs() {
  try {
    return JSON.parse(fs.readFileSync(prefsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writePrefs(patch) {
  try {
    const next = { ...readPrefs(), ...patch };
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2), 'utf8');
    return next;
  } catch (err) {
    console.error('Failed to save preferences:', err);
    return null;
  }
}

function assetPath(name) {
  return path.join(__dirname, '..', '..', 'assets', name);
}

function getDefaultBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  if (TEST_OFFSCREEN) {
    return {
      x: Math.round(area.x - WINDOW_WIDTH - 220),
      y: Math.round(area.y + 20),
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT
    };
  }
  return {
    x: Math.round(area.x + area.width - WINDOW_WIDTH - 16),
    y: Math.round(area.y + area.height - WINDOW_HEIGHT - 8),
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT
  };
}

function petAnchorFor(bounds) {
  return { x: bounds.x + PET_ANCHOR.x, y: bounds.y + PET_ANCHOR.y };
}

function ensurePetOnScreen(bounds) {
  if (TEST_OFFSCREEN) return bounds;
  const anchor = petAnchorFor(bounds);
  const area = screen.getDisplayNearestPoint(anchor).workArea;
  return keepPetVisible(bounds, area);
}

function ensurePanelOnScreen() {
  if (!win || win.isDestroyed() || TEST_OFFSCREEN) return;
  const bounds = win.getBounds();
  const area = screen.getDisplayNearestPoint(petAnchorFor(bounds)).workArea;
  const next = keepPanelVisible(bounds, area);
  if (next.x === bounds.x && next.y === bounds.y) return;
  if (!panelReturnBounds) panelReturnBounds = { x: bounds.x, y: bounds.y };
  win.setPosition(next.x, next.y, false);
}

function createWindow() {
  const prefs = readPrefs();
  const saved = prefs.windowBounds;
  const bounds = ensurePetOnScreen(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
    ? { ...getDefaultBounds(), x: saved.x, y: saved.y }
    : getDefaultBounds());

  win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    alwaysOnTop: prefs.alwaysOnTop !== false,
    title: APP_NAME,
    icon: assetPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
      devTools: !app.isPackaged || process.env.XIAOSHEN_DEVTOOLS === '1'
    }
  });

  if (prefs.alwaysOnTop !== false) {
    win.setAlwaysOnTop(true, 'floating');
  }
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.showInactive();
    if (TEST_OFFSCREEN) {
      const area = screen.getPrimaryDisplay().workArea;
      win.setPosition(Math.round(area.x - WINDOW_WIDTH - 220), Math.round(area.y + 20), false);
    }
    win.setIgnoreMouseEvents(true, { forward: true });
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.on('did-finish-load', () => {
    panelMainOpen = false;
    panelReturnBounds = null;
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    lastRendererCrash = { ...details, at: Date.now() };
    console.error('Renderer gone:', JSON.stringify(details));
    if (!isQuitting) {
      setTimeout(() => {
        if (win && !win.isDestroyed()) win.reload();
      }, 800);
    }
  });

  win.on('move', () => {
    if (dragSession || !win) return;
    const [x, y] = win.getPosition();
    writePrefs({ windowBounds: { x, y } });
  });

  win.on('hide', () => {
    interactive = false;
    win.setIgnoreMouseEvents(true, { forward: true });
  });

  win.on('blur', () => {
    if (dragSession) endDrag(true);
  });

  win.on('closed', () => {
    win = null;
  });
}

function currentAlwaysOnTop() {
  return readPrefs().alwaysOnTop !== false;
}

function setAlwaysOnTop(value) {
  const next = !!value;
  writePrefs({ alwaysOnTop: next });
  if (win && !win.isDestroyed()) {
    win.setAlwaysOnTop(next, next ? 'floating' : 'normal');
  }
  rebuildTrayMenu();
  win?.webContents.send('app:settings-changed', { alwaysOnTop: next });
  return next;
}

function loginExecutable() {
  if (process.env.PORTABLE_EXECUTABLE_FILE) return process.env.PORTABLE_EXECUTABLE_FILE;
  return process.execPath;
}

function getLaunchAtStartup() {
  try {
    return app.getLoginItemSettings({ path: loginExecutable() }).openAtLogin;
  } catch {
    return false;
  }
}

function setLaunchAtStartup(value) {
  if (!app.isPackaged) {
    return { ok: false, enabled: false, reason: '开发模式下不写入开机启动，打包版可用' };
  }
  try {
    app.setLoginItemSettings({
      openAtLogin: !!value,
      path: loginExecutable(),
      args: []
    });
    return { ok: true, enabled: getLaunchAtStartup() };
  } catch (err) {
    return { ok: false, enabled: getLaunchAtStartup(), reason: String(err.message || err) };
  }
}

function showWindow() {
  if (!win) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.showInactive();
  win.setAlwaysOnTop(currentAlwaysOnTop(), currentAlwaysOnTop() ? 'floating' : 'normal');
}

function hideWindow() {
  if (!win) return;
  win.hide();
  if (!trayHiddenNoticeShown && tray) {
    trayHiddenNoticeShown = true;
    try {
      new Notification({
        title: '小申躲到托盘里啦',
        body: '双击右下角托盘图标，或按 Ctrl+Shift+X 让小申回来。',
        icon: assetPath('icon.png'),
        silent: true
      }).show();
    } catch {
      /* notifications are optional */
    }
  }
}

function toggleWindow() {
  if (!win) {
    createWindow();
    return;
  }
  if (win.isVisible()) hideWindow();
  else showWindow();
}

function sendAction(action) {
  showWindow();
  win?.webContents.send('app:action', action);
}

function rebuildTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: '叫小申出来', click: () => showWindow() },
    { label: '摸摸小申', click: () => sendAction('pet') },
    { label: '打开聊天', click: () => sendAction('chat') },
    { label: '开始专注', click: () => sendAction('pomodoro') },
    { type: 'separator' },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: currentAlwaysOnTop(),
      click: (item) => setAlwaysOnTop(item.checked)
    },
    {
      label: '开机自动出现',
      type: 'checkbox',
      checked: getLaunchAtStartup(),
      click: (item) => {
        const result = setLaunchAtStartup(item.checked);
        if (!result.ok) {
          dialog.showMessageBox({
            type: 'info',
            title: '开机自启',
            message: result.reason || '暂时无法设置开机自启',
            buttons: ['知道了']
          });
        }
        rebuildTrayMenu();
      }
    },
    { type: 'separator' },
    { label: '隐藏小申', click: () => hideWindow() },
    { label: '退出小申', click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`${APP_NAME} · 在这里陪着你`);
}

function createTray() {
  try {
    const image = nativeImage.createFromPath(assetPath('tray.png'));
    tray = new Tray(image.isEmpty() ? nativeImage.createFromPath(assetPath('icon.png')) : image);
    tray.on('double-click', () => toggleWindow());
    tray.on('click', () => toggleWindow());
    rebuildTrayMenu();
  } catch (err) {
    console.error('Tray creation failed:', err);
  }
}

function registerIpc() {
  ipcMain.on('ui:set-interactive', (_event, value) => {
    const next = !!value;
    if (next === interactive) return;
    interactive = next;
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(!next, { forward: true });
      if (next) {
        try { win.setAlwaysOnTop(currentAlwaysOnTop(), currentAlwaysOnTop() ? 'floating' : 'normal'); } catch { /* noop */ }
      }
    }
  });

  ipcMain.on('window:drag-start', () => {
    if (!win || win.isDestroyed()) return;
    endDrag(false);
    panelReturnBounds = null;
    dragSession = {
      cursor: screen.getCursorScreenPoint(),
      bounds: win.getBounds(),
      startedAt: Date.now()
    };
    const tick = () => {
      if (!dragSession || !win || win.isDestroyed()) return;
      if (Date.now() - dragSession.startedAt > 60000) {
        endDrag(true);
        return;
      }
      const point = screen.getCursorScreenPoint();
      // Do not clamp the whole transparent window: the visible pet must be
      // able to reach every screen edge, even when the window canvas extends
      // beyond the display.
      const nextX = dragSession.bounds.x + (point.x - dragSession.cursor.x);
      const nextY = dragSession.bounds.y + (point.y - dragSession.cursor.y);
      win.setPosition(Math.round(nextX), Math.round(nextY), false);
      dragTimer = setTimeout(tick, 8);
    };
    tick();
  });

  ipcMain.on('window:drag-end', () => endDrag(true));

  ipcMain.handle('app:info', () => ({
    name: APP_NAME,
    version: app.getVersion(),
    packaged: app.isPackaged,
    alwaysOnTop: currentAlwaysOnTop(),
    launchAtStartup: getLaunchAtStartup()
  }));

  ipcMain.on('app:focus', (_event, options = {}) => {
    if (!win || win.isDestroyed()) return;
    if (options && options.ensurePanel && !panelMainOpen) {
      panelMainOpen = true;
      ensurePanelOnScreen();
    }
    win.show();
    win.focus();
  });

  ipcMain.on('app:panel-closed', () => {
    panelMainOpen = false;
    if (panelReturnBounds && win && !win.isDestroyed()) {
      win.setPosition(panelReturnBounds.x, panelReturnBounds.y, false);
    }
    panelReturnBounds = null;
  });

  ipcMain.handle('app:set-always-on-top', (_event, value) => setAlwaysOnTop(value));
  ipcMain.handle('app:set-launch-at-startup', (_event, value) => setLaunchAtStartup(value));
  ipcMain.on('app:hide', () => hideWindow());
  ipcMain.on('app:quit', () => { isQuitting = true; app.quit(); });

  ipcMain.handle('notify:show', (_event, payload = {}) => {
    try {
      if (!Notification.isSupported()) return { ok: false };
      const notification = new Notification({
        title: String(payload.title || APP_NAME).slice(0, 80),
        body: String(payload.body || '').slice(0, 300),
        icon: assetPath('icon.png'),
        silent: !!payload.silent
      });
      notification.on('click', () => showWindow());
      notification.show();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });

  ipcMain.handle('screenshot:save', async (_event, payload = {}) => {
    try {
      const dataUrl = String(payload.dataUrl || '');
      if (!dataUrl.startsWith('data:image/png;base64,')) {
        return { ok: false, error: 'invalid image data' };
      }
      const defaultName = `小申写真-${new Date().toISOString().slice(0, 10)}.png`;
      const result = await dialog.showSaveDialog(win, {
        title: '保存小申的写真',
        defaultPath: path.join(app.getPath('pictures'), defaultName),
        filters: [{ name: 'PNG 图片', extensions: ['png'] }]
      });
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      const base64 = dataUrl.slice('data:image/png;base64,'.length);
      fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
      return { ok: true, path: result.filePath };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });

  ipcMain.handle('ai:chat', async (_event, payload = {}) => {
    const baseUrl = String(payload.baseUrl || '').trim().replace(/\/+$/, '');
    const apiKey = String(payload.apiKey || '').trim();
    const model = String(payload.model || '').trim();
    const messages = Array.isArray(payload.messages) ? payload.messages.slice(-12) : [];
    if (!baseUrl || !model) return { ok: false, error: '请先填写接口地址和模型名称' };
    if (!/^https?:\/\//i.test(baseUrl)) return { ok: false, error: '接口地址需要以 http:// 或 https:// 开头' };
    let url = baseUrl;
    if (!/\/chat\/completions$/i.test(url)) {
      url = /\/v1$/i.test(url) ? `${url}/chat/completions` : `${url}/v1/chat/completions`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.85,
          max_tokens: 320
        }),
        signal: controller.signal
      });
      const text = await response.text();
      let data = null;
      try { data = JSON.parse(text); } catch { /* noop */ }
      if (!response.ok) {
        const reason = data?.error?.message || data?.message || `HTTP ${response.status}`;
        return { ok: false, error: String(reason).slice(0, 260) };
      }
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return { ok: false, error: '接口没有返回可用的内容' };
      return { ok: true, content: String(content).slice(0, 2000) };
    } catch (err) {
      if (err.name === 'AbortError') return { ok: false, error: '连接超时了，检查一下网络或接口地址' };
      return { ok: false, error: `连接失败：${String(err.message || err).slice(0, 200)}` };
    } finally {
      clearTimeout(timer);
    }
  });

  ipcMain.handle('weather:get', async (_event, payload = {}) => {
    const lat = Number(payload.lat);
    const lon = Number(payload.lon);
    const city = String(payload.city || '西安');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false, error: '地点参数无效' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const current = data?.current;
      if (!current) throw new Error('没有天气数据');
      return {
        ok: true,
        city,
        temperature: Math.round(current.temperature_2m),
        apparent: Math.round(current.apparent_temperature),
        humidity: Math.round(current.relative_humidity_2m),
        wind: Math.round(current.wind_speed_10m),
        weatherCode: current.weather_code,
        updatedAt: Date.now()
      };
    } catch (err) {
      return { ok: false, error: err.name === 'AbortError' ? '天气查询超时' : '天气暂时获取不到' };
    } finally {
      clearTimeout(timer);
    }
  });
}

function endDrag(save) {
  if (dragTimer) {
    clearTimeout(dragTimer);
    dragTimer = null;
  }
  if (dragSession && save && win && !win.isDestroyed()) {
    const [x, y] = win.getPosition();
    writePrefs({ windowBounds: { x, y } });
  }
  dragSession = null;
}

app.on('second-instance', () => showWindow());

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  createWindow();
  createTray();
  registerIpc();
  try {
    globalShortcut.register('CommandOrControl+Shift+X', () => toggleWindow());
  } catch (err) {
    console.warn('Global shortcut registration failed:', err);
  }
  app.on('activate', () => showWindow());
  if (process.env.XIAOSHEN_TEST === '1' || process.env.XIAOSHEN_DEBUG === '1') {
    global.__xiaoshenDebug = () => ({
      interactive,
      ignore: !interactive,
      bounds: win?.getBounds() || null,
      visible: !!win?.isVisible(),
      alwaysOnTop: !!win?.isAlwaysOnTop(),
      dragging: !!dragSession,
      tray: !!tray,
      lastRendererCrash,
      windowCount: BrowserWindow.getAllWindows().length
    });
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  endDrag(true);
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep the pet alive in the tray unless the user explicitly quits.
});
