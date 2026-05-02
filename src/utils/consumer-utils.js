import { parseLocaleNumber } from './number.js';
import { CATEGORY_LABELS } from '../data/consumer-categories.js';
import { formatAutonomy, formatEnergyWh, formatPower } from './format.js';

const usageProfiles = {
  always: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  day: [0, 0, 0, 0, 0, 0, 0.1, 0.6, 1, 1, 1, 1, 1, 1, 1, 0.9, 0.8, 0.6, 0.2, 0, 0, 0, 0, 0],
  evening: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 1, 1, 0.9, 0.7, 0.4, 0.1,
  ],
  night: [0.8, 1, 1, 1, 1, 0.8, 0.4, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 1],
  office: [0, 0, 0, 0, 0, 0, 0.1, 0.3, 0.8, 1, 1, 1, 1, 1, 1, 1, 0.8, 0.4, 0.1, 0, 0, 0, 0, 0],
};

const standardBatteryOptions = [50, 100, 150, 200, 280];
const inverterOptions = [500, 1000, 1500, 2000, 3000, 5000, 8000, 10000];
const DEFAULT_TARGET_AUTONOMY_HOURS = 24;
const DEFAULT_AUTONOMY_INPUT_UNIT = 'days';
export const PRIORITY_LABELS = {
  high: 'Критично',
  medium: 'Бажано',
  low: "Необов'язково",
};
export const OBJECT_TYPE_LABELS = {
  apartment: 'Квартира',
  house: 'Приватний будинок',
  office: 'Офіс',
  boiler_room: 'Котельня',
  other: 'Інший обʼєкт',
};
export const SCENARIO_TYPE_LABELS = {
  custom: 'Свій сценарій',
  blackout: 'Відключення електроенергії',
  heating: 'Опалення і насоси',
  home_office: 'Домашня робота',
  connectivity: 'Звʼязок і базові прилади',
};
export const BACKUP_SCOPE_LABELS = {
  critical: 'Лише найважливіше',
  comfort: 'Комфортний мінімум',
  full: 'Майже все навантаження',
};

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeSelectionMode(value, fallback = 'auto') {
  if (value === 'manual') return 'manual';
  if (value === 'auto') return 'auto';
  return fallback;
}

function normalizeAutonomyInputUnit(value, fallback = DEFAULT_AUTONOMY_INPUT_UNIT) {
  return ['hours', 'days'].includes(value) ? value : fallback;
}

function sortByEnergyDesc(consumers = []) {
  return [...consumers].sort((a, b) => {
    const energyA = Number(a.power || 0) * Number(a.quantity || 0) * Number(a.hoursPerDay || 0);
    const energyB = Number(b.power || 0) * Number(b.quantity || 0) * Number(b.hoursPerDay || 0);
    return energyB - energyA;
  });
}

function getConsumerNames(consumers = []) {
  return [
    ...new Set(consumers.map((consumer) => String(consumer?.name || '').trim()).filter(Boolean)),
  ];
}

function buildVariantConsumers(consumers = [], variantKey = 'balance') {
  const critical = consumers.filter((item) => item.priority === 'high');
  const important = consumers.filter((item) => item.priority !== 'low');

  if (variantKey === 'economy') {
    if (critical.length) return critical;
    if (important.length) return important;
    return consumers;
  }

  if (variantKey === 'reliability') {
    return consumers;
  }

  return important.length ? important : consumers;
}

function buildVariantSettings(settings = {}, variantKey = 'balance') {
  const normalized = normalizeSystemSettings(settings);

  if (variantKey === 'economy') {
    return {
      ...normalized,
      reserveRatio: Math.max(1.1, normalized.reserveRatio - 0.05),
      batteryReserveRatio: Math.max(1.05, normalized.batteryReserveRatio - 0.05),
    };
  }

  if (variantKey === 'reliability') {
    return {
      ...normalized,
      reserveRatio: clampNumber(normalized.reserveRatio + 0.1, 1, 2, normalized.reserveRatio),
      batteryReserveRatio: clampNumber(
        normalized.batteryReserveRatio + 0.05,
        1,
        1.8,
        normalized.batteryReserveRatio,
      ),
    };
  }

  return normalized;
}

