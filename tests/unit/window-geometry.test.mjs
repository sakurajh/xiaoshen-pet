import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { keepPetVisible, keepPanelVisible, petScreenPoint, PET_ANCHOR, PANEL } = require('../../src/main/windowGeometry.js');

const area = { x: 0, y: 0, width: 1707, height: 1019 };

test('pet can sit at every screen edge while the big window goes off-screen', () => {
  const farLeft = keepPetVisible({ x: -520, y: 260, width: 844, height: 804 }, area);
  const anchor = petScreenPoint(farLeft);
  assert.ok(anchor.x >= area.x + 28 && anchor.x <= area.width - 28);
  assert.ok(farLeft.x < 0, 'the transparent window is allowed to extend off-screen');

  const farRight = keepPetVisible({ x: 1400, y: 260, width: 844, height: 804 }, area);
  assert.ok(petScreenPoint(farRight).x <= area.width - 28);

  const farTop = keepPetVisible({ x: 300, y: -500, width: 844, height: 804 }, area);
  assert.ok(petScreenPoint(farTop).y >= area.y + 28);
  assert.ok(farTop.y < 0);

  const farBottom = keepPetVisible({ x: 300, y: 700, width: 844, height: 804 }, area);
  assert.ok(petScreenPoint(farBottom).y <= area.height - 28);
});

test('a pet already on screen is not moved', () => {
  const bounds = { x: 400, y: 200, width: 844, height: 804 };
  const next = keepPetVisible(bounds, area);
  assert.deepEqual({ x: next.x, y: next.y }, { x: 400, y: 200 });
});

test('panel is moved on screen without resizing the pet window', () => {
  const offscreen = { x: -520, y: -300, width: 844, height: 804 };
  const next = keepPanelVisible(offscreen, area);
  assert.ok(next.x + PANEL.x >= area.x + 16);
  assert.ok(next.x + PANEL.x + PANEL.width <= area.x + area.width - 16);
  assert.ok(next.y + PANEL.y >= area.y + 16);
  assert.ok(next.y + PANEL.y + PANEL.height <= area.y + area.height - 16);
  assert.equal(next.width, offscreen.width);
  assert.equal(next.height, offscreen.height);
});

test('panel stays put if it is already fully visible', () => {
  const bounds = { x: 300, y: 100, width: 844, height: 804 };
  const next = keepPanelVisible(bounds, area);
  assert.deepEqual({ x: next.x, y: next.y }, { x: 300, y: 100 });
});

test('small work areas still keep the panel top-left reachable', () => {
  const small = { x: 0, y: 0, width: 360, height: 500 };
  const next = keepPanelVisible({ x: -100, y: -100, width: 844, height: 804 }, small);
  assert.ok(next.x + PANEL.x >= small.x + 16);
  assert.ok(next.y + PANEL.y >= small.y + 16);
});

test('anchor constants describe the visible pet area', () => {
  assert.ok(PET_ANCHOR.x > 400 && PET_ANCHOR.x < 840);
  assert.ok(PET_ANCHOR.y > 300 && PET_ANCHOR.y < 800);
});
