import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTFITS,
  OUTFIT_IDS,
  DEFAULT_OUTFIT,
  isValidOutfit,
  normalizeOutfit,
  getOutfit,
  getOutfitBubble
} from '../../src/renderer/features/outfits.js';

test('six distinct outfits are registered', () => {
  assert.equal(OUTFITS.length, 8);
  assert.equal(OUTFIT_IDS.size, 8);
  for (const id of ['sweater', 'plaid', 'windbreakerLilac', 'windbreakerNavy', 'windbreakerBlack', 'crabTee', 'crabCargo', 'blackTop']) {
    assert.equal(isValidOutfit(id), true, id);
  }
  for (const outfit of OUTFITS) {
    assert.ok(outfit.name.length > 1);
    assert.ok(outfit.previewClass.length > 1);
    assert.ok(outfit.bubble.length > 4);
  }
});

test('unknown outfit ids fall back to the default', () => {
  assert.equal(DEFAULT_OUTFIT, 'sweater');
  assert.equal(normalizeOutfit('nope'), 'sweater');
  assert.equal(normalizeOutfit('crabTee'), 'crabTee');
  assert.equal(getOutfit('nope').id, 'sweater');
  assert.equal(getOutfit('windbreakerNavy').previewClass, 'windbreaker-navy');
  assert.match(getOutfitBubble('crabTee'), /蟹|半裙/);
});
