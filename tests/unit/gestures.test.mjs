import test from 'node:test';
import assert from 'node:assert/strict';
import { createShakeDetector, pickRandomAction } from '../../src/renderer/features/gestures.js';

test('shake detector fires on a rapid horizontal wiggle', () => {
  const detector = createShakeDetector({ cooldownMs: 1000 });
  let fired = false;
  const xs = [100, 130, 95, 135, 90, 132, 92, 128];
  for (let i = 0; i < xs.length; i += 1) {
    fired = detector.push(xs[i], 200, 1000 + i * 60, true) || fired;
  }
  assert.equal(fired, true);
});

test('shake detector ignores slow or straight movement', () => {
  const detector = createShakeDetector({ cooldownMs: 1000 });
  for (let i = 0; i < 8; i += 1) {
    assert.equal(detector.push(100 + i * 8, 200, 1000 + i * 300, true), false);
  }
  for (let i = 0; i < 8; i += 1) {
    assert.equal(detector.push(100 + i * 20, 200, 3000 + i * 50, true), false);
  }
});

test('shake detector respects cooldown and requires near-pet samples', () => {
  const detector = createShakeDetector({ cooldownMs: 2000 });
  const xs = [100, 140, 95, 145, 90, 142, 92, 138];
  let count = 0;
  for (let i = 0; i < xs.length; i += 1) {
    if (detector.push(xs[i], 200, 1000 + i * 50, true)) count += 1;
  }
  assert.equal(count, 1);
  for (let i = 0; i < xs.length; i += 1) {
    if (detector.push(xs[i], 200, 1500 + i * 50, true)) count += 1;
  }
  assert.equal(count, 1);
  for (let i = 0; i < xs.length; i += 1) {
    assert.equal(detector.push(xs[i], 200, 5000 + i * 50, false), false);
  }
});

test('random action picker is bounded', () => {
  const list = ['a', 'b', 'c'];
  assert.equal(pickRandomAction(list, () => 0), 'a');
  assert.equal(pickRandomAction(list, () => 0.99), 'c');
  assert.equal(pickRandomAction([], () => 0.5), null);
});
