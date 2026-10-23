import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultState,
  normalizeState,
  applyOfflineDecay,
  ensureDay,
  recordFocusMinutes,
  recordInteraction,
  relationshipLevel,
  daysTogether,
  todayHistory,
  getDateKey,
  loadStoredState,
  persistState,
  STORAGE_KEY
} from '../../src/renderer/features/store.js';

const DAY = 86400000;

test('default state has all required fields', () => {
  const now = new Date('2026-10-22T12:00:00').getTime();
  const state = createDefaultState(now);
  assert.equal(state.version, 1);
  assert.equal(state.today.date, getDateKey(new Date(now)));
  assert.equal(state.settings.outfit, 'sweater');
  assert.equal(state.settings.scale, 0.9);
  assert.equal(state.pomodoro.remainingMs, 25 * 60000);
  assert.deepEqual(state.chat, []);
  assert.deepEqual(state.reminders, []);
});

test('normalize repairs missing and invalid values', () => {
  const now = Date.now();
  const state = normalizeState({
    mood: 999,
    energy: 'oops',
    satiety: -3,
    intimacy: 42,
    settings: { outfit: 'plaid', scale: 4, accessories: { glasses: false }, water: { minutes: 500 } },
    pomodoro: { remainingMs: -2 },
    reminders: [{ id: 'r1', title: '喝水', at: now }, { nope: true }],
    chat: [{ role: 'user', text: 'hi' }, { role: 'weird', text: 123 }]
  }, now);
  assert.equal(state.mood, 100);
  assert.equal(state.energy, 74);
  assert.equal(state.satiety, 0);
  assert.equal(state.intimacy, 42);
  assert.equal(state.settings.outfit, 'plaid');
  assert.equal(state.settings.scale, 1.06);
  assert.equal(state.settings.accessories.glasses, false);
  assert.equal(state.settings.accessories.cap, false);
  assert.equal(state.settings.water.minutes, 180);
  assert.equal(state.reminders.length, 1);
  assert.equal(state.chat.length, 1);
  assert.equal(state.chat[0].text, 'hi');
});

test('offline decay lowers needs but keeps safe bounds', () => {
  const now = Date.now();
  const state = createDefaultState(now - 10 * 3600000);
  state.lastSeen = now - 10 * 3600000;
  applyOfflineDecay(state, now);
  assert.ok(state.energy < 74);
  assert.ok(state.satiety < 68);
  assert.ok(state.mood < 78);
  assert.ok(state.energy >= 8);

  const sleeping = createDefaultState(now - 10 * 3600000);
  sleeping.lastSeen = now - 10 * 3600000;
  sleeping.sleeping = true;
  applyOfflineDecay(sleeping, now);
  assert.ok(sleeping.energy > 74);
});

test('day changes reset today counters but preserve history', () => {
  const day1 = new Date('2026-10-20T10:00:00').getTime();
  const day2 = new Date('2026-10-21T09:00:00').getTime();
  const state = createDefaultState(day1);
  recordFocusMinutes(state, 25, day1);
  recordInteraction(state, 'pet', day1);
  assert.equal(state.today.focusMinutes, 25);
  assert.equal(state.today.pets, 1);
  ensureDay(state, day2);
  assert.equal(state.today.focusMinutes, 0);
  assert.equal(state.today.pets, 0);
  assert.equal(state.historyFocus[getDateKey(new Date(day1))], 25);
});

test('new outfits survive normalization and unknown ids fall back', () => {
  const now = Date.now();
  for (const id of ['windbreakerLilac', 'windbreakerNavy', 'crabTee', 'blackTop']) {
    const state = normalizeState({ settings: { outfit: id } }, now);
    assert.equal(state.outfit, id);
    assert.equal(state.settings.outfit, id);
  }
  const fallback = normalizeState({ settings: { outfit: 'unknown-outfit' } }, now);
  assert.equal(fallback.outfit, 'sweater');
  assert.equal(fallback.settings.outfit, 'sweater');
});

test('focus and interactions raise relationship counters', () => {
  const now = Date.now();
  const state = createDefaultState(now);
  recordFocusMinutes(state, 25, now);
  recordInteraction(state, 'feed', now);
  recordInteraction(state, 'chat', now);
  assert.equal(state.today.focusMinutes, 25);
  assert.equal(state.today.feeds, 1);
  assert.equal(state.today.chats, 1);
  assert.ok(state.satiety > 68);
  assert.ok(state.intimacy > 12);
});

test('relationship levels and days together', () => {
  assert.equal(relationshipLevel(0).name, '初识搭子');
  assert.equal(relationshipLevel(12).name, '熟悉搭子');
  assert.equal(relationshipLevel(31).name, '默契搭子');
  assert.equal(relationshipLevel(61).name, '亲近搭子');
  assert.equal(relationshipLevel(95).name, '知心搭子');
  const now = Date.now();
  assert.equal(daysTogether({ createdAt: now - 2 * DAY }, now), 3);
});

test('today history returns seven ordered points including today', () => {
  const now = new Date('2026-10-22T12:00:00').getTime();
  const state = createDefaultState(now);
  recordFocusMinutes(state, 15, now);
  const history = todayHistory(state, 7, now);
  assert.equal(history.length, 7);
  assert.equal(history[6].minutes, 15);
  assert.equal(history[0].label, '10/16');
});

test('load and persist tolerate broken storage', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value)
  };
  assert.equal(loadStoredState(storage).settings.outfit, 'sweater');
  storage.setItem(STORAGE_KEY, '{ broken json');
  assert.equal(loadStoredState(storage).energy > 0, true);
  const state = createDefaultState();
  assert.equal(persistState(storage, state), true);
  const loaded = loadStoredState(storage);
  assert.ok(loaded.createdAt > 0);
});
