import { createStage } from './stage.js';
import {
  loadStoredState,
  persistState,
  createDefaultState,
  recordInteraction,
  recordFocusMinutes,
  relationshipLevel,
  daysTogether,
  todayHistory,
  ensureDay,
  getDateKey
} from './features/store.js';
import {
  generateReply,
  getWelcome,
  getQuickReplies,
  buildAiMessages,
  formatClock
} from './features/dialogues.js';
import {
  tickPomodoro,
  startPomodoro,
  pausePomodoro,
  resetPomodoro,
  configurePomodoro,
  formatDuration,
  progressOf
} from './features/pomodoro.js';
import {
  createReminder,
  dueReminders,
  markReminderFired,
  sortReminders,
  pruneReminders,
  formatReminderDate,
  toDateTimeLocalValue
} from './features/reminders.js';
import { describeWeather, weatherAdvice, buildWeatherPayload } from './features/weather.js';
import { icon } from './features/icons.js';
import { speak, stopSpeaking, playChime } from './features/speech.js';
import { OUTFITS, normalizeOutfit, isValidOutfit, getOutfit, getOutfitBubble } from './features/outfits.js';
import { createShakeDetector, pickRandomAction } from './features/gestures.js';

const APP_WIDTH = 840;
const APP_HEIGHT = 800;
const WEATHER_CACHE_KEY = 'xiaoshen.weather.v1';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const api = window.petAPI || {
  setInteractive() {}, startDrag() {}, endDrag() {},
  async getAppInfo() { return { version: '1.0.0', packaged: false, alwaysOnTop: true, launchAtStartup: false }; },
  async setAlwaysOnTop(v) { return v; },
  async setLaunchAtStartup() { return { ok: false, enabled: false, reason: '当前环境不支持' }; },
  hide() {}, quit() {}, focusWindow() {}, panelClosed() {},
  async notify() { return { ok: false }; },
  async saveScreenshot() { return { ok: false, error: '当前环境不支持保存' }; },
  async aiChat() { return { ok: false, error: '当前环境不支持 AI' }; },
  async getWeather() { return { ok: false, error: '当前环境不支持天气' }; },
  onAppAction() { return () => {}; },
  onSettingsChanged() { return () => {}; },
  isTest: false
};

const storage = window.localStorage;
let state = loadStoredState(storage);
let stage = null;
let appInfo = { version: '1.0.0', packaged: false, alwaysOnTop: true, launchAtStartup: false };
let weather = null;
let weatherLoading = false;
let activeTab = 'interact';
let panelOpen = false;
let chatBusy = false;
let pendingReset = false;
let currentView = 'front';
let lastWeatherFetch = 0;
let lastZzz = 0;
let saveTimer = 0;
let tickCount = 0;
let toastTimerSeq = 0;
let bubbleToken = 0;
let bubbleHideTimer = 0;
let talkingTimer = 0;
let mainTickHandle = 0;
let windowInteractive = null;
let pointerFrame = 0;
let lastPointer = { x: 0, y: 0 };
let dragPointer = null;
let overPet = false;
let aiLastFallback = 0;
const shakeDetector = createShakeDetector({ windowMs: 700, minStep: 7, minReversals: 4, minSpan: 34, cooldownMs: 6500 });
const FUN_ACTIONS = ['heart', 'laugh', 'grumpy', 'yawn', 'spin', 'cheer'];
let hoverSince = 0;
let lastHoverReaction = 0;
let lastShakeReaction = 0;
let outfitChangeTimes = [];
let lastOutfitDizzy = 0;
let clickTimes = [];
let lastPokeDizzy = 0;

const els = {};

const DAILY_QUOTES = [
  ['先完成，再完美。完美是完成之后才有资格讨论的事。', '小申写在便签上'],
  ['把今天拆成一小格一小格，就没那么吓人。', '小申的桌面纸条'],
  ['喝一口水，抬头看一眼远处。你比进度条重要。', '小申提醒你'],
  ['如果今天只做成一件小事，也算好好过了今天。', '来自桌角的轻声话'],
  ['不必每一分钟都有产出，发呆也是大脑在整理桌面。', '小申说'],
  ['卡住的时候先站起来，答案常常不在屏幕里。', '小申的科研玄学'],
  ['你不需要时刻都很厉害。偶尔靠在我这里歇一下也行。', '小申一直在这'],
  ['论文会写完的，天也会亮的。先把今晚过好。', '给深夜的你'],
  ['别人的进度是别人的时区，你的时钟也在走。', '小申的手写便签']
];

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  persistState(storage, state);
}

function saveSoon(delay = 450) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = 0;
    persistState(storage, state);
  }, delay);
}

function applyUiScale() {
  const scale = Math.min(1, Math.max(0.7, Math.min(window.innerWidth / APP_WIDTH, window.innerHeight / APP_HEIGHT)));
  document.documentElement.style.setProperty('--ui-scale', String(scale));
}

function weatherCached() {
  try {
    const cached = JSON.parse(storage.getItem(WEATHER_CACHE_KEY) || 'null');
    if (cached?.ok && Date.now() - cached.fetchedAt < 6 * 3600000) return cached;
  } catch { /* noop */ }
  return null;
}

function decorateWeather(data) {
  const described = describeWeather(data.weatherCode);
  return {
    ...data,
    text: described.text,
    icon: described.icon,
    advice: weatherAdvice(data),
    fetchedAt: Date.now()
  };
}

function context() {
  return {
    state,
    now: new Date(),
    weather: weather?.ok ? weather : null,
    city: state.settings.city,
    rng: Math.random
  };
}

function currentRelationship() {
  return relationshipLevel(state.intimacy);
}

function moodWord(value = state.mood) {
  if (value >= 82) return '心情亮晶晶';
  if (value >= 62) return '状态还不错';
  if (value >= 42) return '有点低落';
  return '需要被抱抱';
}

function dailyQuote() {
  const seed = Number(getDateKey().replaceAll('-', '')) + Math.round(state.intimacy);
  return DAILY_QUOTES[seed % DAILY_QUOTES.length];
}

function weatherIcon(name) {
  const known = ['sun', 'cloud', 'rain', 'snow', 'storm', 'cloud-sun'];
  return icon(known.includes(name) ? name : 'cloud', 13);
}

/* ---------------- interactivity / window ---------------- */
function setInteractive(value) {
  const next = !!value;
  if (windowInteractive === next) return;
  windowInteractive = next;
  try { api.setInteractive(next); } catch { /* noop */ }
}

function shouldBeInteractive(x, y) {
  const target = document.elementFromPoint(x, y);
  if (target) {
    if (target.closest('.panel:not([hidden]), .bubble-wrap:not([hidden]), .dock, .focus-chip:not([hidden]), .context-menu:not([hidden]), button, input, textarea, select, label, a')) {
      return true;
    }
    if (target === els.canvas) {
      return !!stage?.hitTest(x, y).hit;
    }
  }
  return false;
}

function refreshInteractivity() {
  if (lastPointer.x || lastPointer.y) {
    setInteractive(shouldBeInteractive(lastPointer.x, lastPointer.y));
  }
}

function onPointerMove(event) {
  lastPointer = { x: event.clientX, y: event.clientY };
  if (dragPointer?.started) {
    setInteractive(true);
    return;
  }
  if (pointerFrame) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    if (dragPointer?.started) {
      setInteractive(true);
      return;
    }
    const interactive = shouldBeInteractive(lastPointer.x, lastPointer.y);
    setInteractive(interactive);
    if (stage) {
      const hit = stage.hitTest(lastPointer.x, lastPointer.y);
      const wasOver = overPet;
      overPet = hit.hit;
      if (overPet) {
        if (!wasOver) hoverSince = performance.now();
      } else {
        hoverSince = 0;
      }
      els.canvas.classList.toggle('can-drag', hit.hit);
      stage.updatePointer(lastPointer.x, lastPointer.y);
      if (!dragPointer?.started && !state.sleeping) {
        const near = nearPetPoint(lastPointer.x, lastPointer.y);
        if (shakeDetector.push(lastPointer.x, lastPointer.y, performance.now(), near)) {
          reactToShake();
        }
      }
    }
  });
}

function attachPointerHandlers() {
  // Electron forwards native mouse-move messages while the window ignores
  // mouse input; those do not always synthesize pointermove. Listen to both.
  window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
  window.addEventListener('mousemove', onPointerMove, { capture: true, passive: true });
  window.addEventListener('pointerdown', (event) => {
    if (!els.contextMenu.hidden && !event.target.closest('#contextMenu')) hideContextMenu();
  }, true);
  els.canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const hit = stage?.hitTest(event.clientX, event.clientY);
    if (!hit?.hit) return;
    event.preventDefault();
    dragPointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      zone: hit.zone,
      started: false,
      at: performance.now()
    };
    try { els.canvas.setPointerCapture(event.pointerId); } catch { /* noop */ }
  });
  els.canvas.addEventListener('pointermove', (event) => {
    if (!dragPointer || event.pointerId !== dragPointer.id) return;
    const dx = event.clientX - dragPointer.startX;
    const dy = event.clientY - dragPointer.startY;
    if (!dragPointer.started && Math.hypot(dx, dy) > 3.5) {
      dragPointer.started = true;
      els.canvas.classList.add('dragging');
      if (state.sleeping) {
        state.sleeping = false;
        stage?.character.setSleeping(false);
        updateLiveUI();
      }
      stage?.character.setDragging(true);
      shakeDetector.reset();
      hoverSince = 0;
      hideBubble();
      try { api.startDrag(); } catch { /* noop */ }
    }
  });
  const finishPointer = (event) => {
    if (!dragPointer || event.pointerId !== dragPointer.id) return;
    const info = dragPointer;
    dragPointer = null;
    els.canvas.classList.remove('dragging');
    try { els.canvas.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    if (info.started) {
      try { api.endDrag(); } catch { /* noop */ }
      stage?.character.setDragging(false);
      updateEdgeLayout();
      const held = performance.now() - info.at;
      saveSoon(250);
      if (held > 350) {
        stage?.character.setAction('shy');
        setTimeout(() => showBubble(
          ['放我下来啦。', '站稳了，别把我丢下。', '你要把我搬到哪里去？'][Math.floor(Math.random() * 3)],
          { duration: 2800 }
        ), 120);
        spawnHearts(1);
      }
      return;
    }
    if (performance.now() - info.at < 900) {
      onPetClick(info.zone);
    }
  };
  els.canvas.addEventListener('pointerup', finishPointer);
  els.canvas.addEventListener('pointercancel', (event) => {
    if (!dragPointer || event.pointerId !== dragPointer.id) return;
    const started = dragPointer.started;
    dragPointer = null;
    els.canvas.classList.remove('dragging');
    if (started) {
      try { api.endDrag(); } catch { /* noop */ }
      stage?.character.setDragging(false);
      saveSoon(250);
    }
  });
  els.canvas.addEventListener('lostpointercapture', () => {
    if (!dragPointer) return;
    const started = dragPointer.started;
    dragPointer = null;
    els.canvas.classList.remove('dragging');
    if (started) {
      try { api.endDrag(); } catch { /* noop */ }
      stage?.character.setDragging(false);
      saveSoon(250);
    }
  });
  window.addEventListener('blur', () => {
    if (!dragPointer) return;
    const started = dragPointer.started;
    dragPointer = null;
    els.canvas.classList.remove('dragging');
    if (started) {
      try { api.endDrag(); } catch { /* noop */ }
      stage?.character.setDragging(false);
      saveSoon(250);
    }
  });
  els.canvas.addEventListener('dblclick', (event) => {
    const hit = stage?.hitTest(event.clientX, event.clientY);
    if (hit?.hit) openPanel('chat');
  });
  els.canvas.addEventListener('contextmenu', (event) => {
    const hit = stage?.hitTest(event.clientX, event.clientY);
    if (!hit?.hit) return;
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY);
  });
}

