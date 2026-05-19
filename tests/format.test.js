import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatAutonomy,
  formatBattery,
  formatBatteryTopology,
  formatEnergyWh,
  formatNumber,
  formatPower,
} from '../src/utils/format.js';

test('formatAutonomy uses correct Ukrainian day labels', () => {
  assert.equal(formatAutonomy(24), '1 доба');
  assert.equal(formatAutonomy(48), '2 доби');
  assert.equal(formatAutonomy(72), '3 доби');
  assert.equal(formatAutonomy(120), '5 діб');
  assert.equal(formatAutonomy(264), '11 діб');
});

test('formatAutonomy splits hours over 24 into days and remainder hours', () => {
  assert.equal(formatAutonomy(28.8), '1 доба 5 год');
  assert.equal(formatAutonomy(50), '2 доби 2 год');
});

test('formatAutonomy with preferDays:false keeps the value in hours with one decimal', () => {
  assert.equal(formatAutonomy(4.9, { preferDays: false }), '4,9 год');
  assert.equal(formatAutonomy(28.8, { preferDays: false }), '28,8 год');
});

test('formatAutonomy: 0 і відʼємні значення дають прочерк', () => {
  assert.equal(formatAutonomy(0), '—');
  assert.equal(formatAutonomy(-5), '—');
  assert.equal(formatAutonomy(null), '—');
  assert.equal(formatAutonomy(undefined), '—');
});

test('formatAutonomy: години без дробу', () => {
  assert.equal(formatAutonomy(5, { preferDays: false }), '5 год');
  assert.equal(formatAutonomy(12, { preferDays: false }), '12 год');
});

test('formatAutonomy: точне число днів без години-залишку', () => {
  assert.equal(formatAutonomy(48), '2 доби');
  assert.equal(formatAutonomy(96), '4 доби');
});

test('formatAutonomy: 11–14 діб має суфікс "діб"', () => {
  assert.equal(formatAutonomy(264), '11 діб');
  assert.equal(formatAutonomy(288), '12 діб');
  assert.equal(formatAutonomy(336), '14 діб');
});

test('formatBattery: вивід Ah і локаль', () => {
  assert.equal(formatBattery(200), '200 Ah');
  assert.equal(formatBattery(1500), '1 500 Ah'); // NBSP як тисячний роздільник
});

test('formatBatteryTopology: текстовий і технічний формат', () => {
  assert.equal(formatBatteryTopology(2, 3), '2 послідовно · 3 паралельно');
  assert.equal(formatBatteryTopology(4, 2, { technical: true }), '4S / 2P');
});

test('formatPower: цілі ватти', () => {
  assert.equal(formatPower(500), '500 W');
  assert.equal(formatPower(2350.7), '2 351 W');
});

test('formatEnergyWh: <1000 → Wh, >=1000 → kWh', () => {
  assert.equal(formatEnergyWh(500), '500 Wh');
  assert.equal(formatEnergyWh(1500), '1,5 kWh');
  assert.equal(formatEnergyWh(24410), '24,41 kWh');
});

test('formatEnergyWh: 0 і пусті значення', () => {
  assert.equal(formatEnergyWh(0), '0 Wh');
  assert.equal(formatEnergyWh(null), '0 Wh');
});

test('formatNumber: дотримується maxFractionDigits', () => {
  assert.equal(formatNumber(3.14159, 2), '3,14');
  assert.equal(formatNumber(100, 0), '100');
  assert.equal(formatNumber(0.5, 1), '0,5');
});
