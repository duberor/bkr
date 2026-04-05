import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDesignLoadPower,
  getProjectSummary,
  getRecommendedBatteryType,
  getRecommendedBatteryVoltage,
  getRecommendedBatteryCapacityAh,
  getRecommendedInverterPower,
  getSolutionVariants,
  getSystemCalculation,
  getTotalSurgePower,
  normalizeConsumer,
} from '../src/utils/consumer-utils.js';

test('normalizeConsumer uses working power when surge power is omitted', () => {
  const consumer = normalizeConsumer({
    name: 'Котел',
    power: '120',
    quantity: '1',
    hoursPerDay: '10',
    surgePower: '',
  });

  assert.equal(consumer.power, 120);
  assert.equal(consumer.surgePower, 120);
});

test('design load and inverter recommendation use scheduled peak plus startup delta', () => {
  const consumers = [
    normalizeConsumer({
      name: 'Базове навантаження',
      power: 200,
      quantity: 1,
      hoursPerDay: 24,
      surgePower: 200,
      usageProfile: 'always',
    }),
    normalizeConsumer({
      name: 'Насос',
      power: 100,
      quantity: 1,
      hoursPerDay: 1,
      surgePower: 300,
      usageProfile: 'day',
    }),
  ];

  assert.equal(getDesignLoadPower(consumers), 300);
  assert.equal(getTotalSurgePower(consumers), 500);
  assert.equal(getRecommendedInverterPower(consumers, 1.2), 500);
});

test('battery recommendation uses target autonomy hours instead of full days only', () => {
  const consumers = [
    normalizeConsumer({
      name: 'Роутер',
      power: 100,
      quantity: 1,
      hoursPerDay: 6,
      surgePower: 100,
      usageProfile: 'always',
    }),
  ];

  const halfDay = getRecommendedBatteryCapacityAh(consumers, {
    batteryVoltage: 12,
    batteryType: 'lifepo4',
    targetAutonomyHours: 12,
    inverterEfficiency: 0.92,
    batteryReserveRatio: 1.15,
  });

  const fullDay = getRecommendedBatteryCapacityAh(consumers, {
    batteryVoltage: 12,
    batteryType: 'lifepo4',
    targetAutonomyHours: 24,
    inverterEfficiency: 0.92,
    batteryReserveRatio: 1.15,
  });

  assert.equal(halfDay, 40);
  assert.equal(fullDay, 79);
});

test('system calculation keeps canonical autonomy in hours', () => {
  const consumers = [
    normalizeConsumer({
      name: 'Освітлення',
      power: 150,
      quantity: 1,
      hoursPerDay: 8,
      surgePower: 150,
      usageProfile: 'evening',
    }),
  ];

  const calc = getSystemCalculation(consumers, {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 36,
    autonomyInputUnit: 'days',
  });

  assert.equal(calc.targetAutonomyHours, 36);
  assert.ok(calc.requiredEnergyWh > 0);
  assert.ok(calc.recommendedBatteryCapacityAh > 0);
});

test('solution variants provide economy, balance, and reliability paths', () => {
  const consumers = [
    normalizeConsumer({
      name: 'Котел',
      power: 120,
      quantity: 1,
      hoursPerDay: 16,
      surgePower: 150,
      priority: 'high',
      usageProfile: 'always',
    }),
    normalizeConsumer({
      name: 'Освітлення',
      power: 60,
      quantity: 1,
      hoursPerDay: 6,
      surgePower: 60,
      priority: 'medium',
      usageProfile: 'evening',
    }),
    normalizeConsumer({
      name: 'Телевізор',
      power: 120,
      quantity: 1,
      hoursPerDay: 4,
      surgePower: 120,
      priority: 'low',
      usageProfile: 'evening',
    }),
  ];

  const variants = getSolutionVariants(consumers, {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 6,
    reserveRatio: 1.2,
    batteryReserveRatio: 1.15,
  });

  assert.equal(variants.length, 3);
  assert.equal(variants[0].title, 'Економ');
  assert.equal(variants[1].title, 'Баланс');
  assert.equal(variants[2].title, 'Надійність');
  assert.ok(variants[0].activeItems.includes('Котел'));
  assert.ok(variants[1].activeItems.includes('Освітлення'));
  assert.ok(variants[2].activeItems.includes('Телевізор'));
});

test('project summary is built from consumers and settings only', () => {
  const consumers = [
    normalizeConsumer({
      name: 'Роутер',
      power: 20,
      quantity: 1,
      hoursPerDay: 24,
      surgePower: 20,
      usageProfile: 'always',
    }),
  ];

  const summary = getProjectSummary(consumers, {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 12,
  });

  assert.equal(summary.consumerCount, 1);
  assert.equal(summary.targetAutonomyHours, 12);
  assert.equal(summary.totalPower, 20);
  assert.ok(summary.recommendedInverterPower > 0);
  assert.equal('objectTypeLabel' in summary, false);
  assert.equal('backupScopeLabel' in summary, false);
});

test('recommended battery voltage is auto-selected from load level', () => {
  const lightConsumers = [
    normalizeConsumer({
      name: 'Роутер',
      power: 20,
      quantity: 1,
      hoursPerDay: 24,
      surgePower: 20,
      usageProfile: 'always',
    }),
  ];

  const mediumConsumers = [
    normalizeConsumer({
      name: 'Холодильник',
      power: 180,
      quantity: 1,
      hoursPerDay: 10,
      surgePower: 600,
      usageProfile: 'day',
    }),
    normalizeConsumer({
      name: 'Освітлення',
      power: 120,
      quantity: 1,
      hoursPerDay: 8,
      surgePower: 120,
      usageProfile: 'evening',
    }),
  ];

  const heavyConsumers = [
    normalizeConsumer({
      name: 'Насос',
      power: 1500,
      quantity: 1,
      hoursPerDay: 8,
      surgePower: 2200,
      usageProfile: 'day',
    }),
    normalizeConsumer({
      name: 'Котел',
      power: 400,
      quantity: 1,
      hoursPerDay: 16,
      surgePower: 500,
      usageProfile: 'always',
    }),
    normalizeConsumer({
      name: 'Освітлення',
      power: 300,
      quantity: 1,
      hoursPerDay: 8,
      surgePower: 300,
      usageProfile: 'evening',
    }),
  ];

  assert.equal(getRecommendedBatteryVoltage(lightConsumers, {}), 12);
  assert.equal(getRecommendedBatteryVoltage(mediumConsumers, {}), 24);
  assert.equal(getRecommendedBatteryVoltage(heavyConsumers, {}), 48);
});

test('recommended battery type defaults to lifepo4', () => {
  assert.equal(getRecommendedBatteryType([], {}), 'lifepo4');
});