function onPetClick(zone) {
  if (state.sleeping) {
    wakeUp();
    return;
  }
  const now = performance.now();
  clickTimes.push(now);
  clickTimes = clickTimes.filter((t) => now - t < 1400);
  if (clickTimes.length >= 3 && now - lastPokeDizzy > 4500) {
    lastPokeDizzy = now;
    stage?.character.setAction('startled');
    stage?.character.setExpression('pout');
    recordInteraction(state, 'pet');
    saveSoon();
    spawnDizzy();
    showBubble('别戳啦，眼镜要歪了。', { duration: 3000 });
    refreshStatsView();
    return;
  }
  if (zone === 'head') {
    playPet();
  } else {
    stage?.character.setAction('poke');
    recordInteraction(state, 'pet');
    spawnHearts(2);
    const lines = ['诶。', '戳到了。', '我在这里呀。', '轻一点，眼镜会歪的。'];
    showBubble(lines[Math.floor(Math.random() * lines.length)], { duration: 3500 });
    refreshStatsView();
  }
  saveSoon();
}

/* ---------------- bubble / speech / particles ---------------- */
function showBubble(text, { voice = false, duration = 0, talk = true, immediate = false } = {}) {
  const content = String(text || '').trim();
  if (!content) return;
  bubbleToken += 1;
  const token = bubbleToken;
  clearTimeout(bubbleHideTimer);
  els.bubbleWrap.hidden = false;
  els.bubbleWrap.style.translate = '';
  els.bubbleText.textContent = '';
  if (talk && !state.sleeping) startTalking(content.length);
  if (voice && state.settings.voice) speak(content, { enabled: true, volume: state.settings.volume });
  const shownDuration = duration || Math.min(15000, Math.max(5000, content.length * 105));
  if (immediate || content.length < 2) {
    els.bubbleText.textContent = content;
    positionBubbleOnScreen();
  } else {
    const chars = Array.from(content);
    let i = 0;
    const writer = setInterval(() => {
      if (token !== bubbleToken) { clearInterval(writer); return; }
      i += 1;
      els.bubbleText.textContent = chars.slice(0, i).join('');
      if (i % 3 === 0 || i >= chars.length) positionBubbleOnScreen();
      if (i >= chars.length) clearInterval(writer);
    }, 24);
  }
  bubbleHideTimer = setTimeout(() => {
    if (token !== bubbleToken) return;
    els.bubbleWrap.hidden = true;
  }, shownDuration);
}

function startTalking(length) {
  if (!stage) return;
  clearTimeout(talkingTimer);
  stage.character.setTalking(true);
  const ms = Math.min(6200, 900 + length * 92);
  talkingTimer = setTimeout(() => {
    stage?.character.setTalking(false);
    stage?.character.setExpression('smile');
  }, ms);
}

function updateEdgeLayout() {
  if (!els.dock) return;
  const availLeft = Number.isFinite(window.screen.availLeft) ? window.screen.availLeft : 0;
  const overflow = window.screenX + window.innerWidth - (availLeft + window.screen.availWidth);
  els.dock.classList.toggle('edge-left', overflow > 2);
}

function positionBubbleOnScreen() {
  if (!els.bubbleWrap || els.bubbleWrap.hidden) return;
  els.bubbleWrap.style.translate = '';
  const rect = els.bubbleWrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const availLeft = Number.isFinite(window.screen.availLeft) ? window.screen.availLeft : 0;
  const availTop = Number.isFinite(window.screen.availTop) ? window.screen.availTop : 0;
  const availRight = availLeft + window.screen.availWidth;
  const availBottom = availTop + window.screen.availHeight;
  const pad = 8;
  let dx = 0;
  let dy = 0;
  if (rect.right + window.screenX > availRight - pad) dx = availRight - pad - (rect.right + window.screenX);
  if (rect.left + window.screenX < availLeft + pad) dx = availLeft + pad - (rect.left + window.screenX);
  if (rect.top + window.screenY < availTop + pad) dy = availTop + pad - (rect.top + window.screenY);
  if (rect.bottom + window.screenY > availBottom - pad) dy = availBottom - pad - (rect.bottom + window.screenY);
  if (dx || dy) els.bubbleWrap.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
}

function hideBubble() {
  bubbleToken += 1;
  clearTimeout(bubbleHideTimer);
  els.bubbleWrap.hidden = true;
  els.bubbleWrap.style.translate = '';
  els.bubbleWrap.style.transform = '';
}

function spawnHearts(count = 5) {
  if (!els.particles) return;
  for (let i = 0; i < count; i += 1) {
    const node = document.createElement('span');
    node.className = 'particle-heart';
    node.innerHTML = icon('heart', 15);
    node.style.left = `${150 + Math.random() * 90}px`;
    node.style.top = `${170 + Math.random() * 70}px`;
    node.style.setProperty('--dx', `${-40 + Math.random() * 80}px`);
    node.style.animationDelay = `${i * 0.07}s`;
    els.particles.appendChild(node);
    setTimeout(() => node.remove(), 2200 + i * 70);
  }
}

function spawnZzz() {
  if (!els.particles) return;
  const node = document.createElement('span');
  node.className = 'particle-z';
  node.textContent = 'z';
  node.style.left = `${258 + Math.random() * 16}px`;
  node.style.top = `${112 + Math.random() * 18}px`;
  node.style.animationDelay = '0.1s';
  els.particles.appendChild(node);
  setTimeout(() => node.remove(), 3300);
}

function spawnConfetti(count = 24) {
  if (!els.confettiLayer) return;
  const colors = ['#d7897d', '#e7bfa0', '#9eaf95', '#c8a268', '#e6d6c5', '#b98678'];
  for (let i = 0; i < count; i += 1) {
    const node = document.createElement('span');
    node.className = 'confetti-bit';
    node.style.left = `${474 + Math.random() * 300}px`;
    node.style.top = `${240 + Math.random() * 100}px`;
    node.style.background = colors[i % colors.length];
    node.style.setProperty('--dx', `${-90 + Math.random() * 180}px`);
    node.style.setProperty('--dy', `${150 + Math.random() * 280}px`);
    node.style.setProperty('--rot', `${-220 + Math.random() * 440}deg`);
    node.style.animationDelay = `${Math.random() * 0.25}s`;
    els.confettiLayer.appendChild(node);
    setTimeout(() => node.remove(), 3000);
  }
}

function showToast(text, duration = 2800) {
  if (!els.toastLayer) return;
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = text;
  node.dataset.toast = String(++toastTimerSeq);
  els.toastLayer.appendChild(node);
  while (els.toastLayer.children.length > 3) els.toastLayer.firstElementChild?.remove();
  setTimeout(() => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 260);
  }, duration);
}

async function notify(title, body, { silent = false } = {}) {
  try {
    await api.notify({ title, body, silent });
  } catch { /* noop */ }
}

function nearPetPoint(x, y) {
  if (!els.canvas) return false;
  const rect = els.canvas.getBoundingClientRect();
  const nx = (x - rect.left) / Math.max(1, rect.width);
  const ny = (y - rect.top) / Math.max(1, rect.height);
  return nx > 0.14 && nx < 0.86 && ny > 0.03 && ny < 0.98;
}

function spawnDizzy() {
  if (!els.particles) return;
  const marks = ['～', '~', '·', '～'];
  for (let i = 0; i < 4; i += 1) {
    const node = document.createElement('span');
    node.className = 'particle-dizzy';
    node.textContent = marks[i];
    node.style.left = `${170 + Math.random() * 75}px`;
    node.style.top = `${125 + Math.random() * 50}px`;
    node.style.setProperty('--dx', `${-34 + Math.random() * 68}px`);
    node.style.animationDelay = `${i * 0.06}s`;
    els.particles.appendChild(node);
    setTimeout(() => node.remove(), 1700);
  }
}

function reactToShake() {
  if (!stage || state.sleeping || dragPointer?.started) return;
  const now = performance.now();
  if (now - lastShakeReaction < 6500) return;
  lastShakeReaction = now;
  stage.character.setAction('dizzy');
  stage.character.setExpression('pout');
  const lines = [
    '别晃啦，眼镜要掉了。',
    '慢一点慢一点，我头晕。',
    '再晃我就抓不住丸子头了。',
    '停一下，我数不清星星了。'
  ];
  showBubble(lines[Math.floor(Math.random() * lines.length)], { duration: 3000 });
  spawnDizzy();
}

function noteOutfitChange() {
  const now = performance.now();
  outfitChangeTimes.push(now);
  outfitChangeTimes = outfitChangeTimes.filter((t) => now - t < 8000);
  if (outfitChangeTimes.length >= 3 && now - lastOutfitDizzy > 10000) {
    lastOutfitDizzy = now;
    stage?.character.setAction('dizzy');
    stage?.character.setExpression('pout');
    spawnDizzy();
    return true;
  }
  return false;
}

/* ---------------- stats / interactions ---------------- */
function refreshStatsView() {
  if (!panelOpen || activeTab !== 'interact') return;
  updateLiveUI();
}

function afterInteraction(kind) {
  recordInteraction(state, kind);
  saveSoon();
  refreshStatsView();
}

function playPet() {
  if (state.sleeping) { wakeUp(); return; }
  stage?.character.setAction('pet');
  afterInteraction('pet');
  spawnHearts(4);
  const reply = generateReply('摸摸', context());
  showBubble(reply.text, { duration: 4200 });
}

function feed() {
  if (state.sleeping) {
    stage?.character.setSleeping(false);
    state.sleeping = false;
  }
  stage?.character.setAction('eat', { feed: true });
  afterInteraction('feed');
  showBubble('小饼干分你一半。慢慢吃，别边看屏幕边咽。', { duration: 4200 });
}

function toggleSleep() {
  if (state.sleeping) wakeUp();
  else {
    state.sleeping = true;
    stage?.character.setSleeping(true);
    stopSpeaking();
    showBubble('那我靠在椅子上眯一会儿。你也别撑太久，好吗？', { duration: 5200 });
    afterInteraction('sleep');
    lastZzz = 0;
    setTimeout(() => { spawnZzz(); setTimeout(spawnZzz, 420); }, 260);
  }
  saveSoon();
  updateLiveUI();
  if (panelOpen && activeTab === 'interact') renderPanel();
}

function wakeUp() {
  state.sleeping = false;
  stage?.character.setSleeping(false);
  stage?.character.setAction('stretch');
  afterInteraction('sleep');
  showBubble('睡醒啦。椅子比我想的舒服。伸个懒腰吧。', { duration: 3800 });
  saveSoon();
  updateLiveUI();
  if (panelOpen && activeTab === 'interact') renderPanel();
}

