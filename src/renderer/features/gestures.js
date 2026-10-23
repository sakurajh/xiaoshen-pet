export function createShakeDetector({
  windowMs = 700,
  minStep = 7,
  minReversals = 4,
  minSpan = 34,
  cooldownMs = 6500
} = {}) {
  let samples = [];
  let lastFireAt = -Infinity;

  function reset() {
    samples = [];
  }

  function push(x, y, time, near = true) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(time)) return false;
    if (!near) {
      samples = [];
      return false;
    }
    samples.push({ x, y, t: time });
    while (samples.length && time - samples[0].t > windowMs) samples.shift();
    if (samples.length < 5) return false;
    if (time - lastFireAt < cooldownMs) return false;

    let reversals = 0;
    let direction = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let prev = samples[0];
    for (let i = 1; i < samples.length; i += 1) {
      const cur = samples[i];
      minX = Math.min(minX, cur.x);
      maxX = Math.max(maxX, cur.x);
      const dx = cur.x - prev.x;
      if (Math.abs(dx) >= minStep) {
        const sign = Math.sign(dx);
        if (direction && sign !== direction) reversals += 1;
        direction = sign;
      }
      prev = cur;
    }
    const span = samples[samples.length - 1].t - samples[0].t;
    if (reversals >= minReversals && maxX - minX >= minSpan && span <= windowMs) {
      lastFireAt = time;
      samples = [];
      return true;
    }
    return false;
  }

  return { push, reset, get sampleCount() { return samples.length; } };
}

export function pickRandomAction(list, rng = Math.random) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}