export function normalizeSystemSettings(settings = {}) {
  const legacyAutonomyDays = Number(settings?.autonomyDays);
  const fallbackHours = Number.isFinite(legacyAutonomyDays)
    ? legacyAutonomyDays * 24
    : DEFAULT_TARGET_AUTONOMY_HOURS;
  const targetAutonomyHours = clampNumber(settings.targetAutonomyHours, 1, 720, fallbackHours);
  const autonomyInputUnit = normalizeAutonomyInputUnit(
    settings.autonomyInputUnit,
    Number.isFinite(legacyAutonomyDays) ||
      (targetAutonomyHours >= 24 && targetAutonomyHours % 24 === 0)
      ? 'days'
      : 'hours',
  );
  const normalizedBatteryVoltage = clampNumber(settings.batteryVoltage, 12, 96, 24);
  const batteryVoltageMode = normalizeSelectionMode(
    settings.batteryVoltageMode,
    Number(normalizedBatteryVoltage) !== 24 ? 'manual' : 'auto',
  );
  const batteryTypeValue = settings.batteryType || 'lifepo4';
  const batteryTypeMode = normalizeSelectionMode(
    settings.batteryTypeMode,
    batteryTypeValue !== 'lifepo4' ? 'manual' : 'auto',
  );

  return {
    batteryVoltage: normalizedBatteryVoltage,
    batteryVoltageMode,
    batteryType: batteryTypeValue,
    batteryTypeMode,
    targetAutonomyHours,
    autonomyInputUnit,
    inverterEfficiency: clampNumber(settings.inverterEfficiency, 0.7, 0.99, 0.92),
    reserveRatio: clampNumber(settings.reserveRatio, 1, 2, 1.2),
    batteryReserveRatio: clampNumber(settings.batteryReserveRatio, 1, 1.8, 1.15),
  };
}

export function getCriticalityLabel(priority = 'medium') {
  return PRIORITY_LABELS[priority] || PRIORITY_LABELS.medium;
}

export function getObjectTypeLabel(value = 'apartment') {
  return OBJECT_TYPE_LABELS[value] || OBJECT_TYPE_LABELS.other;
}

export function getScenarioTypeLabel(value = 'custom') {
  return SCENARIO_TYPE_LABELS[value] || SCENARIO_TYPE_LABELS.custom;
}

export function getBackupScopeLabel(value = 'critical') {
  return BACKUP_SCOPE_LABELS[value] || BACKUP_SCOPE_LABELS.critical;
}

export function normalizeConsumer(raw) {
  const power = parseLocaleNumber(raw.power || 0);
  const quantity = Math.max(1, Math.round(parseLocaleNumber(raw.quantity || 1, 1)));
  const surgePower = parseLocaleNumber(raw.surgePower || power || 0, power || 0);

  return {
    id: raw.id || crypto.randomUUID(),
    name: String(raw.name || '').trim(),
    category: raw.category || 'other',
    zoneId: String(raw.zoneId || '').trim(),
    power,
    quantity,
    hoursPerDay: Number(parseLocaleNumber(raw.hoursPerDay || 0).toFixed(2)),
    surgePower: Math.max(surgePower, power),
    priority: raw.priority || 'medium',
    usageProfile: raw.usageProfile || 'day',
    notes: String(raw.notes || '').trim(),
  };
}

export function getTotalPower(consumers = []) {
  return consumers.reduce(
    (sum, item) => sum + Number(item.power || 0) * Number(item.quantity || 0),
    0,
  );
}