function triggerCharacterAction(name) {
  if (!stage) return;
  if (state.sleeping && name !== 'photo') {
    state.sleeping = false;
    stage.character.setSleeping(false);
  }
  const allowed = ['wave', 'nod', 'jump', 'dance', 'spin', 'stretch', 'shy', 'pet', 'poke', 'heart', 'laugh', 'grumpy', 'yawn', 'cheer', 'dizzy', 'startled'];
  if (!allowed.includes(name)) return;
  stage.character.setAction(name);
  const lines = {
    wave: '你好呀。今天也请多指教。',
    dance: '随便跳两下，活动一下肩颈。',
    jump: '跳一下，烦恼先放地上。',
    spin: '转个圈，检查一下今天的自己。',
    stretch: '手举高，深呼吸，肩膀放下来。',
    shy: '别一直看我，我会不好意思。',
    heart: '比个心。今天也要开开心心的。',
    laugh: '哈哈，笑一笑，烦恼先放旁边。',
    grumpy: '哼。虽然有点生气，但我还在。',
    yawn: '哈——欠。困了就一起歇一小会儿吧。',
    cheer: '好耶！今天也完成了一点点。',
    dizzy: '别晃啦，我头晕。',
    startled: '吓我一跳。下次轻一点嘛。'
  };
  if (lines[name]) {
    showBubble(lines[name], { duration: name === 'laugh' || name === 'yawn' ? 3400 : 3000 });
  }
  if (name === 'dance') spawnConfetti(10);
  if (name === 'cheer') spawnConfetti(16);
  if (name === 'dizzy') spawnDizzy();
  spawnHearts(name === 'dance' || name === 'heart' ? 5 : name === 'cheer' ? 2 : 1);
}

async function takePhoto() {
  if (!stage) return;
  try {
    showToast('正在把这一刻装进相框…', 1600);
    stage.character.setView('front');
    currentView = 'front';
    if (state.sleeping) {
      state.sleeping = false;
      stage.character.setSleeping(false);
    }
    stage.character.setExpression('smile');
    await new Promise((resolve) => setTimeout(resolve, 380));
    const dataUrl = stage.renderPortrait();
    const result = await api.saveScreenshot({ dataUrl });
    if (result?.ok) {
      showToast('写真已经保存好啦。', 2600);
      showBubble('这张留给你。下次想看别的角度也可以。', { duration: 4200 });
    } else if (!result?.canceled) {
      showToast(result?.error || '保存没有成功，稍后再试一次。', 3000);
    }
  } catch (err) {
    showToast(`保存失败：${String(err.message || err).slice(0, 60)}`, 3200);
  }
}

/* ---------------- pomodoro ---------------- */
function handlePomodoroComplete(completed) {
  if (completed === 'focus') {
    recordFocusMinutes(state, state.pomodoro.focusMinutes);
    state.mood = Math.min(100, state.mood + 3);
    state.intimacy = Math.min(100, state.intimacy + 1.2);
    saveNow();
    playChime('focus', state.settings.volume);
    spawnConfetti(18);
    const text = `这一轮 ${state.pomodoro.focusMinutes} 分钟完成啦。站起来走两步，喝口水。`;
    showBubble(text, { voice: state.settings.voice, duration: 9000 });
    stage?.character.setAction('stretch');
    notify('专注完成 · 小申', text);
    showToast(`已记下 ${state.pomodoro.focusMinutes} 分钟的专注`, 3200);
  } else {
    playChime('break', state.settings.volume);
    const text = '休息结束。想继续的话，我在计时器那边等你。';
    showBubble(text, { voice: state.settings.voice, duration: 7000 });
    notify('休息结束 · 小申', text);
  }
  updateLiveUI();
  if (panelOpen && activeTab === 'focus') renderPanel();
}

function toggleTimer() {
  if (state.sleeping) {
    state.sleeping = false;
    stage?.character.setSleeping(false);
  }
  if (state.pomodoro.running) {
    pausePomodoro(state.pomodoro);
    showToast('计时已暂停，休息一下也可以。', 2200);
  } else {
    startPomodoro(state.pomodoro);
    const isBreak = state.pomodoro.mode === 'break';
    showBubble(isBreak ? '那这五分钟就真的歇一会儿。' : '开始吧。这二十分钟只做眼前这一件事。', { duration: 4200 });
    stage?.character.setAction('nod');
  }
  saveNow();
  updateLiveUI();
  if (panelOpen && activeTab === 'focus') renderPanel();
}

function resetTimer() {
  resetPomodoro(state.pomodoro);
  saveNow();
  updateLiveUI();
  if (panelOpen && activeTab === 'focus') renderPanel();
}

function applyTimerDurations() {
  const focusInput = $('#focusMinutes');
  const breakInput = $('#breakMinutes');
  const focus = Number(focusInput?.value) || state.pomodoro.focusMinutes;
  const rest = Number(breakInput?.value) || state.pomodoro.breakMinutes;
  configurePomodoro(state.pomodoro, focus, rest);
  state.settings.pomodoroFocus = state.pomodoro.focusMinutes;
  state.settings.pomodoroBreak = state.pomodoro.breakMinutes;
  saveSoon();
  updateLiveUI();
  if (panelOpen && activeTab === 'focus') renderPanel();
  showToast(`已设为 ${state.pomodoro.focusMinutes} 分钟专注 / ${state.pomodoro.breakMinutes} 分钟休息`, 2600);
}

function updateTimerUI() {
  const pomodoro = state.pomodoro;
  const remaining = pomodoro.remainingMs;
  const timeText = formatDuration(remaining);
  const progress = progressOf(pomodoro) * 100;
  const focused = pomodoro.mode === 'focus';
  const ring = $('#timerRing');
  const timeEl = $('#timerTime');
  const modeEl = $('#timerMode');
  const captionEl = $('#timerCaption');
  const startBtn = $('#timerStartBtn');
  if (timeEl) timeEl.textContent = timeText;
  if (ring) {
    ring.style.setProperty('--progress', progress.toFixed(1));
    ring.classList.toggle('break', !focused);
  }
  if (modeEl) {
    modeEl.textContent = pomodoro.running ? (focused ? '正在专注' : '正在休息') : (focused ? '准备专注' : '准备休息');
    modeEl.classList.toggle('break', !focused);
  }
  if (captionEl) {
    captionEl.textContent = pomodoro.running
      ? (focused ? '这一小段时间，只做一件事' : '肩膀放松，眼睛离开屏幕')
      : (focused ? '准备好就开始，不必等整点' : '休息好了再继续');
  }
  if (startBtn) {
    startBtn.innerHTML = `${icon(pomodoro.running ? 'pause' : 'play', 13)}${pomodoro.running ? '暂停' : (focused ? '开始专注' : '开始休息')}`;
  }
}

/* ---------------- reminders / water ---------------- */
function fireReminder(reminder) {
  const text = `提醒：${reminder.title}`;
  showBubble(text, { voice: state.settings.voice, duration: 9000 });
  notify('小申提醒你', reminder.title);
  playChime('break', state.settings.volume);
  saveSoon();
  if (panelOpen && activeTab === 'focus') renderPanel();
}

function checkReminders(now) {
  const due = dueReminders(state.reminders, now);
  if (!due.length) return;
  for (const reminder of due) {
    markReminderFired(reminder, now);
    fireReminder(reminder);
  }
  state.reminders = pruneReminders(sortReminders(state.reminders), now);
  saveNow();
}

function addReminderFromForm(form) {
  const data = new FormData(form);
  const title = String(data.get('title') || '').trim();
  const atRaw = String(data.get('at') || '');
  const repeat = String(data.get('repeat') || 'once');
  const at = new Date(atRaw).getTime();
  const result = createReminder({ title, at, repeat }, Date.now());
  if (!result.ok) {
    showToast(result.error, 2600);
    return false;
  }
  state.reminders.push(result.reminder);
  state.reminders = sortReminders(state.reminders).slice(0, 50);
  saveNow();
  showToast(`记下了：${formatReminderDate(result.reminder.at)} · ${title}`, 3000);
  showBubble(repeat === 'daily' ? '好，我会每天这个时间提醒你。' : '好，到时候我叫你。', { duration: 3000 });
  renderPanel();
  return true;
}

function deleteReminder(id) {
  state.reminders = state.reminders.filter((r) => r.id !== id);
  saveNow();
  renderPanel();
  showToast('这条提醒删掉了。', 1800);
}

function waterStatusText() {
  const water = state.settings.water;
  if (!water.enabled) return '关掉的时候，我就不会打扰你。';
  const minutesLeft = Math.max(0, Math.ceil((water.lastAt + water.minutes * 60000 - Date.now()) / 60000));
  return `每 ${water.minutes} 分钟轻轻叫你一次，约 ${minutesLeft} 分钟后。`;
}

function drinkWater() {
  recordInteraction(state, 'water');
  saveNow();
  showBubble('喝一口。慢一点咽，顺便活动一下脖子。', { duration: 3500 });
  showToast('喝一杯水，也算今天的一件小事。', 2200);
  stage?.character.setAction('nod');
  renderPanel();
}

function checkWater(now) {
  const water = state.settings.water;
  if (!water.enabled) return;
  if (!water.lastAt) {
    water.lastAt = now;
    saveSoon();
    return;
  }
  if (now - water.lastAt >= water.minutes * 60000) {
    water.lastAt = now;
    const text = `该喝水啦。已经过去 ${water.minutes} 分钟了。`;
    showBubble(text, { voice: state.settings.voice, duration: 8000 });
    notify('小申提醒你喝水', text);
    playChime('break', state.settings.volume);
    saveSoon();
    if (panelOpen && activeTab === 'focus') renderPanel();
  }
}

/* ---------------- weather ---------------- */
async function loadWeather(force = false) {
  if (weatherLoading) return;
  if (!force && lastWeatherFetch && Date.now() - lastWeatherFetch < 20 * 60000) return;
  weatherLoading = true;
  try {
    const data = await api.getWeather(buildWeatherPayload(state.settings));
    if (data?.ok) {
      weather = decorateWeather(data);
      lastWeatherFetch = Date.now();
      try { storage.setItem(WEATHER_CACHE_KEY, JSON.stringify(weather)); } catch { /* noop */ }
      updateWeatherUI();
    } else if (!weather) {
      updateWeatherUI();
    }
  } catch {
    /* weather is a nice-to-have */
  } finally {
    weatherLoading = false;
  }
}

function updateWeatherUI() {
  const chip = $('#weatherChip');
  if (!chip) return;
  if (!weather?.ok) {
    chip.innerHTML = `${icon('cloud', 13)}<span>天气未连接</span>`;
    chip.title = '联网后会自动获取天气';
    return;
  }
  chip.innerHTML = `${weatherIcon(weather.icon)}<span>${escapeHtml(weather.city)} ${weather.temperature}°</span>`;
  chip.title = `${weather.text} · 体感 ${weather.apparent}℃ · 湿度 ${weather.humidity}%${weather.advice ? ` · ${weather.advice}` : ''}`;
}

/* ---------------- chat ---------------- */
function isAiReady() {
  const ai = state.settings.ai;
  return !!(ai.enabled && ai.baseUrl && ai.model);
}

