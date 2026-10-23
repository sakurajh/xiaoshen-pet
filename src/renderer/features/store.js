import { DEFAULT_OUTFIT, normalizeOutfit } from './outfits.js';

export const STORAGE_KEY = 'xiaoshen.state.v1';
export const STATE_VERSION = 1;

export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createDefaultSettings() {
  return {
    voice: true,
    volume: 0.9,
    alwaysOnTop: true,
    launchAtStartup: false,
    quality: 'high',
    outfit: DEFAULT_OUTFIT,
    scale: 0.9,
    autoRotate: false,
    accessories: { glasses: true, earrings: true, necklace: true, clip: true, cap: false },
    ai: { enabled: false, baseUrl: '', apiKey: '', model: '' },
    city: '西安',
    lat: 34.26,
    lon: 108.94,
    water: { enabled: false, minutes: 45, lastAt: 0 },
    pomodoroFocus: 25,
    pomodoroBreak: 5
  };
}

export function createDefaultState(now = Date.now()) {
  return {
    version: STATE_VERSION,
    createdAt: now,
    lastSeen: now,
    mood: 78,
    energy: 74,
    satiety: 68,
    intimacy: 12,
    totalPets: 0,
    totalChats: 0,
    totalFeeds: 0,
    sleeping: false,
    outfit: DEFAULT_OUTFIT,
    today: {
      date: getDateKey(new Date(now)),
      focusMinutes: 0,
      pets: 0,
      chats: 0,
      feeds: 0
    },
    historyFocus: {},
    settings: createDefaultSettings(),
    pomodoro: {
      running: false,
      mode: 'focus',
      totalMs: 25 * 60 * 1000,
      remainingMs: 25 * 60 * 1000,
      endAt: 0,
      focusMinutes: 25,
      breakMinutes: 5
    },
    reminders: [],
    chat: [],
    meta: { lastGreetingDate: '', aiFallbackNotice: false }
  };
}

const clampNumber = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export function normalizeState(raw, now = Date.now()) {
  const base = createDefaultState(now);
  if (!raw || typeof raw !== 'object') return base;
  const state = {
    ...base,
    ...raw,
    settings: {
      ...base.settings,
      ...(raw.settings || {}),
      accessories: { ...base.settings.accessories, ...(raw.settings?.accessories || {}) },
      ai: { ...base.settings.ai, ...(raw.settings?.ai || {}) },
      water: { ...base.settings.water, ...(raw.settings?.water || {}) }
    },
    today: { ...base.today, ...(raw.today || {}) },
    pomodoro: { ...base.pomodoro, ...(raw.pomodoro || {}) },
    meta: { ...base.meta, ...(raw.meta || {}) },
    historyFocus: raw.historyFocus && typeof raw.historyFocus === 'object' ? { ...raw.historyFocus } : {},
    reminders: Array.isArray(raw.reminders) ? raw.reminders.filter((r) => r && r.id && r.title).slice(0, 50) : [],
    chat: Array.isArray(raw.chat) ? raw.chat.filter((m) => m && m.role && typeof m.text === 'string').slice(-40) : []
  };
  state.version = STATE_VERSION;
  state.mood = clampNumber(state.mood, 0, 100, base.mood);
  state.energy = clampNumber(state.energy, 0, 100, base.energy);
  state.satiety = clampNumber(state.satiety, 0, 100, base.satiety);
  state.intimacy = clampNumber(state.intimacy, 0, 100, base.intimacy);
  state.totalPets = clampNumber(state.totalPets, 0, 999999, 0);
  state.totalChats = clampNumber(state.totalChats, 0, 999999, 0);
  state.totalFeeds = clampNumber(state.totalFeeds, 0, 999999, 0);
  state.sleeping = !!state.sleeping;
  state.outfit = normalizeOutfit(state.settings.outfit);
  state.settings.outfit = state.outfit;
  state.settings.scale = clampNumber(state.settings.scale, 0.82, 1.06, 0.9);
  state.settings.volume = clampNumber(state.settings.volume, 0, 1, 0.9);
  state.settings.quality = state.settings.quality === 'power' ? 'power' : 'high';
  state.settings.water.minutes = Math.round(clampNumber(state.settings.water.minutes, 15, 180, 45));
  state.settings.pomodoroFocus = Math.round(clampNumber(state.settings.pomodoroFocus, 5, 120, 25));
  state.settings.pomodoroBreak = Math.round(clampNumber(state.settings.pomodoroBreak, 1, 60, 5));
  const todayKey = getDateKey(new Date(now));
  if (state.today.date !== todayKey) {
    state.today = { date: todayKey, focusMinutes: 0, pets: 0, chats: 0, feeds: 0 };
  }
  if (state.lastSeen > now) state.lastSeen = now;
  return state;
}

