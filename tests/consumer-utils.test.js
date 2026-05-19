import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBatteryConfigurationOptions,
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

function buildMixedPrioritySetup() {
  return [
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
}

test('solution variants expose essentials/economy/balance/reliability with current titles', () => {
  const variants = getSolutionVariants(buildMixedPrioritySetup(), {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 6,
    reserveRatio: 1.2,
    batteryReserveRatio: 1.15,
  });

  assert.equal(variants.length, 4);
  assert.deepEqual(
    variants.map((v) => v.key),
    ['essentials', 'economy', 'balance', 'reliability'],
  );
  assert.deepEqual(
    variants.map((v) => v.title),
    ['Без необов’язкового', 'Мінімум', 'Стандарт', 'З запасом'],
  );
  assert.equal(variants.filter((v) => v.isRecommended).length, 1);
  assert.equal(variants.find((v) => v.key === 'balance').isRecommended, true);
});

test('essentials variant drops only low-priority consumers and keeps the rest', () => {
  const variants = getSolutionVariants(buildMixedPrioritySetup(), {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 6,
  });

  const essentials = variants.find((v) => v.key === 'essentials');
  assert.ok(essentials, 'essentials variant must exist when low-priority items present');
  assert.deepEqual(essentials.activeItems.sort(), ['Котел', 'Освітлення']);
  assert.deepEqual(essentials.deferredItems, ['Телевізор']);
});

test('essentials variant is deduplicated away when no low-priority consumers exist', () => {
  const consumers = buildMixedPrioritySetup().filter((c) => c.priority !== 'low');
  const variants = getSolutionVariants(consumers, {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 6,
  });

  assert.equal(variants.some((v) => v.key === 'essentials'), false);
  assert.ok(variants.some((v) => v.key === 'balance'));
});

test('balance variant applies no extra reserve (parity with explicit user reserve=1.0)', () => {
  const variants = getSolutionVariants(buildMixedPrioritySetup(), {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 12,
    reserveRatio: 1.5,
    batteryReserveRatio: 1.5,
  });

  const balance = variants.find((v) => v.key === 'balance');
  assert.ok(balance);
  assert.equal(balance.calc.normalizedSettings.reserveRatio, 1.0);
  assert.equal(balance.calc.normalizedSettings.batteryReserveRatio, 1.0);
});

test('reliability variant scales target time by 1.2 and bumps battery reserve to ~1.15', () => {
  const variants = getSolutionVariants(buildMixedPrioritySetup(), {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 10,
    reserveRatio: 1.2,
    batteryReserveRatio: 1.15,
  });

  const reliability = variants.find((v) => v.key === 'reliability');
  assert.ok(reliability);
  assert.equal(reliability.calc.normalizedSettings.targetAutonomyHours, 12);
  // reliability додає +0.05 поверх batteryReserveRatio юзера (default 1.15 → 1.20)
  assert.ok(reliability.calc.normalizedSettings.batteryReserveRatio > 1.15);
  assert.ok(reliability.calc.normalizedSettings.batteryReserveRatio <= 1.21);
});

test('economy variant trims target time to 70% and keeps reserve at 1.0', () => {
  const variants = getSolutionVariants(buildMixedPrioritySetup(), {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 10,
  });

  const economy = variants.find((v) => v.key === 'economy');
  assert.ok(economy);
  assert.equal(economy.calc.normalizedSettings.targetAutonomyHours, 7);
  assert.equal(economy.calc.normalizedSettings.reserveRatio, 1.0);
  assert.equal(economy.calc.normalizedSettings.batteryReserveRatio, 1.0);
});

test('battery configuration options are deduplicated by bank capacity and capped at 3', () => {
  const consumers = [
    normalizeConsumer({
      name: 'Котел',
      power: 120,
      quantity: 1,
      hoursPerDay: 16,
      usageProfile: 'always',
    }),
  ];

  const configs = getBatteryConfigurationOptions(consumers, {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 12,
  });

  assert.ok(configs.length > 0, 'expected at least one config');
  assert.ok(configs.length <= 3, 'should be capped at 3 alternatives');

  const seenCapacities = new Set();
  for (const config of configs) {
    const key = `${config.bankVoltage}:${config.bankCapacityAh}`;
    assert.equal(seenCapacities.has(key), false, `duplicate bank capacity ${key}`);
    seenCapacities.add(key);
  }
});

test('battery configurations are sorted so the most practical option is first', () => {
  const consumers = [
    normalizeConsumer({
      name: 'Котел',
      power: 120,
      quantity: 1,
      hoursPerDay: 16,
      usageProfile: 'always',
    }),
  ];

  const configs = getBatteryConfigurationOptions(consumers, {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 24,
  });

  assert.ok(configs.length >= 2);
  for (let i = 1; i < configs.length; i++) {
    assert.ok(
      configs[i].practicalScore >= configs[i - 1].practicalScore,
      `practicalScore must be monotonically non-decreasing at index ${i}`,
    );
  }
});

test('battery configurations meet the required capacity (no under-spec)', () => {
  const consumers = [
    normalizeConsumer({
      name: 'Котел',
      power: 200,
      quantity: 1,
      hoursPerDay: 10,
      usageProfile: 'always',
    }),
  ];

  const settings = {
    batteryVoltage: 24,
    batteryType: 'lifepo4',
    targetAutonomyHours: 12,
  };
  const requiredAh = getRecommendedBatteryCapacityAh(consumers, settings);
  const configs = getBatteryConfigurationOptions(consumers, settings);

  assert.ok(requiredAh > 0);
  for (const config of configs) {
    assert.ok(
      config.bankCapacityAh >= requiredAh,
      `bank ${config.bankCapacityAh} Ah must cover required ${requiredAh} Ah`,
    );
  }
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

import {
  getCriticalityLabel,
  getObjectTypeLabel,
  getScenarioTypeLabel,
  getBackupScopeLabel,
  getDepthOfDischargeByBatteryType,
  getChargeRateByBatteryType,
  getRecommendedChargeCurrentA,
  getUsableStoredEnergyWh,
  getUsableEnergyWhFromBatteryAh,
  getEstimatedAutonomyHours,
  getAutonomyHoursByDailyConsumption,
  getDailyConsumptionWh,
  getTotalPower,
  getPeakScheduledLoadPower,
  getCategoryBreakdown,
  getPriorityBreakdown,
  getHourlyLoadProfile,
  getWorkingItemsByVariant,
  getDeferredItemsByVariant,
  getTopDrivers,
  normalizeSystemSettings,
} from '../src/utils/consumer-utils.js';

/* ── normalizeConsumer edge cases ────────────────────────────────── */

test('normalizeConsumer: відʼємну потужність зведено до 0', () => {
  const c = normalizeConsumer({ name: 'X', power: -50, quantity: 1, hoursPerDay: 1 });
  assert.equal(c.power, 0);
});

test('normalizeConsumer: дробову кількість округлено вгору і обмежено мінімумом 1', () => {
  const a = normalizeConsumer({ name: 'X', power: 10, quantity: 0.4, hoursPerDay: 1 });
  assert.equal(a.quantity, 1);
  const b = normalizeConsumer({ name: 'X', power: 10, quantity: 3.7, hoursPerDay: 1 });
  assert.equal(b.quantity, 4);
});

test('normalizeConsumer: surge не може бути менше power', () => {
  const c = normalizeConsumer({ name: 'X', power: 100, quantity: 1, hoursPerDay: 1, surgePower: 50 });
  assert.equal(c.surgePower, 100);
});

test('normalizeConsumer: hoursPerDay понад 24 обмежено до 24', () => {
  const c = normalizeConsumer({ name: 'X', power: 10, quantity: 1, hoursPerDay: 48 });
  assert.equal(c.hoursPerDay, 24);
});

test('normalizeConsumer: рядкові числа з комою парсяться', () => {
  const c = normalizeConsumer({ name: 'X', power: '1,5', quantity: '2', hoursPerDay: '0,5' });
  assert.equal(c.power, 1.5);
  assert.equal(c.quantity, 2);
  assert.equal(c.hoursPerDay, 0.5);
});

test('normalizeConsumer: id автогенерується якщо відсутній', () => {
  const c = normalizeConsumer({ name: 'X', power: 10, quantity: 1, hoursPerDay: 1 });
  assert.equal(typeof c.id, 'string');
  assert.ok(c.id.length > 0);
});

test('normalizeConsumer: explicit id зберігається', () => {
  const c = normalizeConsumer({ id: 'pre-existing', name: 'X', power: 10, quantity: 1, hoursPerDay: 1 });
  assert.equal(c.id, 'pre-existing');
});

/* ── normalizeSystemSettings ─────────────────────────────────────── */

test('normalizeSystemSettings: default values для пустого об\'єкта', () => {
  const s = normalizeSystemSettings({});
  assert.equal(s.batteryVoltage, 24);
  assert.equal(s.batteryType, 'lifepo4');
  assert.equal(s.targetAutonomyHours, 24);
  assert.equal(s.inverterEfficiency, 0.92);
  assert.equal(s.reserveRatio, 1.2);
  assert.equal(s.batteryReserveRatio, 1.15);
  assert.equal(s.topology, 'line-interactive');
});

test('normalizeSystemSettings: legacy autonomyDays конвертується в години', () => {
  const s = normalizeSystemSettings({ autonomyDays: 2 });
  assert.equal(s.targetAutonomyHours, 48);
});

test('normalizeSystemSettings: clamp inverterEfficiency в [0.7, 0.99]', () => {
  assert.equal(normalizeSystemSettings({ inverterEfficiency: 0.5 }).inverterEfficiency, 0.7);
  assert.equal(normalizeSystemSettings({ inverterEfficiency: 1.5 }).inverterEfficiency, 0.99);
});

test('normalizeSystemSettings: autoMode auto/manual виставляється з збіжності зі значенням', () => {
  // ККД = 0.92 (default) і не задано mode → auto
  assert.equal(normalizeSystemSettings({ inverterEfficiency: 0.92 }).inverterEfficiencyMode, 'auto');
  // ККД відрізняється від 0.92 → manual
  assert.equal(normalizeSystemSettings({ inverterEfficiency: 0.85 }).inverterEfficiencyMode, 'manual');
  // Явний mode виграє
  assert.equal(
    normalizeSystemSettings({ inverterEfficiency: 0.85, inverterEfficiencyMode: 'auto' }).inverterEfficiencyMode,
    'auto',
  );
});

test('normalizeSystemSettings: topology тільки з whitelist', () => {
  assert.equal(normalizeSystemSettings({ topology: 'unknown' }).topology, 'line-interactive');
  assert.equal(normalizeSystemSettings({ topology: 'online' }).topology, 'online');
  assert.equal(normalizeSystemSettings({ topology: 'offline' }).topology, 'offline');
});

/* ── DOD/charge rate per type ────────────────────────────────────── */

test('getDepthOfDischargeByBatteryType: відомі типи', () => {
  assert.equal(getDepthOfDischargeByBatteryType('agm'), 0.5);
  assert.equal(getDepthOfDischargeByBatteryType('gel'), 0.55);
  assert.equal(getDepthOfDischargeByBatteryType('lifepo4'), 0.8);
  assert.equal(getDepthOfDischargeByBatteryType('unknown'), 0.8); // default
});

test('getChargeRateByBatteryType: коректні коефіцієнти', () => {
  assert.equal(getChargeRateByBatteryType('agm'), 0.12);
  assert.equal(getChargeRateByBatteryType('gel'), 0.1);
  assert.equal(getChargeRateByBatteryType('lifepo4'), 0.2);
});

test('getRecommendedChargeCurrentA: округлення вгору', () => {
  // 200 * 0.2 = 40
  assert.equal(getRecommendedChargeCurrentA(200, 'lifepo4'), 40);
  // 100 * 0.12 = 12
  assert.equal(getRecommendedChargeCurrentA(100, 'agm'), 12);
  // 150 * 0.1 = 15
  assert.equal(getRecommendedChargeCurrentA(150, 'gel'), 15);
  // 0 ємність
  assert.equal(getRecommendedChargeCurrentA(0), 0);
});

/* ── Energy/autonomy primitives ──────────────────────────────────── */

test('getUsableStoredEnergyWh: енергія × ККД × DOD', () => {
  // 1000 Wh × 0.92 × 0.8 = 736 (lifepo4)
  assert.equal(getUsableStoredEnergyWh(1000, { batteryType: 'lifepo4' }), 736);
});

test('getUsableEnergyWhFromBatteryAh: формула 2.6', () => {
  // 100 Ah × 24 V × 0.92 × 0.8 = 1766.4 Wh
  const wh = getUsableEnergyWhFromBatteryAh(100, { batteryVoltage: 24, batteryType: 'lifepo4' });
  assert.equal(wh, 1766.4);
});

test('getEstimatedAutonomyHours: ділення на нуль безпечне', () => {
  assert.equal(getEstimatedAutonomyHours(1000, 0), 0);
  assert.equal(getEstimatedAutonomyHours(0, 500), 0);
});

test('getAutonomyHoursByDailyConsumption: 24h фактор', () => {
  // 2400 Wh корисних і добове 1200 Wh → середня 50 Вт → 48 годин
  assert.equal(getAutonomyHoursByDailyConsumption(2400, 1200), 48);
});

test('getDailyConsumptionWh: підсумовує power × qty × hours', () => {
  const consumers = [
    normalizeConsumer({ name: 'A', power: 100, quantity: 2, hoursPerDay: 5 }),
    normalizeConsumer({ name: 'B', power: 50, quantity: 1, hoursPerDay: 10 }),
  ];
  // 100*2*5 + 50*1*10 = 1000 + 500 = 1500
  assert.equal(getDailyConsumptionWh(consumers), 1500);
});

test('getTotalPower: множить power × quantity без коефіцієнта', () => {
  const consumers = [
    normalizeConsumer({ name: 'A', power: 100, quantity: 3, hoursPerDay: 1 }),
    normalizeConsumer({ name: 'B', power: 200, quantity: 1, hoursPerDay: 1 }),
  ];
  assert.equal(getTotalPower(consumers), 500);
});

test('getTotalPower: simultaneityFactor зменшує сумарну', () => {
  const consumers = [normalizeConsumer({ name: 'A', power: 100, quantity: 10, hoursPerDay: 1 })];
  assert.equal(getTotalPower(consumers, 0.7), 700);
});

test('getPeakScheduledLoadPower: ранжує по профілю використання', () => {
  // Два прилади з однаковим день-профілем — їхні піки складаються
  const consumers = [
    normalizeConsumer({ name: 'A', power: 100, quantity: 1, hoursPerDay: 8, usageProfile: 'day' }),
    normalizeConsumer({ name: 'B', power: 200, quantity: 1, hoursPerDay: 8, usageProfile: 'day' }),
  ];
  const peak = getPeakScheduledLoadPower(consumers);
  assert.ok(peak >= 100, 'peak повинен бути не менше за найбільший прилад');
});

/* ── Breakdowns / profiles ───────────────────────────────────────── */

test('getCategoryBreakdown: групує за категорією', () => {
  const consumers = [
    normalizeConsumer({ name: 'A', category: 'heating', power: 100, quantity: 1, hoursPerDay: 5 }),
    normalizeConsumer({ name: 'B', category: 'lighting', power: 50, quantity: 1, hoursPerDay: 4 }),
    normalizeConsumer({ name: 'C', category: 'heating', power: 100, quantity: 1, hoursPerDay: 3 }),
  ];
  const breakdown = getCategoryBreakdown(consumers);
  const heating = breakdown.find((b) => b.key === 'heating');
  assert.equal(heating.value, 800); // 100*1*5 + 100*1*3
});

test('getPriorityBreakdown: повертає 3 рядки в порядку high/medium/low', () => {
  const consumers = [
    normalizeConsumer({ name: 'A', power: 1, quantity: 1, hoursPerDay: 1, priority: 'high' }),
    normalizeConsumer({ name: 'B', power: 1, quantity: 1, hoursPerDay: 1, priority: 'high' }),
    normalizeConsumer({ name: 'C', power: 1, quantity: 1, hoursPerDay: 1, priority: 'low' }),
  ];
  const breakdown = getPriorityBreakdown(consumers);
  assert.equal(breakdown.length, 3);
  assert.equal(breakdown[0].key, 'high');
  assert.equal(breakdown[0].value, 2);
  assert.equal(breakdown[2].key, 'low');
  assert.equal(breakdown[2].value, 1);
});

test('getHourlyLoadProfile: 24 точки і коректний пік', () => {
  const consumers = [
    normalizeConsumer({ name: 'A', power: 100, quantity: 1, hoursPerDay: 24, usageProfile: 'always' }),
  ];
  const profile = getHourlyLoadProfile(consumers);
  assert.equal(profile.length, 24);
  // always-профіль розподіляє рівномірно — кожна година має схожий рівень
  assert.ok(profile.every((p) => p.value > 0));
});

/* ── Variants helpers ────────────────────────────────────────────── */

test('getWorkingItemsByVariant: повертає назви', () => {
  const consumers = buildMixedPrioritySetup();
  const names = getWorkingItemsByVariant('balance', consumers);
  assert.ok(names.includes('Котел'));
  assert.ok(names.includes('Освітлення'));
  assert.ok(names.includes('Телевізор'));
});

test('getDeferredItemsByVariant essentials: відкинуто low-priority', () => {
  const consumers = buildMixedPrioritySetup();
  const deferred = getDeferredItemsByVariant('essentials', consumers);
  assert.deepEqual(deferred, ['Телевізор']);
});

/* ── Labels ──────────────────────────────────────────────────────── */

test('getCriticalityLabel: відомі і дефолт', () => {
  assert.equal(getCriticalityLabel('high'), 'Критично');
  assert.equal(getCriticalityLabel('medium'), 'Бажано');
  assert.equal(getCriticalityLabel('low'), "Необов'язково");
  assert.equal(getCriticalityLabel('unknown'), 'Бажано');
});

test('getObjectTypeLabel/getScenarioTypeLabel/getBackupScopeLabel: дефолтні значення', () => {
  assert.equal(getObjectTypeLabel('apartment'), 'Квартира');
  assert.equal(getScenarioTypeLabel('blackout'), 'Відключення електроенергії');
  assert.equal(getBackupScopeLabel('full'), 'Майже все навантаження');
});

/* ── Top drivers narrative ───────────────────────────────────────── */

test('getTopDrivers: повертає список до 4 елементів і не падає на порожньому проєкті', () => {
  assert.deepEqual(getTopDrivers([]), []);
  const drivers = getTopDrivers(buildMixedPrioritySetup(), { targetAutonomyHours: 12 });
  assert.ok(drivers.length > 0);
  assert.ok(drivers.length <= 4);
});

/* ── End-to-end система: повний пайплайн ─────────────────────────── */

test('getSystemCalculation: повний пайплайн з 5+ приладів дає консистентний звіт', () => {
  const consumers = [
    normalizeConsumer({ name: 'Котел', power: 120, quantity: 1, hoursPerDay: 16, surgePower: 200, priority: 'high', usageProfile: 'always' }),
    normalizeConsumer({ name: 'Холодильник', power: 180, quantity: 1, hoursPerDay: 10, surgePower: 600, priority: 'high', usageProfile: 'day' }),
    normalizeConsumer({ name: 'Освітлення', power: 60, quantity: 1, hoursPerDay: 6, priority: 'medium', usageProfile: 'evening' }),
    normalizeConsumer({ name: 'Телевізор', power: 120, quantity: 1, hoursPerDay: 4, priority: 'low', usageProfile: 'evening' }),
    normalizeConsumer({ name: 'Роутер', power: 15, quantity: 1, hoursPerDay: 24, priority: 'high', usageProfile: 'always' }),
  ];

  const calc = getSystemCalculation(consumers, {
    batteryVoltage: 24, batteryType: 'lifepo4', targetAutonomyHours: 8,
  });

  // Структурні перевірки
  assert.ok(calc.recommendedInverterPower > 0, 'інвертор > 0');
  assert.ok(calc.recommendedBatteryCapacityAh > 0, 'ємність > 0');
  assert.ok(calc.recommendedBatteryConfigs.length > 0, 'є хоча б 1 конфіг АКБ');
  assert.ok(calc.recommendedBatteryConfigs.length <= 3, 'не більше 3 альтернатив');

  // Фізичні
  assert.ok(calc.totalSurgePower >= calc.designLoadPower, 'пуск не менший за робоче');
  assert.ok(calc.startupCoverageRatio > 0, 'покриття пуску > 0');
  assert.ok(calc.estimatedAutonomyHours > 0, 'автономія > 0');

  // Метаданих
  assert.equal(calc.normalizedSettings.batteryType, 'lifepo4');
  assert.equal(calc.normalizedSettings.batteryVoltage, 24);
});

test('getRecommendedBatteryVoltage: точні пороги', () => {
  // Малий: 100 Вт → 12V
  const tiny = [normalizeConsumer({ name: 'X', power: 100, quantity: 1, hoursPerDay: 6 })];
  assert.equal(getRecommendedBatteryVoltage(tiny, {}), 12);

  // Середній: 500 Вт → 24V
  const mid = [normalizeConsumer({ name: 'X', power: 500, quantity: 1, hoursPerDay: 6, usageProfile: 'day' })];
  assert.equal(getRecommendedBatteryVoltage(mid, {}), 24);

  // Великий: 3500 Вт → 48V
  const heavy = [normalizeConsumer({ name: 'X', power: 3500, quantity: 1, hoursPerDay: 8, surgePower: 5000 })];
  assert.equal(getRecommendedBatteryVoltage(heavy, {}), 48);
});

test('getRecommendedBatteryType: завжди lifepo4 за дефолтом', () => {
  assert.equal(getRecommendedBatteryType(), 'lifepo4');
});

/* ── Edge cases ──────────────────────────────────────────────────── */

test('getSystemCalculation: порожній список приладів не падає', () => {
  const calc = getSystemCalculation([], { batteryVoltage: 24, batteryType: 'lifepo4' });
  assert.equal(calc.totalPower, 0);
  assert.equal(calc.recommendedInverterPower, 0);
  assert.equal(calc.recommendedBatteryCapacityAh, 0);
});

test('getSolutionVariants: пустий проєкт повертає []', () => {
  assert.deepEqual(getSolutionVariants([]), []);
});

test('normalizeConsumer: довге ім\'я зберігається', () => {
  const longName = 'X'.repeat(200);
  const c = normalizeConsumer({ name: longName, power: 1, quantity: 1, hoursPerDay: 1 });
  assert.equal(c.name, longName);
});