function renderChatMessages() {
  const messages = state.chat.length
    ? state.chat
    : [{ role: 'assistant', text: '我在呢。今天想说什么都可以，不着急。', ts: Date.now(), synthetic: true }];
  const bubbles = messages.slice(-40).map((message) => {
    const isUser = message.role === 'user';
    const time = formatClock(new Date(message.ts || Date.now()));
    return `
      <div class="msg ${isUser ? 'user' : 'assistant'}" data-role="${isUser ? 'user' : 'assistant'}">
        <div class="msg-avatar" aria-hidden="true"></div>
        <div class="msg-bubble">${escapeHtml(message.text)}<div class="msg-time">${time}</div></div>
      </div>`;
  }).join('');
  const typing = chatBusy ? `
    <div class="msg assistant" id="typingMsg">
      <div class="msg-avatar" aria-hidden="true"></div>
      <div class="msg-bubble typing-bubble"><i></i><i></i><i></i></div>
    </div>` : '';
  const quick = getQuickReplies().map((text) => `<button class="quick-chip" type="button" data-quick="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join('');
  return `
    <div class="chat-messages" id="chatMessages">${bubbles}${typing}</div>
    <div class="chat-quick">${quick}</div>
    <form class="chat-composer" data-form="chat" autocomplete="off">
      <textarea id="chatInput" name="text" rows="1" maxlength="500" placeholder="${isAiReady() ? '和小申说点什么…' : '和小申说点什么，我会认真听…'}" aria-label="聊天内容"></textarea>
      <button class="send-btn" type="submit" aria-label="发送" data-testid="chat-send" ${chatBusy ? 'disabled' : ''}>${icon('send', 15)}</button>
    </form>
    <div class="chat-footnote"><span>Enter 发送 · Shift+Enter 换行</span><span>${isAiReady() ? 'AI 陪伴已开启 · 回复仅存本机' : '本地陪伴模式 · 回复仅存本机'}</span></div>`;
}

function scrollChatToBottom() {
  const box = $('#chatMessages');
  if (box) box.scrollTop = box.scrollHeight;
}

function addChatMessage(role, text, source = 'local') {
  state.chat.push({ role, text: String(text).slice(0, 2000), ts: Date.now(), source });
  if (state.chat.length > 40) state.chat = state.chat.slice(-40);
  saveSoon();
}

async function sendChat(text, { fromQuick = false } = {}) {
  const message = String(text || '').trim().slice(0, 500);
  if (!message) return;
  if (chatBusy) {
    showToast('小申正在想上一句，稍等一下。', 1800);
    return;
  }
  if (!panelOpen || activeTab !== 'chat') openPanel('chat');
  addChatMessage('user', message, 'user');
  recordInteraction(state, 'chat');
  chatBusy = true;
  renderPanel();
  requestAnimationFrame(scrollChatToBottom);

  const ai = state.settings.ai;
  let reply = null;
  let source = 'local';
  if (isAiReady()) {
    try {
      const messages = buildAiMessages(state.chat.slice(0, -1), state, message, weather);
      const result = await api.aiChat({
        baseUrl: ai.baseUrl,
        apiKey: ai.apiKey,
        model: ai.model,
        messages
      });
      if (result?.ok && result.content?.trim()) {
        reply = result.content.trim();
        source = 'ai';
      } else if (result?.error) {
        const now = Date.now();
        if (now - aiLastFallback > 20000) {
          aiLastFallback = now;
          showToast(`AI 暂时没接上，先用本地陪伴：${String(result.error).slice(0, 60)}`, 3600);
        }
      }
    } catch (err) {
      showToast(`AI 连接失败，先用本地陪伴。${String(err.message || err).slice(0, 50)}`, 3200);
    }
  }
  if (!reply) {
    await new Promise((resolve) => setTimeout(resolve, 420 + Math.random() * 520));
    const generated = generateReply(message, context());
    reply = generated.text;
    if (generated.action && stage) stage.character.setAction(generated.action);
    if (generated.expression && stage) stage.character.setExpression(generated.expression);
    source = 'local';
  }
  chatBusy = false;
  addChatMessage('assistant', reply, source);
  saveNow();
  if (panelOpen && activeTab === 'chat') {
    renderPanel();
    requestAnimationFrame(scrollChatToBottom);
  }
  showBubble(reply, { voice: state.settings.voice, talk: true });
  spawnHearts(message.length > 18 ? 1 : 2);
  if (fromQuick && /专注/.test(message)) {
    setTimeout(() => { if (!state.pomodoro.running) toggleTimer(); }, 600);
  }
}

/* ---------------- panel rendering ---------------- */
function headerBase({ chat = false } = {}) {
  const badge = state.sleeping ? '睡着中' : '陪伴中';
  const sub = chat
    ? (isAiReady() ? '在线 · AI 陪伴已连接' : '在线 · 本地陪伴模式')
    : `第 ${daysTogether(state)} 天 · ${formatClock(new Date())} · ${currentRelationship().name}`;
  const weatherHtml = weather?.ok
    ? `<span class="weather-chip" id="weatherChip" title="${escapeHtml(`${weather.text} · 体感 ${weather.apparent}℃${weather.advice ? ` · ${weather.advice}` : ''}`)}">${weatherIcon(weather.icon)}<span>${escapeHtml(weather.city)} ${weather.temperature}°</span></span>`
    : `<span class="weather-chip" id="weatherChip" title="联网后会自动获取天气">${icon('cloud', 13)}<span>天气未连接</span></span>`;
  return `
    <div class="panel-topline">
      <div class="identity">
        <div class="mini-avatar" aria-hidden="true"></div>
        <div class="identity-copy">
          <div class="identity-title">小申 <span class="badge">${badge}</span></div>
          <div class="identity-sub">${escapeHtml(sub)}</div>
        </div>
      </div>
      <div class="header-tools">
        ${weatherHtml}
        <button class="icon-btn" type="button" data-command="close-panel" aria-label="收起面板" data-testid="panel-close">${icon('close', 17)}</button>
      </div>
    </div>`;
}

function tabsHtml() {
  const tabs = [
    { id: 'interact', label: '互动', icon: 'sparkle' },
    { id: 'focus', label: '专注', icon: 'clock' },
    { id: 'dress', label: '衣橱', icon: 'wardrobe' },
    { id: 'settings', label: '设置', icon: 'settings' }
  ];
  return `<div class="tabs" role="tablist">${tabs.map((tab) => `
    <button class="tab ${activeTab === tab.id ? 'active' : ''}" type="button" role="tab" aria-selected="${activeTab === tab.id}" data-tab="${tab.id}" data-testid="tab-${tab.id}">
      ${icon(tab.icon, 14)}<span>${tab.label}</span>
    </button>`).join('')}</div>`;
}

function statRow(label, key, value, iconName) {
  return `
    <div class="stat-row">
      <span class="stat-label">${icon(iconName, 12)}${label}</span>
      <div class="stat-track"><div class="stat-fill ${key}" data-bar="${key}" style="width:${Math.round(value)}%"></div></div>
      <span class="stat-value" data-stat-value="${key}">${Math.round(value)}</span>
    </div>`;
}

function heartsHtml(hearts) {
  return `<span class="hearts" aria-label="亲密度 ${hearts} 颗心">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= hearts ? '' : 'empty'}">${icon('heart', 11)}</span>`).join('')}</span>`;
}

function interactHtml() {
  const rel = currentRelationship();
  const quote = dailyQuote();
  const b = state.settings.water.enabled
    ? `${Math.max(0, Math.ceil((state.settings.water.lastAt + state.settings.water.minutes * 60000 - Date.now()) / 60000))} 分钟后提醒喝水`
    : '喝水提醒还没打开';
  return `
    <div class="section">
      <div class="card">
        <div class="status-top">
          <div class="relationship">
            <span class="relationship-name">${rel.name}</span>
            <span class="relationship-days">一起第 ${daysTogether(state)} 天</span>
          </div>
          ${heartsHtml(rel.hearts)}
        </div>
        <div class="stat-grid">
          ${statRow('心情', 'mood', state.mood, 'heart')}
          ${statRow('精力', 'energy', state.energy, 'leaf')}
          ${statRow('饱食', 'satiety', state.satiety, 'bowl')}
        </div>
        <div class="intimacy-row">
          <div class="intimacy-head"><span>亲密度 · ${moodWord()}</span><span>${Math.round(state.intimacy)} / 100</span></div>
          <div class="intimacy-track"><div class="intimacy-fill" data-intimacy style="width:${Math.round(state.intimacy)}%"></div></div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-head">
        <span class="section-title">${icon('sparkle', 13)}和 小申 待一会儿</span>
        <span class="section-note">点一下，就有回应</span>
      </div>
      <div class="action-grid">
        <button class="action-btn" type="button" data-command="pet" data-testid="action-pet">
          <span class="action-icon">${icon('hand', 15)}</span><span class="action-label"><span class="action-name">摸摸头</span><span class="action-hint">今天也辛苦了</span></span>
        </button>
        <button class="action-btn" type="button" data-command="feed" data-tone="gold" data-testid="action-feed">
          <span class="action-icon">${icon('cookie', 15)}</span><span class="action-label"><span class="action-name">喂小饼干</span><span class="action-hint">补充一点能量</span></span>
        </button>
        <button class="action-btn" type="button" data-command="open-chat" data-tone="sage" data-testid="action-chat">
          <span class="action-icon">${icon('chat', 15)}</span><span class="action-label"><span class="action-name">聊聊天</span><span class="action-hint">我在听</span></span>
        </button>
        <button class="action-btn" type="button" data-command="sleep" data-tone="navy" data-testid="action-sleep">
          <span class="action-icon">${icon('moon', 15)}</span><span class="action-label"><span class="action-name">${state.sleeping ? '叫醒小申' : '睡一小会'}</span><span class="action-hint">${state.sleeping ? '轻轻叫醒' : '让眼睛歇一下'}</span></span>
        </button>
        <button class="action-btn" type="button" data-command="wave" data-tone="sage">
          <span class="action-icon">${icon('hand', 15)}</span><span class="action-label"><span class="action-name">打个招呼</span><span class="action-hint">摇摇手</span></span>
        </button>
        <button class="action-btn" type="button" data-command="jump">
          <span class="action-icon">${icon('sparkle', 15)}</span><span class="action-label"><span class="action-name">跳一跳</span><span class="action-hint">活动一下</span></span>
        </button>
        <button class="action-btn" type="button" data-command="dance" data-tone="gold">
          <span class="action-icon">${icon('star', 15)}</span><span class="action-label"><span class="action-name">跳支舞</span><span class="action-hint">扭一扭肩颈</span></span>
        </button>
        <button class="action-btn" type="button" data-command="photo" data-tone="navy" data-testid="action-photo">
          <span class="action-icon">${icon('camera', 15)}</span><span class="action-label"><span class="action-name">拍张照</span><span class="action-hint">保存这一刻</span></span>
        </button>
      </div>
    </div>
    <div class="section">
      <div class="section-head">
        <span class="section-title">${icon('star', 13)}更多小动作</span>
        <button class="btn small ghost" type="button" data-command="random-action" data-testid="action-random">${icon('shuffle', 11)}随便来一个</button>
      </div>
      <div class="talent-grid">
        <button class="talent-btn" type="button" data-command="heart" data-testid="action-heart">${icon('heart', 13)}比心</button>
        <button class="talent-btn" type="button" data-command="laugh" data-testid="action-laugh">${icon('laugh', 13)}大笑</button>
        <button class="talent-btn" type="button" data-command="grumpy" data-testid="action-grumpy">${icon('anger', 13)}假装生气</button>
        <button class="talent-btn" type="button" data-command="yawn" data-testid="action-yawn">${icon('yawn', 13)}打哈欠</button>
        <button class="talent-btn" type="button" data-command="spin" data-testid="action-spin">${icon('reset', 13)}转个圈</button>
        <button class="talent-btn" type="button" data-command="cheer" data-testid="action-cheer">${icon('sparkle', 13)}欢呼</button>
      </div>
      <div class="hint-line" style="margin-top:8px">鼠标在她身上快速晃一晃，或者连续戳几下，会有小脾气。拖着她的时候，她的手和脚会乱蹬。</div>
    </div>
    <div class="section">
      <div class="card quote-card tinted">
        <span class="quote-mark">${icon('leaf', 14)}</span>
        <div><div class="quote-text">${escapeHtml(quote[0])}</div><div class="quote-source">${escapeHtml(quote[1])}</div></div>
      </div>
    </div>
    <div class="card soft today-row">
      <div class="today-cell"><span data-today="focus">${state.today.focusMinutes}</span><label>今天专注 / 分钟</label></div>
      <div class="today-cell"><span data-today="pets">${state.today.pets}</span><label>被摸头 / 次</label></div>
      <div class="today-cell"><span data-today="chats">${state.today.chats}</span><label>被回应 / 句</label></div>
    </div>
    <div class="hint-line" style="margin-top:8px">${escapeHtml(b)}。需要我时，点右边的聊天按钮就好。</div>`;
}

