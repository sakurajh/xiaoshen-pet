let counter = 0;

export function makeReminderId(now = Date.now()) {
  counter = (counter + 1) % 1000;
  return `r-${now.toString(36)}-${counter.toString(36)}`;
}

export function createReminder({ title, at, repeat = 'once' }, now = Date.now()) {
  const text = String(title || '').trim().slice(0, 60);
  const timestamp = Number(at);
  if (!text) return { ok: false, error: '提醒内容不能为空' };
  if (!Number.isFinite(timestamp) || timestamp < now - 5000) return { ok: false, error: '提醒时间需要晚于现在' };
  return {
    ok: true,
    reminder: {
      id: makeReminderId(now),
      title: text,
      at: timestamp,
      repeat: repeat === 'daily' ? 'daily' : 'once',
      done: false,
      createdAt: now,
      lastFired: 0
    }
  };
}

export function dueReminders(reminders, now = Date.now()) {
  if (!Array.isArray(reminders)) return [];
  return reminders.filter((r) => r && !r.done && r.at <= now && (!r.lastFired || now - r.lastFired > 3000));
}

export function markReminderFired(reminder, now = Date.now()) {
  if (!reminder) return reminder;
  reminder.lastFired = now;
  if (reminder.repeat === 'daily') {
    const next = new Date(reminder.at);
    let guard = 0;
    do {
      next.setDate(next.getDate() + 1);
      guard += 1;
    } while (next.getTime() <= now + 1000 && guard < 400);
    reminder.at = next.getTime();
    reminder.done = false;
  } else {
    reminder.done = true;
  }
  return reminder;
}

export function sortReminders(reminders) {
  return [...(reminders || [])].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    return a.at - b.at;
  });
}

export function pruneReminders(reminders, now = Date.now()) {
  return (reminders || []).filter((r) => !r.done || now - (r.lastFired || 0) < 86400000);
}

export function formatReminderDate(timestamp, now = Date.now()) {
  const date = new Date(timestamp);
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (sameDay(date, today)) return `今天 ${time}`;
  if (sameDay(date, tomorrow)) return `明天 ${time}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

export function toDateTimeLocalValue(timestamp) {
  const date = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
