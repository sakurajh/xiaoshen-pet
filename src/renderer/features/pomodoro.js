export const DEFAULT_FOCUS_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;

export function createPomodoro(now = Date.now(), focusMinutes = DEFAULT_FOCUS_MINUTES, breakMinutes = DEFAULT_BREAK_MINUTES) {
  const totalMs = Math.max(1, focusMinutes) * 60000;
  return {
    running: false,
    mode: 'focus',
    totalMs,
    remainingMs: totalMs,
    endAt: 0,
    focusMinutes,
    breakMinutes
  };
}

export function configurePomodoro(state, focusMinutes, breakMinutes) {
  const focus = Math.round(Math.min(120, Math.max(5, Number(focusMinutes) || DEFAULT_FOCUS_MINUTES)));
  const rest = Math.round(Math.min(60, Math.max(1, Number(breakMinutes) || DEFAULT_BREAK_MINUTES)));
  const wasRunning = state.running;
  state.running = false;
  state.endAt = 0;
  state.focusMinutes = focus;
  state.breakMinutes = rest;
  state.mode = 'focus';
  state.totalMs = focus * 60000;
  state.remainingMs = state.totalMs;
  return wasRunning;
}

export function startPomodoro(state, now = Date.now()) {
  if (state.running) return false;
  if (state.remainingMs <= 0) {
    state.remainingMs = state.mode === 'focus' ? state.focusMinutes * 60000 : state.breakMinutes * 60000;
    state.totalMs = state.remainingMs;
  }
  state.running = true;
  state.endAt = now + state.remainingMs;
  return true;
}

export function pausePomodoro(state, now = Date.now()) {
  if (!state.running) return false;
  state.remainingMs = Math.max(0, state.endAt - now);
  state.running = false;
  state.endAt = 0;
  return true;
}

export function resetPomodoro(state) {
  state.running = false;
  state.mode = 'focus';
  state.totalMs = state.focusMinutes * 60000;
  state.remainingMs = state.totalMs;
  state.endAt = 0;
}

export function skipPomodoro(state, now = Date.now()) {
  state.remainingMs = 0;
  state.endAt = now;
  return tickPomodoro(state, now);
}

export function tickPomodoro(state, now = Date.now()) {
  const before = state.remainingMs;
  if (!state.running) {
    return { changed: false, completed: null, remainingMs: state.remainingMs, totalMs: state.totalMs, mode: state.mode };
  }
  state.remainingMs = Math.max(0, state.endAt - now);
  if (state.remainingMs > 0) {
    return {
      changed: before !== state.remainingMs,
      completed: null,
      remainingMs: state.remainingMs,
      totalMs: state.totalMs,
      mode: state.mode
    };
  }
  const completed = state.mode;
  state.running = false;
  state.endAt = 0;
  if (completed === 'focus') {
    state.mode = 'break';
    state.totalMs = state.breakMinutes * 60000;
    state.remainingMs = state.totalMs;
  } else {
    state.mode = 'focus';
    state.totalMs = state.focusMinutes * 60000;
    state.remainingMs = state.totalMs;
  }
  return {
    changed: true,
    completed,
    remainingMs: state.remainingMs,
    totalMs: state.totalMs,
    mode: state.mode,
    focusMinutes: state.focusMinutes,
    breakMinutes: state.breakMinutes
  };
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function progressOf(state) {
  if (!state.totalMs) return 0;
  return Math.min(1, Math.max(0, 1 - state.remainingMs / state.totalMs));
}