function timerHtml() {
  const p = state.pomodoro;
  return `
    <div class="card timer-card">
      <span class="timer-mode ${p.mode === 'break' ? 'break' : ''}" id="timerMode">准备专注</span>
      <div class="timer-ring ${p.mode === 'break' ? 'break' : ''}" id="timerRing" style="--progress:${(progressOf(p) * 100).toFixed(1)}">
        <div class="timer-center"><div class="timer-time" id="timerTime">${formatDuration(p.remainingMs)}</div><div class="timer-caption" id="timerCaption">准备好就开始，不必等整点</div></div>
      </div>
      <div class="timer-actions">
        <button class="btn primary" type="button" id="timerStartBtn" data-command="timer-toggle" data-testid="timer-toggle">${icon(p.running ? 'pause' : 'play', 13)}${p.running ? '暂停' : (p.mode === 'break' ? '开始休息' : '开始专注')}</button>
        <button class="btn icon-only" type="button" data-command="timer-reset" title="重置计时" aria-label="重置计时">${icon('reset', 13)}</button>
      </div>
      <div class="duration-row">
        专注 <input id="focusMinutes" type="number" min="5" max="120" step="5" value="${p.focusMinutes}" aria-label="专注分钟数">
        分钟 · 休息 <input id="breakMinutes" type="number" min="1" max="60" step="1" value="${p.breakMinutes}" aria-label="休息分钟数">
        分钟 <button class="btn small" type="button" data-command="timer-apply">应用</button>
      </div>
    </div>`;
}

function reminderListHtml() {
  const list = state.reminders.slice(0, 8);
  if (!list.length) return `<div class="reminder-empty">还没有提醒。想让我记住什么？</div>`;
  return list.map((r) => `
    <div class="reminder-item" data-reminder-id="${escapeHtml(r.id)}">
      <span class="reminder-dot ${r.done ? 'done' : ''}"></span>
      <div class="reminder-copy">
        <div class="reminder-title">${escapeHtml(r.title)}</div>
        <div class="reminder-time">${formatReminderDate(r.at)}${r.repeat === 'daily' ? ' · 每天' : ''}${r.done ? ' · 已完成' : ''}</div>
      </div>
      <button class="icon-btn" type="button" data-command="delete-reminder" data-id="${escapeHtml(r.id)}" aria-label="删除提醒">${icon('trash', 13)}</button>
    </div>`).join('');
}

function focusHtml() {
  const history = todayHistory(state, 7);
  const max = Math.max(25, ...history.map((d) => d.minutes));
  const bars = history.map((day, index) => `
    <div class="mini-bar-col">
      <span class="mini-bar-value">${day.minutes || ''}</span>
      <div class="mini-bar ${index === history.length - 1 ? 'today' : ''}" style="height:${Math.max(3, Math.round((day.minutes / max) * 44))}px"></div>
      <span class="mini-bar-label">${day.label}</span>
    </div>`).join('');
  const water = state.settings.water;
  const defaultTime = toDateTimeLocalValue(Date.now() + 30 * 60000);
  return `
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('clock', 13)}番茄钟</span><span class="section-note">今天 ${state.today.focusMinutes} 分钟</span></div>
      ${timerHtml()}
    </div>
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('drop', 13)}喝水与身体</span><span class="section-note">${waterStatusText()}</span></div>
      <div class="card">
        <div class="tool-row">
          <div class="tool-copy"><div class="tool-title">${icon('drop', 13)}喝水提醒</div><div class="tool-desc">每 ${water.minutes} 分钟轻声提醒一次，不弹大窗。</div></div>
          <label class="switch" aria-label="喝水提醒开关"><input type="checkbox" data-change="water-enabled" ${water.enabled ? 'checked' : ''}><span class="switch-track"></span></label>
        </div>
        <div class="tool-row">
          <div class="tool-copy"><div class="tool-title">提醒间隔</div><div class="tool-desc">${water.enabled ? '正在按时提醒你' : '打开开关后开始计时'}</div></div>
          <div style="display:flex;align-items:center;gap:6px">
            <select data-change="water-interval" aria-label="喝水提醒间隔" style="height:29px;border-radius:9px;border:1px solid var(--line);background:rgba(255,255,255,.6);padding:0 7px;font-size:10px">
              ${[30, 45, 60, 90].map((m) => `<option value="${m}" ${water.minutes === m ? 'selected' : ''}>${m} 分钟</option>`).join('')}
            </select>
            <button class="btn small" type="button" data-command="water-drink" data-testid="water-drink">喝一杯</button>
          </div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('bell', 13)}日程提醒</span><span class="section-note">保存在本机</span></div>
      <div class="card">
        <form data-form="reminder" autocomplete="off">
          <div class="field"><label class="field-label" for="reminderTitle">提醒我</label><input id="reminderTitle" name="title" maxlength="60" placeholder="例如：交周报 / 给导师发消息 / 吃药" required></div>
          <div class="form-grid">
            <div class="field"><label class="field-label" for="reminderAt">时间</label><input id="reminderAt" name="at" type="datetime-local" value="${defaultTime}" required></div>
            <div class="field"><label class="field-label" for="reminderRepeat">重复</label><select id="reminderRepeat" name="repeat"><option value="once">一次</option><option value="daily">每天</option></select></div>
          </div>
          <button class="btn primary" type="submit" data-testid="add-reminder">${icon('bell', 12)}添加提醒</button>
        </form>
        <div style="margin-top:9px">${reminderListHtml()}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('leaf', 13)}近 7 天专注</span><span class="section-note">不看比较，只看积累</span></div>
      <div class="card soft"><div class="mini-bars">${bars}</div></div>
    </div>`;
}

function dressHtml() {
  const s = state.settings;
  const views = [
    { id: 'front', label: '正面' },
    { id: 'left', label: '左侧' },
    { id: 'back', label: '背面' },
    { id: 'right', label: '右侧' }
  ];
  return `
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('wardrobe', 13)}今天穿什么</span><span class="section-note">${OUTFITS.length} 套 · 会立刻换上</span></div>
      <div class="outfit-grid">
        ${OUTFITS.map((outfit) => `
        <button class="outfit-card ${s.outfit === outfit.id ? 'active' : ''}" type="button" data-command="outfit:${outfit.id}" data-testid="outfit-${outfit.id}">
          <div class="outfit-preview ${outfit.previewClass}">${outfit.id.startsWith('crab') ? '<span class="preview-mark">蟹</span>' : ''}${outfit.id.startsWith('windbreaker') ? '<span class="preview-zip"></span>' : ''}</div>
          <div class="outfit-tag"><span>${outfit.name}</span><span>${outfit.detail}</span></div>
          <span class="check-badge">${icon('check', 11)}</span>
        </button>`).join('')}
      </div>
    </div>
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('eye', 13)}看看小申</span><span class="section-note">四视角来自照片</span></div>
      <div class="card">
        <div class="segmented four" style="margin-bottom:9px">
          ${views.map((v) => `<button class="seg-btn ${currentView === v.id ? 'active' : ''}" type="button" data-command="view:${v.id}">${v.label}</button>`).join('')}
        </div>
        <div class="tool-row" style="padding-top:4px">
          <div class="tool-copy"><div class="tool-title">缓缓转一圈</div><div class="tool-desc">适合从远处看看今天的造型</div></div>
          <label class="switch" aria-label="自动旋转开关"><input type="checkbox" data-change="auto-rotate" ${s.autoRotate ? 'checked' : ''}><span class="switch-track"></span></label>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('sparkle', 13)}配饰细节</span><span class="section-note">她标志性的样子</span></div>
      <div class="card accessory-list">
        ${[
          ['glasses', '黑色圆框眼镜'],
          ['earrings', '金色小耳钉'],
          ['necklace', '银项链'],
          ['clip', '抓夹'],
          ['cap', '棕色棒球帽']
        ].map(([key, label]) => `<div class="accessory-item"><span>${label}</span><label class="switch"><input type="checkbox" data-accessory="${key}" ${s.accessories[key] ? 'checked' : ''}><span class="switch-track"></span></label></div>`).join('')}
      </div>
    </div>
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('settings', 13)}显示</span><span class="section-note">自动保存</span></div>
      <div class="card">
        <div class="tool-row">
          <div class="tool-copy"><div class="tool-title">桌宠大小</div><div class="tool-desc">只改变显示比例，不影响其他窗口</div></div>
          <div class="segmented three" style="width:136px">
            ${[{ v: 0.88, l: '小' }, { v: 1, l: '中' }, { v: 1.06, l: '大' }].map((o) => `<button class="seg-btn ${Math.abs(s.scale - o.v) < 0.03 ? 'active' : ''}" type="button" data-command="scale:${o.v}">${o.l}</button>`).join('')}
          </div>
        </div>
        <div class="tool-row">
          <div class="tool-copy"><div class="tool-title">动画性能</div><div class="tool-desc">省电模式会降低分辨率，但更轻</div></div>
          <div class="segmented" style="width:136px;grid-template-columns:1fr 1fr">
            <button class="seg-btn ${s.quality === 'high' ? 'active' : ''}" type="button" data-command="quality:high">细腻</button>
            <button class="seg-btn ${s.quality === 'power' ? 'active' : ''}" type="button" data-command="quality:power">省电</button>
          </div>
        </div>
      </div>
    </div>
    <div class="section">
      <button class="btn primary" style="width:100%" type="button" data-command="photo">${icon('camera', 13)}把今天的小申保存成写真</button>
    </div>`;
}