export function getTotalSurgePower(consumers = []) {
  const designLoadPower = getDesignLoadPower(consumers);
  const additionalStartupDelta = consumers.reduce((max, item) => {
    const power = Number(item.power || 0);
    const surge = Number(item.surgePower || power);
    const quantity = Number(item.quantity || 0);
    return Math.max(max, Math.max(0, (surge - power) * quantity));
  }, 0);

  return Number((designLoadPower + additionalStartupDelta).toFixed(2));
}

export function getDailyConsumptionWh(consumers = []) {
  return Number(
    consumers
      .reduce(
        (sum, item) =>
          sum +
          Number(item.power || 0) * Number(item.quantity || 0) * Number(item.hoursPerDay || 0),
        0,
      )
      .toFixed(2),
  );
}

export function getDepthOfDischargeByBatteryType(type = 'lifepo4') {
  switch (type) {
    case 'agm':
      return 0.5;
    case 'gel':
      return 0.55;
    case 'lifepo4':
    default:
      return 0.8;
  }
}

export function getChargeRateByBatteryType(type = 'lifepo4') {
  switch (type) {
    case 'agm':
      return 0.12;
    case 'gel':
      return 0.1;
    case 'lifepo4':
    default:
      return 0.2;
  }
}

export function getDesignLoadPower(consumers = [], settings = {}) {
  return getPeakScheduledLoadPower(consumers);
}

export function getRecommendedInverterPower(consumers = [], reserveRatio = 1.2) {
  if (!consumers.length) return 0;

  const designLoadPower = getDesignLoadPower(consumers);
  const startupPeakPower = getTotalSurgePower(consumers);
  const target = Math.max(designLoadPower * clampNumber(reserveRatio, 1, 2, 1.2), startupPeakPower);

  return inverterOptions.find((value) => value >= target) || Math.ceil(target / 500) * 500;
}

export function getRecommendedBatteryCapacityAh(consumers = [], settings = {}) {
  if (!consumers.length) return 0;

  const normalized = normalizeSystemSettings(settings);
  const requiredEnergyWh = getDailyConsumptionWh(consumers) * (normalized.targetAutonomyHours / 24);
  const designEnergyWh = requiredEnergyWh * normalized.batteryReserveRatio;
  const dod = getDepthOfDischargeByBatteryType(normalized.batteryType);

  if (!normalized.batteryVoltage || !normalized.inverterEfficiency || !dod) return 0;
  return Math.ceil(
    designEnergyWh / (normalized.batteryVoltage * normalized.inverterEfficiency * dod),
  );
}

export function getUsableStoredEnergyWh(totalStoredWh, settings = {}) {
  const normalized = normalizeSystemSettings(settings);
  const dod = getDepthOfDischargeByBatteryType(normalized.batteryType);
  return Number((Number(totalStoredWh || 0) * normalized.inverterEfficiency * dod).toFixed(2));
}

export function getUsableEnergyWhFromBatteryAh(capacityAh, settings = {}) {
  const normalized = normalizeSystemSettings(settings);
  const totalStoredWh = Number(capacityAh || 0) * normalized.batteryVoltage;
  return getUsableStoredEnergyWh(totalStoredWh, normalized);
}

export function getEstimatedAutonomyHours(usableEnergyWh = 0, loadPower = 0) {
  if (!usableEnergyWh || !loadPower) return 0;
  return Number((usableEnergyWh / Math.max(loadPower, 1)).toFixed(2));
}

export function getAutonomyHoursByDailyConsumption(usableEnergyWh = 0, dailyConsumptionWh = 0) {
  if (!usableEnergyWh || !dailyConsumptionWh) return 0;
  const averageLoadPower = Number(dailyConsumptionWh || 0) / 24;
  return getEstimatedAutonomyHours(usableEnergyWh, averageLoadPower);
}

