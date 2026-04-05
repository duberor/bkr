import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadScenario,
  loadSystemSettings,
  saveScenario,
  saveSystemSettings,
} from '../src/utils/storage.js';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

test('loadSystemSettings migrates legacy autonomyDays and drops simultaneityFactor', (t) => {
  global.localStorage = new MemoryStorage();
  t.after(() => {
    delete global.localStorage;
  });

  global.localStorage.setItem(
    'ups-planner-system-settings',
    JSON.stringify({
      batteryVoltage: 48,
      batteryType: 'gel',
      autonomyDays: 2,
      simultaneityFactor: 0.7,
    }),
  );

  const settings = loadSystemSettings();

  assert.equal(settings.batteryVoltage, 48);
  assert.equal(settings.batteryVoltageMode, 'manual');
  assert.equal(settings.batteryType, 'gel');
  assert.equal(settings.batteryTypeMode, 'manual');
  assert.equal(settings.targetAutonomyHours, 48);
  assert.equal(settings.autonomyInputUnit, 'days');
  assert.equal('simultaneityFactor' in settings, false);
});

test('saveSystemSettings stores canonical autonomy hours only', (t) => {
  global.localStorage = new MemoryStorage();
  t.after(() => {
    delete global.localStorage;
  });

  saveSystemSettings({
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    autonomyDays: 2,
    reserveRatio: 1.25,
  });

  const raw = global.localStorage.getItem('ups-planner-system-settings');
  const settings = JSON.parse(raw);

  assert.equal(settings.targetAutonomyHours, 48);
  assert.equal(settings.autonomyInputUnit, 'days');
  assert.equal(settings.batteryVoltageMode, 'auto');
  assert.equal(settings.batteryTypeMode, 'auto');
  assert.equal(settings.reserveRatio, 1.25);
  assert.equal('autonomyDays' in settings, false);
  assert.equal('simultaneityFactor' in settings, false);
});

test('scenario is saved and loaded with normalized values', (t) => {
  global.localStorage = new MemoryStorage();
  t.after(() => {
    delete global.localStorage;
  });

  saveScenario({
    objectType: 'house',
    scenarioType: 'heating',
    backupScope: 'critical',
    hasBoiler: true,
    hasPump: true,
    hasFridge: false,
    presetId: 'boiler-pumps',
    userMode: 'advanced',
  });

  const scenario = loadScenario();

  assert.equal(scenario.objectType, 'house');
  assert.equal(scenario.scenarioType, 'heating');
  assert.equal(scenario.backupScope, 'critical');
  assert.equal(scenario.hasBoiler, true);
  assert.equal(scenario.hasPump, true);
  assert.equal(scenario.hasFridge, false);
  assert.equal(scenario.presetId, 'boiler-pumps');
  assert.equal(scenario.userMode, 'advanced');
});