function settingsHtml() {
  const s = state.settings;
  const ai = s.ai;
  return `
    <div class="section settings-group">
      <div class="section-head"><span class="section-title">${icon('sparkle', 13)}陪伴方式</span><span class="section-note">随时能改</span></div>
      <div class="card">
        <div class="tool-row">
          <div class="tool-copy"><div class="tool-title">${icon('volume', 13)}说话</div><div class="tool-desc">用系统中文语音轻轻读出来</div></div>
          <label class="switch"><input type="checkbox" data-change="voice" ${s.voice ? 'checked' : ''}><span class="switch-track"></span></label>
        </div>
        <div class="tool-row">
          <div class="tool-copy"><div class="tool-title">音量</div><div class="tool-desc">只影响小申的语音和提示音</div></div>
          <div style="display:flex;align-items:center;gap:8px;width:150px">
            <input id="volumeRange" type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" style="width:105px" aria-label="音量">
            <span class="value-pill" id="volumeValue">${Math.round(s.volume * 100)}%</span>
          </div>
        </div>
        <div class="tool-row">
          <div class="tool-copy"><div class="tool-title">始终置顶</div><div class="tool-desc">让窗口浮在其他窗口上方</div></div>
          <label class="switch"><input type="checkbox" data-change="always-on-top" ${s.alwaysOnTop ? 'checked' : ''}><span class="switch-track"></span></label>
        </div>
        <div class="tool-row">
          <div class="tool-copy"><div class="tool-title">开机自动出现</div><div class="tool-desc">打包版生效；开发模式只提示</div></div>
          <label class="switch"><input type="checkbox" data-change="launch-at-startup" ${s.launchAtStartup ? 'checked' : ''}><span class="switch-track"></span></label>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('cloud', 13)}天气与地点</span><span class="section-note">${weather?.ok ? `${weather.text} · ${weather.temperature}℃` : '联网后自动更新'}</span></div>
      <form class="card" data-form="location" autocomplete="off">
        <div class="form-grid">
          <div class="field"><label class="field-label">城市</label><input name="city" value="${escapeHtml(s.city)}" maxlength="20"></div>
          <div class="field"><label class="field-label">纬度</label><input name="lat" type="number" step="0.01" value="${s.lat}"></div>
        </div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr auto;align-items:end">
          <div class="field"><label class="field-label">经度</label><input name="lon" type="number" step="0.01" value="${s.lon}"></div>
          <div class="field" style="align-self:end"><button class="btn small" type="submit" style="width:100%">${icon('cloud', 12)}更新天气</button></div>
        </div>
        <div class="hint-line">${weather?.ok ? escapeHtml(`${weather.city}：${weather.text}，体感 ${weather.apparent}℃，湿度 ${weather.humidity}%。${weather.advice || ''}`) : '天气数据来自 Open-Meteo，不需要密钥。'}</div>
      </form>
    </div>
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('chat', 13)}AI 陪伴（可选）</span><span class="section-note">${isAiReady() ? '已连接' : '本地模式'}</span></div>
      <div class="card">
        <div class="tool-row" style="padding-top:0">
          <div class="tool-copy"><div class="tool-title">启用 AI 增强聊天</div><div class="tool-desc">不填也能用完整的本地陪伴</div></div>
          <label class="switch"><input type="checkbox" data-change="ai-enabled" ${ai.enabled ? 'checked' : ''}><span class="switch-track"></span></label>
        </div>
        <details class="advanced" ${ai.baseUrl || ai.model ? 'open' : ''}>
          <summary>接口设置</summary>
          <div class="advanced-body">
            <form data-form="ai" autocomplete="off">
              <div class="preset-row">
                <button class="preset-chip" type="button" data-preset="deepseek">DeepSeek</button>
                <button class="preset-chip" type="button" data-preset="kimi">Kimi</button>
                <button class="preset-chip" type="button" data-preset="openai">OpenAI</button>
              </div>
              <div class="field"><label class="field-label">接口地址（OpenAI 兼容）</label><input id="aiBaseUrl" name="baseUrl" placeholder="https://api.deepseek.com/v1" value="${escapeHtml(ai.baseUrl)}"></div>
              <div class="form-grid">
                <div class="field"><label class="field-label">模型</label><input id="aiModel" name="model" placeholder="deepseek-chat" value="${escapeHtml(ai.model)}"></div>
                <div class="field"><label class="field-label">API Key</label><input id="aiApiKey" name="apiKey" type="password" placeholder="${ai.apiKey ? '已保存，留空不改' : 'sk-…'}" value=""></div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn primary small" type="submit">保存设置</button>
                <button class="btn small" type="button" data-command="test-ai">测试连接</button>
              </div>
              <div class="hint-line">密钥只保存在本机。接口通过主进程请求，不会拿去做别的事。AI 不可用时会自动回到本地对白。</div>
            </form>
          </div>
        </details>
      </div>
    </div>
    <div class="section">
      <div class="section-head"><span class="section-title">${icon('settings', 13)}小申与数据</span><span class="section-note">v${escapeHtml(appInfo.version)}</span></div>
      <div class="card">
        <div class="tool-row" style="padding-top:0">
          <div class="tool-copy"><div class="tool-title">测试系统通知</div><div class="tool-desc">看看 Windows 通知是否正常</div></div>
          <button class="btn small" type="button" data-command="test-notification">发一条</button>
        </div>
        <div class="tool-row">
          <div class="tool-copy"><div class="tool-title">隐藏到托盘</div><div class="tool-desc">双击托盘图标或按 Ctrl+Shift+X 回来</div></div>
          <button class="btn small" type="button" data-command="hide-app">隐藏</button>
        </div>
        <div class="tool-row" id="resetZone">
          <div class="tool-copy"><div class="tool-title">重置陪伴数据</div><div class="tool-desc">清空心情、专注记录、提醒和对话</div></div>
          <button class="btn small danger" type="button" data-command="reset-arm">重置</button>
        </div>
        <div class="tool-row">
          <div class="tool-copy"><div class="tool-title">退出小申</div><div class="tool-desc">退出后不会再出现在桌面</div></div>
          <button class="btn small danger" type="button" data-command="quit-app">退出</button>
        </div>
      </div>
    </div>
    <div class="panel-footer"><span>小申 · 住在桌面右下角的搭子</span><span>${state.chat.length} 条对话 · ${state.reminders.length} 个提醒</span></div>`;
}

function tabBody(tab) {
  if (tab === 'focus') return focusHtml();
  if (tab === 'dress') return dressHtml();
  if (tab === 'settings') return settingsHtml();
  return interactHtml();
}

function renderHeader() {
  const chat = activeTab === 'chat';
  els.panelHeader.className = `panel-header${chat ? ' chat-header' : ''}`;
  els.panelHeader.innerHTML = `${headerBase({ chat })}${chat ? '' : tabsHtml()}`;
}

function renderPanel() {
  if (!panelOpen) return;
  renderHeader();
  const isChat = activeTab === 'chat';
  els.panelBody.className = `panel-body${isChat ? ' chat-body' : ''}`;
  if (isChat) {
    els.panelBody.innerHTML = renderChatMessages();
    requestAnimationFrame(() => {
      scrollChatToBottom();
      if (panelOpen && activeTab === 'chat' && !chatBusy) {
        const input = $('#chatInput');
        if (input && document.activeElement !== input && !document.querySelector('.context-menu:not([hidden])')) input.focus();
      }
    });
  } else {
    els.panelBody.innerHTML = tabBody(activeTab);
  }
  updateLiveUI();
}

function openPanel(tab = 'interact') {
  activeTab = tab === 'chat' ? 'chat' : (['interact', 'focus', 'dress', 'settings'].includes(tab) ? tab : 'interact');
  panelOpen = true;
  pendingReset = false;
  els.panel.hidden = false;
  setInteractive(true);
  renderPanel();
  try { api.focusWindow?.({ ensurePanel: true }); } catch { /* noop */ }
}

function closePanel() {
  panelOpen = false;
  els.panel.hidden = true;
  pendingReset = false;
  try { api.panelClosed?.(); } catch { /* noop */ }
  requestAnimationFrame(refreshInteractivity);
}

function switchTab(tab) {
  if (!['interact', 'focus', 'dress', 'settings'].includes(tab)) return;
  activeTab = tab;
  renderPanel();
  if (tab === 'focus') updateTimerUI();
}

/* ---------------- context menu ---------------- */
function showContextMenu(clientX, clientY) {
  const appRect = els.app.getBoundingClientRect();
  const scale = appRect.width / APP_WIDTH;
  const x = (clientX - appRect.left) / scale;
  const y = (clientY - appRect.top) / scale;
  els.contextMenu.innerHTML = `
    <button class="context-item" type="button" data-command="pet">${icon('hand', 14)}摸摸头</button>
    <button class="context-item" type="button" data-command="feed">${icon('cookie', 14)}喂一块饼干</button>
    <button class="context-item" type="button" data-command="open-chat">${icon('chat', 14)}和小申聊天</button>
    <button class="context-item" type="button" data-command="open-dress">${icon('wardrobe', 14)}换一套衣服</button>
    <button class="context-item" type="button" data-command="open-focus">${icon('clock', 14)}专注与提醒</button>
    <button class="context-item" type="button" data-command="sleep">${icon('moon', 14)}${state.sleeping ? '叫醒小申' : '睡一小会'}</button>
    <button class="context-item" type="button" data-command="photo">${icon('camera', 14)}保存写真</button>
    <div class="context-sep"></div>
    <button class="context-item" type="button" data-command="hide-app">${icon('moon', 14)}隐藏到托盘</button>
    <button class="context-item danger" type="button" data-command="quit-app">${icon('power', 14)}退出小申</button>`;
  els.contextMenu.hidden = false;
  const menuRect = els.contextMenu.getBoundingClientRect();
  const menuW = menuRect.width / scale;
  const menuH = menuRect.height / scale;
  els.contextMenu.style.left = `${Math.max(8, Math.min(x, APP_WIDTH - menuW - 8))}px`;
  els.contextMenu.style.top = `${Math.max(8, Math.min(y, APP_HEIGHT - menuH - 8))}px`;
}

function hideContextMenu() {
  els.contextMenu.hidden = true;
}

/* ---------------- live UI ---------------- */
function updateLiveUI() {
  if (!stage) return;
  if (!panelOpen) {
    updateFocusChip();
    return;
  }
  updateTimerUI();
  updateFocusChip();
  updateWeatherUI();
  const modeBadge = els.panelHeader.querySelector('.identity-title .badge');
  if (modeBadge) modeBadge.textContent = state.sleeping ? '睡着中' : '陪伴中';
  const sub = els.panelHeader.querySelector('.identity-sub');
  if (sub && activeTab !== 'chat') sub.textContent = `第 ${daysTogether(state)} 天 · ${formatClock(new Date())} · ${currentRelationship().name}`;
  if (activeTab === 'interact') {
    for (const key of ['mood', 'energy', 'satiety']) {
      const bar = els.panelBody.querySelector(`[data-bar="${key}"]`);
      const value = els.panelBody.querySelector(`[data-stat-value="${key}"]`);
      if (bar) bar.style.width = `${Math.round(state[key])}%`;
      if (value) value.textContent = String(Math.round(state[key]));
    }
    const inti = els.panelBody.querySelector('[data-intimacy]');
    if (inti) inti.style.width = `${Math.round(state.intimacy)}%`;
    const cells = {
      focus: state.today.focusMinutes,
      pets: state.today.pets,
      chats: state.today.chats
    };
    for (const [key, value] of Object.entries(cells)) {
      const cell = els.panelBody.querySelector(`[data-today="${key}"]`);
      if (cell) cell.textContent = String(value);
    }
  }
  if (activeTab === 'focus') {
    updateTimerUI();
    const note = els.panelBody.querySelector('.section-head .section-note');
    if (note && state.today) {
      // The first component note is the today's focus count; update it if present.
      const firstSection = els.panelBody.querySelector('.section .section-note');
      if (firstSection) firstSection.textContent = `今天 ${state.today.focusMinutes} 分钟`;
    }
  }
}