export function getRecommendedChargeCurrentA(capacityAh = 0, batteryType = 'lifepo4') {
  if (!capacityAh) return 0;
  const rate = getChargeRateByBatteryType(batteryType);
  return Math.ceil(Number(capacityAh || 0) * rate);
}

export function getCategoryBreakdown(consumers = []) {
  const map = new Map();
  consumers.forEach((consumer) => {
    const category = consumer.category || 'other';
    const total =
      Number(consumer.power || 0) *
      Number(consumer.quantity || 0) *
      Number(consumer.hoursPerDay || 0);
    map.set(category, (map.get(category) || 0) + total);
  });
  return [...map.entries()].map(([category, value]) => ({
    key: category,
    label: CATEGORY_LABELS[category] || category,
    value: Number(value.toFixed(2)),
  }));
}

export function getPriorityBreakdown(consumers = []) {
  const priorities = ['high', 'medium', 'low'];
  return priorities.map((priority) => ({
    key: priority,
    label: getCriticalityLabel(priority),
    value: consumers.filter((item) => item.priority === priority).length,
  }));
}

export function getHourlyLoadProfile(consumers = []) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    value: 0,
  }));
  consumers.forEach((consumer) => {
    const totalPower = Number(consumer.power || 0) * Number(consumer.quantity || 0);
    const hoursPerDay = Number(consumer.hoursPerDay || 0);
    const profile = usageProfiles[consumer.usageProfile || 'day'] || usageProfiles.day;
    const activeWeights = profile.reduce((sum, item) => sum + item, 0) || 1;
    const normalizedWeights = profile.map((item) => item / activeWeights);
    hours.forEach((entry, index) => {
      entry.value += totalPower * Math.min(1, hoursPerDay / 24) * normalizedWeights[index] * 24;
    });
  });
  return hours.map((entry) => ({ ...entry, value: Number(entry.value.toFixed(2)) }));
}

export function getPeakScheduledLoadPower(consumers = []) {
  const hourlyLoads = Array.from({ length: 24 }, () => 0);

  consumers.forEach((consumer) => {
    const totalPower = Number(consumer.power || 0) * Number(consumer.quantity || 0);
    let remainingHours = clampNumber(consumer.hoursPerDay, 0, 24, 0);
    if (!totalPower || !remainingHours) return;

    const profile = usageProfiles[consumer.usageProfile || 'day'] || usageProfiles.day;
    const rankedHours = profile
      .map((weight, index) => ({ weight, index }))
      .filter((entry) => entry.weight > 0)
      .sort((a, b) => b.weight - a.weight || a.index - b.index);

    if (!rankedHours.length) return;

    rankedHours.forEach(({ index }) => {
      if (remainingHours <= 0) return;
      const hourSlice = Math.min(1, remainingHours);
      hourlyLoads[index] += totalPower * hourSlice;
      remainingHours -= hourSlice;
    });
  });

  return Number(Math.max(...hourlyLoads, 0).toFixed(2));
}

export function getConsumerPowerRows(consumers = []) {
  return consumers.map((consumer) => ({
    label: consumer.name,
    value: Number(consumer.power || 0) * Number(consumer.quantity || 0),
  }));
}

export function getProjectSummary(consumers = [], settings = {}) {
  const calc = getSystemCalculation(consumers, settings);

  return {
    consumerCount: consumers.length,
    totalPower: calc.totalPower,
    designLoadPower: calc.designLoadPower,
    peakPower: calc.totalSurgePower,
    dailyConsumptionWh: calc.dailyConsumptionWh,
    targetAutonomyHours: calc.targetAutonomyHours,
    estimatedAutonomyHours: calc.estimatedAutonomyHours,
    recommendedInverterPower: calc.recommendedInverterPower,
    recommendedBatteryCapacityAh: calc.recommendedBatteryCapacityAh,
  };
}

export function getScenarioSummary(consumers = [], settings = {}) {
  return getProjectSummary(consumers, settings);
}

