import test from 'node:test';
import assert from 'node:assert/strict';

import { formatAutonomy } from '../src/utils/format.js';

test('formatAutonomy uses correct Ukrainian day labels', () => {
  assert.equal(formatAutonomy(24), '1 доба');
  assert.equal(formatAutonomy(48), '2 доби');
  assert.equal(formatAutonomy(72), '3 доби');
  assert.equal(formatAutonomy(120), '5 діб');
  assert.equal(formatAutonomy(264), '11 діб');
});

test('formatAutonomy keeps decimal day values and hour formatting', () => {
  assert.equal(formatAutonomy(28.8), '1,2 доби');
  assert.equal(formatAutonomy(4.9, { preferDays: false }), '4,9 год');
});
