import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReminder,
  dueReminders,
  markReminderFired,
  sortReminders,
  pruneReminders,
  formatReminderDate,
  toDateTimeLocalValue
} from '../../src/renderer/features/reminders.js';

const DAY = 86400000;

test('create reminder validates title and time', () => {
  const now = Date.now();
  assert.equal(createReminder({ title: '', at: now + 10000 }, now).ok, false);
  assert.equal(createReminder({ title: '开会', at: now - 20000 }, now).ok, false);
  const created = createReminder({ title: '开会', at: now + 60000, repeat: 'daily' }, now);
  assert.equal(created.ok, true);
  assert.equal(created.reminder.repeat, 'daily');
  assert.equal(created.reminder.done, false);
});

test('due reminders only include reached, unfinished and not recently fired', () => {
  const now = Date.now();
  const reminders = [
    { id: 'a', title: 'A', at: now - 1000, done: false, lastFired: 0 },
    { id: 'b', title: 'B', at: now + 60000, done: false, lastFired: 0 },
    { id: 'c', title: 'C', at: now - 60000, done: true, lastFired: 0 },
    { id: 'd', title: 'D', at: now - 1000, done: false, lastFired: now - 1000 }
  ];
  const due = dueReminders(reminders, now);
  assert.deepEqual(due.map((r) => r.id), ['a']);
});

test('once reminders complete after firing', () => {
  const now = Date.now();
  const reminder = { id: 'a', title: '喝水', at: now - 1000, repeat: 'once', done: false, lastFired: 0 };
  markReminderFired(reminder, now);
  assert.equal(reminder.done, true);
  assert.equal(reminder.lastFired, now);
});

test('daily reminders move to the next future day', () => {
  const now = new Date('2026-10-22T09:30:00').getTime();
  const at = new Date('2026-10-22T09:00:00').getTime();
  const reminder = { id: 'a', title: '站会', at, repeat: 'daily', done: false, lastFired: 0 };
  markReminderFired(reminder, now);
  assert.equal(reminder.done, false);
  assert.ok(reminder.at > now);
  const next = new Date(reminder.at);
  assert.equal(next.getDate(), 23);
  assert.equal(next.getHours(), 9);
});

test('sorting puts unfinished and earlier reminders first', () => {
  const now = Date.now();
  const list = [
    { id: 'done', at: now, done: true },
    { id: 'late', at: now + 5000, done: false },
    { id: 'soon', at: now + 1000, done: false }
  ];
  assert.deepEqual(sortReminders(list).map((r) => r.id), ['soon', 'late', 'done']);
});

test('pruning removes old completed items but keeps recent ones', () => {
  const now = Date.now();
  const list = [
    { id: 'old', done: true, lastFired: now - 2 * DAY },
    { id: 'recent', done: true, lastFired: now - 1000 },
    { id: 'open', done: false }
  ];
  assert.deepEqual(pruneReminders(list, now).map((r) => r.id), ['recent', 'open']);
});

test('date formatting and datetime input helpers', () => {
  const now = new Date('2026-10-22T12:00:00');
  const today = new Date('2026-10-22T15:30:00');
  const tomorrow = new Date('2026-10-23T08:05:00');
  assert.match(formatReminderDate(today.getTime(), now.getTime()), /^今天 15:30$/);
  assert.match(formatReminderDate(tomorrow.getTime(), now.getTime()), /^明天 08:05$/);
  const input = toDateTimeLocalValue(today.getTime());
  assert.match(input, /^2026-10-22T15:30$/);
});