function updateFocusChip() {
  const p = state.pomodoro;
  if (!p.running) {
    els.focusChip.hidden = true;
    els.signatureStatus.textContent = state.sleeping ? '睡着了' : '在线';
    return;
  }
  els.focusChip.hidden = false;
  $('#focusChipLabel').textContent = p.mode === 'focus' ? '专注中' : '休息中';
  $('#focusChipTime').textContent = formatDuration(p.remainingMs);
  els.signatureStatus.textContent = p.mode === 'focus' ? '陪专注' : '休息中';
}

/* ---------------- commands ---------------- */
function handleCommand(command, element = null) {
  if (!command) return;
  if (command === 'close-panel') return closePanel();
  if (command === 'open-chat') return openPanel('chat');
  if (command === 'open-dress') return openPanel('dress');
  if (command === 'open-focus') return openPanel('focus');
  if (command === 'pet') { playPet(); return; }
  if (command === 'feed') { feed(); return; }
  if (command === 'sleep') { toggleSleep(); return; }
  if (command === 'photo') { takePhoto(); return; }
  if (command === 'wave') return triggerCharacterAction('wave');
  if (command === 'jump') return triggerCharacterAction('jump');
  if (command === 'dance') return triggerCharacterAction('dance');
  if (command === 'spin') return triggerCharacterAction('spin');
  if (command === 'stretch') return triggerCharacterAction('stretch');
  if (command === 'heart') return triggerCharacterAction('heart');
  if (command === 'laugh') return triggerCharacterAction('laugh');
  if (command === 'grumpy') return triggerCharacterAction('grumpy');
  if (command === 'yawn') return triggerCharacterAction('yawn');
  if (command === 'cheer') return triggerCharacterAction('cheer');
  if (command === 'random-action') {
    const pick = pickRandomAction(FUN_ACTIONS);
    if (pick) triggerCharacterAction(pick);
    return;
  }
  if (command === 'timer-toggle') return toggleTimer();
  if (command === 'timer-reset') return resetTimer();
  if (command === 'timer-apply') return applyTimerDurations();
  if (command === 'water-drink') return drinkWater();
  if (command === 'delete-reminder') {
    const id = element?.dataset.id;
    if (id) deleteReminder(id);
    return;
  }
  if (command.startsWith('view:')) {
    const view = command.split(':')[1];
    if (['front', 'left', 'back', 'right'].includes(view)) {
      currentView = view;
      stage?.character.setView(view);
      state.settings.autoRotate = false;
      stage?.character.setAutoRotate(false);
      saveSoon();
      renderPanel();
    }
    return;
  }
  if (command.startsWith('outfit:')) {
    const requested = command.split(':')[1];
    if (!isValidOutfit(requested)) return;
    const outfit = normalizeOutfit(requested);
    state.settings.outfit = outfit;
    state.outfit = outfit;
    stage?.character.setOutfit(outfit);
    const tooFast = noteOutfitChange();
    saveSoon();
    renderPanel();
    showBubble(tooFast ? '别换啦，衣柜都要冒烟了。' : getOutfitBubble(outfit), { duration: 3400 });
    return;
  }
  if (command.startsWith('scale:')) {
    const value = Number(command.split(':')[1]);
    state.settings.scale = Number.isFinite(value) ? value : 1;
    stage?.character.setScale(state.settings.scale);
    saveSoon();
    renderPanel();
    return;
  }
  if (command.startsWith('quality:')) {
    state.settings.quality = command.split(':')[1] === 'power' ? 'power' : 'high';
    stage?.setQuality(state.settings.quality);
    saveSoon();
    renderPanel();
    showToast(state.settings.quality === 'power' ? '已切到省电动画。' : '已切回细腻渲染。', 1800);
    return;
  }
  if (command === 'reset-arm') {
    pendingReset = true;
    const zone = $('#resetZone');
    if (zone) {
      zone.innerHTML = `<div class="tool-copy"><div class="tool-title">确定要清空吗？</div><div class="tool-desc">对话、专注、提醒和亲密度都会被清掉</div></div><div style="display:flex;gap:5px"><button class="btn small danger" type="button" data-command="reset-confirm">确定</button><button class="btn small" type="button" data-command="reset-cancel">取消</button></div>`;
    }
    return;
  }
  if (command === 'reset-cancel') {
    pendingReset = false;
    renderPanel();
    return;
  }
  if (command === 'reset-confirm') {
    pendingReset = false;
    try { storage.removeItem('xiaoshen.state.v1'); } catch { /* noop */ }
    state = createDefaultState();
    applyAllSettings();
    saveNow();
    hideBubble();
    renderPanel();
    showToast('已经重新开始了。', 2400);
    setTimeout(() => showBubble(getWelcome(state, context()), { duration: 6000, voice: false }), 350);
    return;
  }
  if (command === 'hide-app') {
    closePanel();
    hideBubble();
    try { api.hide(); } catch { /* noop */ }
    return;
  }
  if (command === 'quit-app') {
    saveNow();
    try { api.quit(); } catch { /* noop */ }
    return;
  }
  if (command === 'test-notification') {
    notify('小申在这儿', '通知正常。需要我的时候，我就从桌面边缘探出头来。');
    showToast('通知发出去了，看看系统右下角。', 2600);
    return;
  }
  if (command === 'test-ai') {
    testAiConnection();
    return;
  }
}

async function testAiConnection() {
  const form = els.panelBody.querySelector('form[data-form="ai"]');
  if (!form) return;
  const data = new FormData(form);
  const baseUrl = String(data.get('baseUrl') || state.settings.ai.baseUrl || '').trim();
  const model = String(data.get('model') || state.settings.ai.model || '').trim();
  const apiKey = String(data.get('apiKey') || '').trim() || state.settings.ai.apiKey;
  if (!baseUrl || !model) {
    showToast('先填写接口地址和模型名称。', 2600);
    return;
  }
  showToast('正在试连一次…', 1600);
  const result = await api.aiChat({
    baseUrl,
    apiKey,
    model,
    messages: [
      { role: 'system', content: '请用五个汉字以内回答。' },
      { role: 'user', content: '你好' }
    ]
  });
  if (result?.ok) showToast('连接成功，小申可以接上 AI 了。', 3000);
  else showToast(`连接没有成功：${String(result?.error || '未知原因').slice(0, 80)}`, 4200);
}

function applyAllSettings() {
  if (!stage) return;
  state.settings.outfit = normalizeOutfit(state.settings.outfit);
  state.outfit = state.settings.outfit;
  stage.character.setOutfit(state.settings.outfit);
  stage.character.setScale(state.settings.scale);
  stage.character.setAutoRotate(state.settings.autoRotate);
  for (const [key, value] of Object.entries(state.settings.accessories)) {
    stage.character.setAccessory(key, value);
  }
  stage.character.setSleeping(state.sleeping);
  stage.setQuality(state.settings.quality);
  stage.character.setView(currentView === 'front' ? 'front' : currentView);
}

/* ---------------- event wiring ---------------- */
function wirePanelEvents() {
  els.panel.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (tab) { switchTab(tab.dataset.tab); return; }
    const preset = event.target.closest('[data-preset]');
    if (preset) {
      const presets = {
        deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
        kimi: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
        openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
      };
      const p = presets[preset.dataset.preset];
      if (p) {
        const base = $('#aiBaseUrl');
        const model = $('#aiModel');
        if (base) base.value = p.baseUrl;
        if (model) model.value = p.model;
        showToast('预设已填好。确认模型名和密钥后保存。', 2400);
      }
      return;
    }
    const quick = event.target.closest('[data-quick]');
    if (quick) { sendChat(quick.dataset.quick, { fromQuick: true }); return; }
    const commandEl = event.target.closest('[data-command]');
    if (commandEl) {
      event.preventDefault();
      handleCommand(commandEl.dataset.command, commandEl);
    }
  });

  els.panel.addEventListener('change', async (event) => {
    const target = event.target;
    if (target.matches('[data-accessory]')) {
      const key = target.dataset.accessory;
      state.settings.accessories[key] = target.checked;
      stage?.character.setAccessory(key, target.checked);
      saveSoon();
      return;
    }
    const action = target.dataset.change;
    if (!action) return;
    if (action === 'voice') {
      state.settings.voice = target.checked;
      if (!target.checked) stopSpeaking();
      saveSoon();
      showToast(target.checked ? '小申可以说话了。' : '已经安静下来。', 1800);
    } else if (action === 'always-on-top') {
      state.settings.alwaysOnTop = target.checked;
      try {
        const actual = await api.setAlwaysOnTop(target.checked);
        state.settings.alwaysOnTop = !!actual;
      } catch {
        state.settings.alwaysOnTop = false;
      }
      saveSoon();
    } else if (action === 'launch-at-startup') {
      try {
        const result = await api.setLaunchAtStartup(target.checked);
        if (result?.ok) {
          state.settings.launchAtStartup = !!result.enabled;
          showToast(result.enabled ? '下次开机会看到小申。' : '已关闭开机自启。', 2200);
        } else {
          state.settings.launchAtStartup = false;
          showToast(result?.reason || '当前版本不支持开机自启。', 3000);
        }
      } catch {
        state.settings.launchAtStartup = false;
        showToast('开机自启设置失败。', 2400);
      }
      saveSoon();
      renderPanel();
    } else if (action === 'water-enabled') {
      state.settings.water.enabled = target.checked;
      if (target.checked) state.settings.water.lastAt = Date.now();
      saveSoon();
      showToast(target.checked ? `每 ${state.settings.water.minutes} 分钟提醒你喝水。` : '喝水提醒已关闭。', 2200);
      renderPanel();
    } else if (action === 'water-interval') {
      state.settings.water.minutes = Math.max(15, Math.min(180, Number(target.value) || 45));
      state.settings.water.lastAt = Date.now();
      saveSoon();
      renderPanel();
    } else if (action === 'auto-rotate') {
      state.settings.autoRotate = target.checked;
      stage?.character.setAutoRotate(target.checked);
      saveSoon();
    } else if (action === 'ai-enabled') {
      state.settings.ai.enabled = target.checked;
      saveSoon();
      showToast(target.checked ? (isAiReady() ? 'AI 增强已开启。' : '已开启，但还要填写接口才会生效。') : '已回到本地陪伴。', 2500);
      renderPanel();
    }
  });

  els.panel.addEventListener('input', (event) => {
    if (event.target.id === 'chatInput') {
      const input = event.target;
      input.style.height = 'auto';
      input.style.height = `${Math.min(84, Math.max(30, input.scrollHeight))}px`;
    }
    if (event.target.id === 'volumeRange') {
      const value = Math.max(0, Math.min(100, Number(event.target.value) || 0));
      state.settings.volume = value / 100;
      const label = $('#volumeValue');
      if (label) label.textContent = `${value}%`;
      saveSoon(700);
    }
  });

  els.panel.addEventListener('keydown', (event) => {
    if (event.target.id === 'chatInput' && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const form = event.target.closest('form');
      if (form) form.requestSubmit();
    }
  });

  els.panel.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    if (form.dataset.form === 'chat') {
      const input = form.querySelector('textarea[name="text"]');
      const text = input?.value || '';
      if (input) { input.value = ''; input.style.height = 'auto'; }
      sendChat(text);
      return;
    }
    if (form.dataset.form === 'reminder') {
      addReminderFromForm(form);
      return;
    }
    if (form.dataset.form === 'ai') {
      const data = new FormData(form);
      const ai = state.settings.ai;
      ai.baseUrl = String(data.get('baseUrl') || '').trim();
      ai.model = String(data.get('model') || '').trim();
      const key = String(data.get('apiKey') || '').trim();
      if (key) ai.apiKey = key;
      saveNow();
      showToast(ai.baseUrl && ai.model ? 'AI 设置已保存。' : '设置已保存；接口留空时会用本地陪伴。', 2800);
      renderPanel();
      return;
    }
    if (form.dataset.form === 'location') {
      const data = new FormData(form);
      state.settings.city = String(data.get('city') || '西安').trim().slice(0, 20) || '西安';
      const lat = Number(data.get('lat'));
      const lon = Number(data.get('lon'));
      if (Number.isFinite(lat) && lat >= -90 && lat <= 90) state.settings.lat = lat;
      if (Number.isFinite(lon) && lon >= -180 && lon <= 180) state.settings.lon = lon;
      saveSoon();
      weather = null;
      try { storage.removeItem(WEATHER_CACHE_KEY); } catch { /* noop */ }
      lastWeatherFetch = 0;
      loadWeather(true);
      renderPanel();
      showToast('地点更新了，马上重新看天气。', 2200);
    }
  });
}