export function applyOfflineDecay(state, now = Date.now()) {
  const last = Number(state.lastSeen) || now;
  const hours = Math.max(0, Math.min(72, (now - last) / 3600000));
  if (hours < 0.02) return state;
  if (!state.sleeping) {
    state.energy = clampNumber(state.energy - hours * 1.7, 8, 100, state.energy);
    state.satiety = clampNumber(state.satiety - hours * 2.1, 5, 100, state.satiety);
    state.mood = clampNumber(state.mood - hours * 0.7, 15, 100, state.mood);
  } else {
    state.energy = clampNumber(state.energy + hours * 2.4, 0, 100, state.energy);
    state.satiety = clampNumber(state.satiety - hours * 1.2, 5, 100, state.satiety);
  }
  state.lastSeen = now;
  return state;
}

export function ensureDay(state, now = Date.now()) {
  const key = getDateKey(new Date(now));
  if (state.today.date !== key) {
    state.today = { date: key, focusMinutes: 0, pets: 0, chats: 0, feeds: 0 };
  }
  state.lastSeen = now;
  return state;
}

export function recordFocusMinutes(state, minutes, now = Date.now()) {
  ensureDay(state, now);
  const value = Math.max(0, Math.round(minutes));
  state.today.focusMinutes += value;
  const key = getDateKey(new Date(now));
  state.historyFocus[key] = (state.historyFocus[key] || 0) + value;
  const keys = Object.keys(state.historyFocus).sort();
  while (keys.length > 30) {
    delete state.historyFocus[keys.shift()];
  }
  state.intimacy = clampNumber(state.intimacy + (value >= 25 ? 1 : 0.6), 0, 100, state.intimacy);
  state.mood = clampNumber(state.mood + 2, 0, 100, state.mood);
  return state;
}

export function recordInteraction(state, kind, now = Date.now()) {
  ensureDay(state, now);
  switch (kind) {
    case 'pet':
      state.totalPets += 1;
      state.today.pets += 1;
      state.mood = clampNumber(state.mood + 3, 0, 100, state.mood);
      state.intimacy = clampNumber(state.intimacy + 0.45, 0, 100, state.intimacy);
      break;
    case 'feed':
      state.totalFeeds += 1;
      state.today.feeds += 1;
      state.satiety = clampNumber(state.satiety + 22, 0, 100, state.satiety);
      state.mood = clampNumber(state.mood + 5, 0, 100, state.mood);
      state.intimacy = clampNumber(state.intimacy + 0.8, 0, 100, state.intimacy);
      break;
    case 'chat':
      state.totalChats += 1;
      state.today.chats += 1;
      state.intimacy = clampNumber(state.intimacy + 0.35, 0, 100, state.intimacy);
      state.mood = clampNumber(state.mood + 1.2, 0, 100, state.mood);
      break;
    case 'water':
      state.intimacy = clampNumber(state.intimacy + 0.3, 0, 100, state.intimacy);
      state.satiety = clampNumber(state.satiety + 2, 0, 100, state.satiety);
      state.settings.water.lastAt = now;
      break;
    case 'sleep':
      state.energy = clampNumber(state.energy + 4, 0, 100, state.energy);
      state.mood = clampNumber(state.mood + 2, 0, 100, state.mood);
      break;
    default:
      break;
  }
  state.lastSeen = now;
  return state;
}

export function relationshipLevel(intimacy) {
  if (intimacy >= 90) return { level: 5, name: '知心搭子', hearts: 5 };
  if (intimacy >= 60) return { level: 4, name: '亲近搭子', hearts: 4 };
  if (intimacy >= 30) return { level: 3, name: '默契搭子', hearts: 3 };
  if (intimacy >= 10) return { level: 2, name: '熟悉搭子', hearts: 2 };
  return { level: 1, name: '初识搭子', hearts: 1 };
}

export function daysTogether(state, now = Date.now()) {
  return Math.max(1, Math.floor((now - state.createdAt) / 86400000) + 1);
}

export function loadStoredState(storage, now = Date.now()) {
  try {
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    const state = normalizeState(raw, now);
    if (raw) applyOfflineDecay(state, now);
    state.lastSeen = now;
    return state;
  } catch {
    return createDefaultState(now);
  }
}

export function persistState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function todayHistory(state, days = 7, now = Date.now()) {
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    result.push({ key, minutes: state.historyFocus[key] || 0, label: `${d.getMonth() + 1}/${d.getDate()}` });
  }
  return result;
}