export function getWorkingItemsByVariant(variantKey = 'balance', consumers = []) {
  return getConsumerNames(buildVariantConsumers(consumers, variantKey));
}

export function getDeferredItemsByVariant(variantKey = 'balance', consumers = []) {
  const activeIds = new Set(buildVariantConsumers(consumers, variantKey).map((item) => item.id));
  return getConsumerNames(consumers.filter((item) => !activeIds.has(item.id)));
}

export function getSolutionVariants(consumers = [], settings = {}) {
  if (!consumers.length) return [];

  const variantMeta = [
    {
      key: 'economy',
      title: 'Економ',
      audience: 'Для базового резерву найважливішого.',
      description: 'Мінімально достатній варіант для критичних приладів і нижчого бюджету.',
    },
    {
      key: 'balance',
      title: 'Баланс',
      audience: 'Оптимальний варіант для більшості сценаріїв.',
      description: 'Покриває критичні та бажані прилади без відчуття, що система працює на межі.',
      isRecommended: true,
    },
    {
      key: 'reliability',
      title: 'Надійність',
      audience: 'Для більшого запасу й меншої кількості компромісів.',
      description: 'Варіант із більшим запасом потужності та енергії для складніших сценаріїв.',
    },
  ];

  const variants = variantMeta.map((variant) => {
    const variantConsumers = buildVariantConsumers(consumers, variant.key);
    const variantSettings = buildVariantSettings(settings, variant.key);
    const calc = getSystemCalculation(variantConsumers, variantSettings);

    return {
      ...variant,
      consumers: variantConsumers,
      calc,
      activeItems: getConsumerNames(variantConsumers),
      deferredItems: getDeferredItemsByVariant(variant.key, consumers),
    };
  });

  const deduped = [];
  const seen = new Set();

  variants.forEach((variant) => {
    const signature = [
      variant.consumers
        .map((consumer) => consumer.id)
        .sort()
        .join('|'),
      variant.calc.recommendedInverterPower,
      variant.calc.recommendedBatteryCapacityAh,
      Number(variant.calc.normalizedSettings?.reserveRatio || 0).toFixed(2),
      Number(variant.calc.normalizedSettings?.batteryReserveRatio || 0).toFixed(2),
    ].join('::');

    if (seen.has(signature)) return;
    seen.add(signature);
    deduped.push(variant);
  });

  return deduped;
}

export function getTopDrivers(consumers = [], settings = {}) {
  if (!consumers.length) return [];

  const calc = getSystemCalculation(consumers, settings);
  const topEnergyConsumers = sortByEnergyDesc(consumers).slice(0, 2);
  const topStartupConsumer = [...consumers].sort((a, b) => {
    const deltaA = Math.max(0, Number(a.surgePower || 0) - Number(a.power || 0));
    const deltaB = Math.max(0, Number(b.surgePower || 0) - Number(b.power || 0));
    return deltaB - deltaA;
  })[0];

  const drivers = [
    `Бажаний час роботи: ${formatAutonomy(calc.targetAutonomyHours, { preferDays: calc.targetAutonomyHours >= 24 })}.`,
  ];

  topEnergyConsumers.forEach((consumer) => {
    const dailyEnergyWh =
      Number(consumer.power || 0) *
      Number(consumer.quantity || 0) *
      Number(consumer.hoursPerDay || 0);
    drivers.push(`${consumer.name} додає приблизно ${formatEnergyWh(dailyEnergyWh)} на добу.`);
  });

  const startupDelta = Math.max(
    0,
    Number(topStartupConsumer?.surgePower || 0) - Number(topStartupConsumer?.power || 0),
  );
  if (topStartupConsumer?.name && startupDelta > 0) {
    drivers.push(
      `${topStartupConsumer.name} формує відчутний стартовий пік до ${formatPower(topStartupConsumer.surgePower)}.`,
    );
  } else {
    drivers.push(
      `Сумарне навантаження, під яке підбираємо систему, становить ${formatPower(calc.designLoadPower)}.`,
    );
  }

  return drivers.slice(0, 4);
}

