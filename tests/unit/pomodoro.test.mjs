import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPomodoro,
  configurePomodoro,
  startPomodoro,
  pausePomodoro,
  resetPomodoro,
  tickPomodoro,
  skipPomodoro,
  formatDuration,
  progressOf
} from '../../src/renderer/features/pomodoro.js';

test('timer starts, counts down and pauses without losing remaining time', () => {
  const now = 1000000;
  const state = createPomodoro(now, 25, 5);
  assert.equal(startPomodoro(state, now), true);
  const tick = tickPomodoro(state, now + 5 * 60000);
  assert.equal(tick.completed, null);
  assert.equal(tick.remainingMs, 20 * 60000);
  assert.equal(pausePomodoro(state, now + 6 * 60000), true);
  assert.equal(state.running, false);
  assert.equal(state.remainingMs, 19 * 60000);
  assert.equal(startPomodoro(state, now + 6 * 60000), true);
  assert.equal(state.endAt, now + 6 * 60000 + 19 * 60000);
});

test('focus completion switches to break and reports once', () => {
  const now = 5000;
  const state = createPomodoro(now, 1, 2);
  startPomodoro(state, now);
  const result = tickPomodoro(state, now + 61000);
  assert.equal(result.completed, 'focus');
  assert.equal(state.mode, 'break');
  assert.equal(state.running, false);
  assert.equal(state.remainingMs, 2 * 60000);
  assert.equal(tickPomodoro(state, now + 62000).completed, null);
});

test('break completion returns to focus length', () => {
  const now = 0;
  const state = createPomodoro(now, 25, 5);
  state.mode = 'break';
  state.totalMs = 5 * 60000;
  state.remainingMs = 5 * 60000;
  startPomodoro(state, now);
  const result = tickPomodoro(state, now + 5 * 60000 + 1);
  assert.equal(result.completed, 'break');
  assert.equal(state.mode, 'focus');
  assert.equal(state.remainingMs, 25 * 60000);
});

test('configure resets a running timer and clamps durations', () => {
  const state = createPomodoro(0, 25, 5);
  startPomodoro(state, 0);
  configurePomodoro(state, 999, -4);
  assert.equal(state.running, false);
  assert.equal(state.focusMinutes, 120);
  assert.equal(state.breakMinutes, 1);
  assert.equal(state.remainingMs, 120 * 60000);
});

test('reset and skip behave safely', () => {
  const state = createPomodoro(0, 25, 5);
  startPomodoro(state, 0);
  resetPomodoro(state);
  assert.equal(state.running, false);
  assert.equal(state.mode, 'focus');
  assert.equal(state.remainingMs, 25 * 60000);
  startPomodoro(state, 1000);
  const skipped = skipPomodoro(state, 1000);
  assert.equal(skipped.completed, 'focus');
  assert.equal(state.mode, 'break');
});

test('format and progress helpers', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(25 * 60000), '25:00');
  assert.equal(formatDuration(59999), '01:00');
  const state = createPomodoro(0, 10, 5);
  state.remainingMs = 5 * 60000;
  assert.equal(progressOf(state), 0.5);
});
