import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SKINS, FRUITS, SPECIAL_FRUIT_MAP,
  segCircleHit, calcComboBonus, calcComboFeverEnergy,
} from '../games/fruit/modules/rules.js';

test('fruit configs define valid skins, fruits, and special fruit mappings', () => {
  assert.ok(SKINS.silver && SKINS.aurora);
  assert.ok(FRUITS.length >= 14);
  for (const fruit of FRUITS) {
    assert.ok(fruit.id && fruit.r > 0 && fruit.pts >= 1);
  }
  for (const [kind, fruit] of Object.entries(SPECIAL_FRUIT_MAP)) {
    assert.ok(kind && fruit && fruit.id);
  }
});

test('segCircleHit detects intersections, tangent hits, contained points, zero-length segments, and misses', () => {
  // Segment passing straight through circle center
  assert.equal(segCircleHit(0, 50, 100, 50, 50, 50, 20), true);
  // Tangent touch at exact radius
  assert.equal(segCircleHit(0, 30, 100, 30, 50, 50, 20), true);
  // Zero-length segment inside circle
  assert.equal(segCircleHit(55, 55, 55, 55, 50, 50, 20), true);
  // Zero-length segment outside circle
  assert.equal(segCircleHit(80, 80, 80, 80, 50, 50, 20), false);
  // Segment stops before reaching circle
  assert.equal(segCircleHit(0, 50, 25, 50, 50, 50, 20), false);
  // Segment passes far above circle
  assert.equal(segCircleHit(0, 10, 100, 10, 50, 50, 20), false);
});

test('combo bonus and fever energy scale as expected at 3+ hits', () => {
  assert.equal(calcComboBonus(0), 0);
  assert.equal(calcComboBonus(2), 0);
  assert.equal(calcComboBonus(3), 3);
  assert.equal(calcComboBonus(6), 6);

  assert.equal(calcComboFeverEnergy(2), 0);
  assert.equal(calcComboFeverEnergy(3), 12);
  assert.equal(calcComboFeverEnergy(4), 18);
  assert.equal(calcComboFeverEnergy(5), 25);
  assert.equal(calcComboFeverEnergy(7), 25);
});