export function getBatteryConfigurationOptions(consumers = [], settings = {}) {
  const normalized = normalizeSystemSettings(settings);
  const requiredAh = getRecommendedBatteryCapacityAh(consumers, normalized);
  if (!requiredAh) return [];

  const dailyConsumptionWh = getDailyConsumptionWh(consumers);
  const requiredEnergyWh = dailyConsumptionWh * (normalized.targetAutonomyHours / 24);
  const designEnergyWh = requiredEnergyWh * normalized.batteryReserveRatio;
  const designLoadPower = getDesignLoadPower(consumers, normalized);
  const seriesCount = Math.max(1, Math.ceil(normalized.batteryVoltage / 12));

  return standardBatteryOptions
    .map((capacityAh) => {
      const parallelCount = Math.max(1, Math.ceil(requiredAh / capacityAh));
      const totalBatteries = seriesCount * parallelCount;
      const totalStoredWh = normalized.batteryVoltage * capacityAh * parallelCount;
      const usableStoredWh = getUsableStoredEnergyWh(totalStoredWh, normalized);
      const autonomyHours = getAutonomyHoursByDailyConsumption(usableStoredWh, dailyConsumptionWh);
      const continuousAutonomyHours = getEstimatedAutonomyHours(usableStoredWh, designLoadPower);

      return {
        label: `Модулі ${capacityAh} Ah · ${seriesCount} послідовно × ${parallelCount} паралельно`,
        moduleVoltage: 12,
        moduleCapacityAh: capacityAh,
        seriesCount,
        parallelCount,
        totalBatteries,
        bankVoltage: normalized.batteryVoltage,
        bankCapacityAh: capacityAh * parallelCount,
        totalStoredWh,
        usableStoredWh,
        autonomyHours,
        continuousAutonomyHours,
        fitScore: Math.abs(capacityAh * parallelCount - requiredAh),
        targetCoverageRatio:
          requiredEnergyWh > 0 ? Number((usableStoredWh / requiredEnergyWh).toFixed(2)) : 0,
        reserveCoverageRatio:
          designEnergyWh > 0 ? Number((usableStoredWh / designEnergyWh).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => a.fitScore - b.fitScore)
    .slice(0, 3);
}

export function getSystemCalculation(consumers = [], settings = {}) {
  const normalizedSettings = normalizeSystemSettings(settings);
  const totalPower = getTotalPower(consumers);
  const totalSurgePower = getTotalSurgePower(consumers);
  const designLoadPower = getDesignLoadPower(consumers, normalizedSettings);
  const dailyConsumptionWh = getDailyConsumptionWh(consumers);
  const requiredEnergyWh = Number(
    (dailyConsumptionWh * (normalizedSettings.targetAutonomyHours / 24)).toFixed(2),
  );
  const totalEnergyWh = Number(
    (requiredEnergyWh * normalizedSettings.batteryReserveRatio).toFixed(2),
  );
  const depthOfDischarge = getDepthOfDischargeByBatteryType(normalizedSettings.batteryType);

  const recommendedInverterPower = getRecommendedInverterPower(
    consumers,
    normalizedSettings.reserveRatio,
  );

  const recommendedBatteryCapacityAh = getRecommendedBatteryCapacityAh(
    consumers,
    normalizedSettings,
  );
  const usableBatteryEnergyWh = getUsableEnergyWhFromBatteryAh(
    recommendedBatteryCapacityAh,
    normalizedSettings,
  );
  const recommendedBatteryConfigs = getBatteryConfigurationOptions(consumers, normalizedSettings);
  const bestConfig = recommendedBatteryConfigs[0] || null;
  const bestUsableEnergyWh = Number(bestConfig?.usableStoredWh || usableBatteryEnergyWh || 0);

  const criticalPower = consumers
    .filter((item) => item.priority === 'high')
    .reduce((sum, item) => sum + Number(item.power || 0) * Number(item.quantity || 0), 0);

  // Добове споживання тільки критичних — враховує реальний графік роботи (як estimatedAutonomyHours)
  const criticalDailyWh = getDailyConsumptionWh(
    consumers.filter((item) => item.priority === 'high'),
  );

  const estimatedAutonomyHours = getAutonomyHoursByDailyConsumption(
    bestUsableEnergyWh,
    dailyConsumptionWh,
  );
  const continuousAutonomyHours = getEstimatedAutonomyHours(bestUsableEnergyWh, designLoadPower);
  // Виправлено: раніше ділило на пікову потужність (24/7), тепер через добове споживання
  const criticalAutonomyHours = getAutonomyHoursByDailyConsumption(bestUsableEnergyWh, criticalDailyWh);
  const inverterHeadroomW = Math.max(
    0,
    Number(recommendedInverterPower || 0) - Number(designLoadPower || 0),
  );
  const inverterHeadroomPercent =
    recommendedInverterPower > 0
      ? Number((inverterHeadroomW / recommendedInverterPower).toFixed(2))
      : 0;
  const startupHeadroomW = Math.max(
    0,
    Number(recommendedInverterPower || 0) - Number(totalSurgePower || 0),
  );
  const startupCoverageRatio =
    totalSurgePower > 0
      ? Number((Number(recommendedInverterPower || 0) / Number(totalSurgePower || 0)).toFixed(2))
      : 1;
  const recommendedChargeCurrentA = getRecommendedChargeCurrentA(
    recommendedBatteryCapacityAh,
    normalizedSettings.batteryType,
  );
  const targetAutonomyHours = normalizedSettings.targetAutonomyHours;
  const autonomyCoverageRatio =
    requiredEnergyWh > 0 ? Number((bestUsableEnergyWh / requiredEnergyWh).toFixed(2)) : 0;
  const reserveCoverageRatio =
    totalEnergyWh > 0 ? Number((bestUsableEnergyWh / totalEnergyWh).toFixed(2)) : 0;

  return {
    totalPower,
    designLoadPower,
    totalSurgePower,
    dailyConsumptionWh,
    requiredEnergyWh,
    totalEnergyWh,
    recommendedInverterPower,
    recommendedBatteryCapacityAh,
    depthOfDischarge,
    recommendedBatteryConfigs,
    usableBatteryEnergyWh,
    bestUsableEnergyWh,
    estimatedAutonomyHours,
    continuousAutonomyHours,
    criticalPower,
    criticalAutonomyHours,
    inverterHeadroomW,
    inverterHeadroomPercent,
    startupHeadroomW,
    startupCoverageRatio,
    recommendedChargeCurrentA,
    targetAutonomyHours,
    autonomyCoverageRatio,
    reserveCoverageRatio,
    batteryReserveRatio: normalizedSettings.batteryReserveRatio,
    normalizedSettings,
  };
}

export function getRecommendedBatteryVoltage(consumers = [], settings = {}) {
  const normalizedSettings = normalizeSystemSettings(settings);
  if (!consumers.length) return normalizedSettings.batteryVoltage || 24;

  const calc = getSystemCalculation(consumers, normalizedSettings);
  const recommendedInverterPower = Number(calc.recommendedInverterPower || 0);
  const designLoadPower = Number(calc.designLoadPower || 0);
  const totalPower = Number(calc.totalPower || 0);

  if (recommendedInverterPower <= 500 && designLoadPower <= 400) {
    return 12;
  }

  if (recommendedInverterPower >= 3000 || designLoadPower >= 2500 || totalPower >= 3000) {
    return 48;
  }

  return 24;
}

export function getRecommendedBatteryType() {
  return 'lifepo4';
}

export { parseLocaleNumber };