function wireChromeEvents() {
  els.bubble.addEventListener('click', () => openPanel('chat'));
  els.dock.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-panel]');
    if (!btn) return;
    const target = btn.dataset.panel;
    if (!panelOpen) openPanel(target);
    else if (activeTab === target) closePanel();
    else openPanel(target);
  });
  els.focusChip.addEventListener('click', () => openPanel('focus'));
  els.contextMenu.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-command]');
    if (!btn) return;
    hideContextMenu();
    handleCommand(btn.dataset.command, btn);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!els.contextMenu.hidden) { hideContextMenu(); return; }
    if (panelOpen) closePanel();
  });
  window.addEventListener('resize', applyUiScale);
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow();
  });
  try {
    api.onAppAction((action) => {
      if (action === 'pet') playPet();
      else if (action === 'chat') openPanel('chat');
      else if (action === 'pomodoro') openPanel('focus');
    });
    api.onSettingsChanged((settings) => {
      if (typeof settings?.alwaysOnTop === 'boolean') {
        state.settings.alwaysOnTop = settings.alwaysOnTop;
        saveSoon();
        if (panelOpen && activeTab === 'settings') renderPanel();
      }
    });
  } catch { /* noop */ }
}

/* ---------------- main tick ---------------- */
function mainTick() {
  const now = Date.now();
  tickCount += 1;
  ensureDay(state, now);

  const result = tickPomodoro(state.pomodoro, now);
  if (result.completed) handlePomodoroComplete(result.completed);

  checkReminders(now);
  checkWater(now);

  if (state.sleeping) {
    state.energy = Math.min(100, state.energy + 0.09);
    state.mood = Math.min(100, state.mood + 0.008);
    state.satiety = Math.max(5, state.satiety - 0.004);
    if (now - lastZzz > 3000) { spawnZzz(); lastZzz = now; }
  } else {
    state.energy = Math.max(8, state.energy - 0.002);
    state.satiety = Math.max(5, state.satiety - 0.0035);
    state.mood = Math.max(10, state.mood - 0.001);
  }
  state.lastSeen = now;

  if (tickCount % 15 === 0) saveNow();
  updateLiveUI();

  if (tickCount % 60 === 0 && Date.now() - lastWeatherFetch > 30 * 60000) {
    loadWeather(true);
  }

  updateEdgeLayout();
  const perfNow = performance.now();
  if (overPet && !state.sleeping && !dragPointer?.started && !panelOpen && hoverSince
      && perfNow - hoverSince > 3200 && perfNow - lastHoverReaction > 45000
      && stage?.character && !stage.character.state.action) {
    lastHoverReaction = perfNow;
    stage.character.setAction('shy');
    const lines = [
      '别一直盯着我，我会害羞的。',
      '你是在等我说话吗？',
      '再盯下去，我的眼镜要起雾了。'
    ];
    showBubble(lines[Math.floor(Math.random() * lines.length)], { duration: 3000 });
    spawnHearts(1);
  }
}

/* ---------------- init ---------------- */
function buildDock() {
  const buttons = [
    ['interact', 'menu', '陪伴菜单'],
    ['chat', 'chat', '和小申聊天'],
    ['focus', 'focus', '番茄钟与提醒'],
    ['dress', 'wardrobe', '衣橱']
  ];
  els.dock.innerHTML = buttons.map(([target, iconName, label]) => `
    <button class="dock-btn" type="button" data-panel="${target}" title="${label}" aria-label="打开${label}" data-testid="dock-${target}">${icon(iconName, 19)}</button>`).join('');
}

async function init() {
  els.app = $('#app');
  els.stage = $('#stage');
  els.canvas = $('#scene');
  els.bubble = $('#bubble');
  els.bubbleWrap = $('#bubbleWrap');
  els.bubbleText = $('#bubbleText');
  els.particles = $('#particles');
  els.dock = $('#dock');
  els.signatureStatus = $('#signatureStatus');
  els.focusChip = $('#focusChip');
  els.panel = $('#panel');
  els.panelHeader = $('#panelHeader');
  els.panelBody = $('#panelBody');
  els.contextMenu = $('#contextMenu');
  els.toastLayer = $('#toastLayer');
  els.confettiLayer = $('#confettiLayer');

  applyUiScale();
  buildDock();

  weather = weatherCached();
  try { appInfo = await api.getAppInfo(); } catch { /* default */ }
  state.settings.alwaysOnTop = !!appInfo.alwaysOnTop;
  state.settings.launchAtStartup = !!appInfo.launchAtStartup;
  state.settings.outfit = normalizeOutfit(state.settings.outfit);
  state.outfit = state.settings.outfit;

  try {
    stage = createStage(els.canvas);
    applyAllSettings();
  } catch (err) {
    console.error('3D stage failed:', err);
    els.canvas.style.display = 'none';
    showToast('3D 渲染初始化失败，请重启小申。', 6000);
  }

  wirePanelEvents();
  wireChromeEvents();
  attachPointerHandlers();
  setInteractive(false);

  // Reconcile a pomodoro that ended while the app was closed.
  const catchup = tickPomodoro(state.pomodoro, Date.now());
  if (catchup.completed) handlePomodoroComplete(catchup.completed);

  updateLiveUI();
  updateFocusChip();
  mainTickHandle = setInterval(mainTick, 1000);

  if (weather?.ok) updateWeatherUI();
  setTimeout(() => loadWeather(), 1400);

  if (!state.meta.lastGreetingDate || state.meta.lastGreetingDate !== getDateKey()) {
    state.meta.lastGreetingDate = getDateKey();
    saveSoon();
    setTimeout(() => {
      showBubble(getWelcome(state, context()), { duration: 6500, voice: false });
    }, 650);
    setTimeout(() => {
      showToast('按住我可以拖到桌面的任意角落。', 3600);
    }, 1500);
  } else {
    setTimeout(() => {
      showBubble(getWelcome(state, context()), { duration: 5200, voice: false });
    }, 700);
  }

  // A small always-on debug surface, used by the automated desktop tests.
  window.__xiaoshen = {
    getState: () => JSON.parse(JSON.stringify(state)),
    getCharacter: () => ({
      outfit: stage?.character.state.outfit,
      action: stage?.character.state.action,
      sleeping: stage?.character.state.sleeping,
      view: stage?.character.state.view,
      targetView: stage?.character.state.targetView,
      talking: stage?.character.state.talking,
      scale: stage?.character.state.baseScale,
      chair: stage?.character.rig.sleepSet?.visible ?? false,
      dragging: stage?.character.state.dragging ?? false,
      accessories: stage ? {
        glasses: stage.character.rig.glasses.visible,
        earrings: stage.character.rig.earrings.visible,
        necklace: stage.character.rig.necklace.visible,
        clip: stage.character.rig.hair.clip.visible,
        cap: stage.character.rig.cap.visible
      } : null
    }),
    getPerf: () => stage?.perf ?? null,
    getWeather: () => weather,
    getAppInfo: () => appInfo,
    isPanelOpen: () => panelOpen,
    activeTab: () => activeTab,
    windowInteractive: () => windowInteractive,
    hitTest: (x, y) => stage?.hitTest(x, y) ?? { hit: false },
    openPanel,
    closePanel,
    switchTab,
    playAction: (name) => triggerCharacterAction(name),
    pet: playPet,
    feed,
    wake: wakeUp,
    toggleSleep,
    setDragging: (value) => { stage?.character.setDragging(!!value); if (panelOpen) renderPanel(); },
    setView: (view) => { currentView = view; stage?.character.setView(view); },
    setOutfit: (outfit) => { const next = normalizeOutfit(outfit); state.settings.outfit = next; state.outfit = next; stage?.character.setOutfit(next); saveSoon(); },
    setStats: (patch) => {
      for (const key of ['mood', 'energy', 'satiety', 'intimacy']) {
        if (Number.isFinite(Number(patch?.[key]))) state[key] = Math.max(0, Math.min(100, Number(patch[key])));
      }
      saveNow();
      if (panelOpen) renderPanel();
    },
    setPomodoro: (endAtOffsetMs) => {
      state.pomodoro.running = true;
      state.pomodoro.endAt = Date.now() + Math.max(200, Number(endAtOffsetMs) || 1000);
      state.pomodoro.remainingMs = state.pomodoro.endAt - Date.now();
      saveNow();
      updateLiveUI();
    },
    forcePomodoroComplete: () => {
      state.pomodoro.endAt = Date.now() - 1;
      state.pomodoro.remainingMs = 0;
      state.pomodoro.running = true;
      mainTick();
    },
    sendChat: (text) => sendChat(text),
    addReminder: (payload) => {
      const result = createReminder(payload, Date.now());
      if (!result.ok) return result;
      state.reminders.push(result.reminder);
      state.reminders = sortReminders(state.reminders);
      saveNow();
      return result;
    },
    fireNextReminderForTest: () => {
      const due = dueReminders(state.reminders, Date.now() + 86400000 * 2);
      if (!due.length) return false;
      markReminderFired(due[0], Date.now());
      fireReminder(due[0]);
      return true;
    },
    portrait: () => stage?.renderPortrait(),
    portraitRaw: () => stage?.renderPortrait({ withBackground: false }),
    showBubble,
    stopTalking: () => { stage?.character.setTalking(false); stage?.character.setExpression('smile'); },
    toast: showToast,
    resetForTest: () => {
      state = createDefaultState();
      applyAllSettings();
      saveNow();
      if (panelOpen) renderPanel();
    }
  };
  window.__xiaoshenReady = true;
}

init().catch((err) => {
  console.error('Xiaoshen init failed:', err);
  const bubble = document.getElementById('bubbleWrap');
  const text = document.getElementById('bubbleText');
  if (bubble && text) {
    bubble.hidden = false;
    text.textContent = '小申启动时遇到了一点问题，请重启应用。';
  }
});
