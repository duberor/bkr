import { parseLocaleNumber } from './number.js';
import { CATEGORY_LABELS } from '../data/consumer-categories.js';

const usageProfiles = {
  always: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  day: [0, 0, 0, 0, 0, 0, 0.1, 0.6, 1, 1, 1, 1, 1, 1, 1, 0.9, 0.8, 0.6, 0.2, 0, 0, 0, 0, 0],
  evening: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 1, 1, 0.9, 0.7, 0.4, 0.1],
  night: [0.8, 1, 1, 1, 1, 0.8, 0.4, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 1],
  office: [0, 0, 0, 0, 0, 0, 0.1, 0.3, 0.8, 1, 1, 1, 1, 1, 1, 1, 0.8, 0.4, 0.1, 0, 0, 0, 0, 0],
};

const standardBatteryOptions = [50, 100, 150, 200, 280];
const inverterOptions = [500, 1000, 1500, 2000, 3000, 5000, 8000, 10000];

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

export function normalizeSystemSettings(settings = {}) {
  return {
    batteryVoltage: clampNumber(settings.batteryVoltage, 12, 96, 24),
    batteryType: settings.batteryType || 'lifepo4',
    autonomyDays: clampNumber(settings.autonomyDays, 1, 30, 1),
    inverterEfficiency: clampNumber(settings.inverterEfficiency, 0.7, 0.99, 0.92),
    reserveRatio: clampNumber(settings.reserveRatio, 1, 2, 1.2),
    simultaneityFactor: clampNumber(settings.simultaneityFactor, 0.4, 1, 0.85),
    batteryReserveRatio: clampNumber(settings.batteryReserveRatio, 1, 1.8, 1.15),
  };
}

export function normalizeConsumer(raw) {
  return {
    id: raw.id || crypto.randomUUID(),
    name: String(raw.name || '').trim(),
    category: raw.category || 'other',
    zoneId: String(raw.zoneId || '').trim(),
    power: parseLocaleNumber(raw.power || 0),
    quantity: Math.max(1, Math.round(parseLocaleNumber(raw.quantity || 1, 1))),
    hoursPerDay: Number(parseLocaleNumber(raw.hoursPerDay || 0).toFixed(2)),
    surgePower: parseLocaleNumber(raw.surgePower || 0),
    priority: raw.priority || 'medium',
    usageProfile: raw.usageProfile || 'day',
    notes: String(raw.notes || '').trim(),
  };
}

export function getTotalPower(consumers = []) {
  return consumers.reduce((sum, item) => sum + Number(item.power || 0) * Number(item.quantity || 0), 0);
}

export function getTotalSurgePower(consumers = []) {
  return consumers.reduce((sum, item) => sum + Number(item.surgePower || 0) * Number(item.quantity || 0), 0);
}

export function getDailyConsumptionWh(consumers = []) {
  return Number(consumers.reduce((sum, item) => (
    sum + Number(item.power || 0) * Number(item.quantity || 0) * Number(item.hoursPerDay || 0)
  ), 0).toFixed(2));
}

export function getDepthOfDischargeByBatteryType(type = 'lifepo4') {
  switch (type) {
    case 'agm': return 0.5;
    case 'gel': return 0.55;
    case 'lifepo4':
    default: return 0.8;
  }
}

export function getChargeRateByBatteryType(type = 'lifepo4') {
  switch (type) {
    case 'agm': return 0.12;
    case 'gel': return 0.1;
    case 'lifepo4':
    default: return 0.2;
  }
}

export function getDesignLoadPower(consumers = [], settings = {}) {
  const normalized = normalizeSystemSettings(settings);
  return Number((getTotalPower(consumers) * normalized.simultaneityFactor).toFixed(2));
}

export function getRecommendedInverterPower(consumers = [], reserveRatio = 1.2, simultaneityFactor = 0.85) {
  if (!consumers.length) return 0;

  const target = Math.max(
    getTotalPower(consumers) * clampNumber(simultaneityFactor, 0.4, 1, 0.85) * clampNumber(reserveRatio, 1, 2, 1.2),
    getTotalSurgePower(consumers),
  );

  return inverterOptions.find((value) => value >= target) || Math.ceil(target / 500) * 500;
}

export function getRecommendedBatteryCapacityAh(consumers = [], settings = {}) {
  if (!consumers.length) return 0;

  const normalized = normalizeSystemSettings(settings);
  const requiredEnergyWh = getDailyConsumptionWh(consumers) * normalized.autonomyDays;
  const designEnergyWh = requiredEnergyWh * normalized.batteryReserveRatio;
  const dod = getDepthOfDischargeByBatteryType(normalized.batteryType);

  if (!normalized.batteryVoltage || !normalized.inverterEfficiency || !dod) return 0;
  return Math.ceil(designEnergyWh / (normalized.batteryVoltage * normalized.inverterEfficiency * dod));
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
    const total = Number(consumer.power || 0) * Number(consumer.quantity || 0) * Number(consumer.hoursPerDay || 0);
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
  return priorities.map((priority) => ({ label: priority, value: consumers.filter((item) => item.priority === priority).length }));
}

export function getHourlyLoadProfile(consumers = []) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour: `${String(hour).padStart(2, '0')}:00`, value: 0 }));
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

export function getConsumerPowerRows(consumers = []) {
  return consumers.map((consumer) => ({ label: consumer.name, value: Number(consumer.power || 0) * Number(consumer.quantity || 0) }));
}

export function getBatteryConfigurationOptions(consumers = [], settings = {}) {
  const normalized = normalizeSystemSettings(settings);
  const requiredAh = getRecommendedBatteryCapacityAh(consumers, normalized);
  if (!requiredAh) return [];

  const dailyConsumptionWh = getDailyConsumptionWh(consumers);
  const requiredEnergyWh = dailyConsumptionWh * normalized.autonomyDays;
  const designEnergyWh = requiredEnergyWh * normalized.batteryReserveRatio;
  const designLoadPower = getDesignLoadPower(consumers, normalized);
  const seriesCount = Math.max(1, Math.ceil(normalized.batteryVoltage / 12));

  return standardBatteryOptions.map((capacityAh) => {
    const parallelCount = Math.max(1, Math.ceil(requiredAh / capacityAh));
    const totalBatteries = seriesCount * parallelCount;
    const totalStoredWh = normalized.batteryVoltage * capacityAh * parallelCount;
    const usableStoredWh = getUsableStoredEnergyWh(totalStoredWh, normalized);
    const autonomyHours = getAutonomyHoursByDailyConsumption(usableStoredWh, dailyConsumptionWh);
    const continuousAutonomyHours = getEstimatedAutonomyHours(usableStoredWh, designLoadPower);

    return {
      label: `${seriesCount}S × ${parallelCount}P · модулі ${capacityAh} Ah`,
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
      fitScore: Math.abs((capacityAh * parallelCount) - requiredAh),
      targetCoverageRatio: requiredEnergyWh > 0 ? Number((usableStoredWh / requiredEnergyWh).toFixed(2)) : 0,
      reserveCoverageRatio: designEnergyWh > 0 ? Number((usableStoredWh / designEnergyWh).toFixed(2)) : 0,
    };
  }).sort((a, b) => a.fitScore - b.fitScore).slice(0, 3);
}

export function getSystemCalculation(consumers = [], settings = {}) {
  const normalizedSettings = normalizeSystemSettings(settings);
  const totalPower = getTotalPower(consumers);
  const totalSurgePower = getTotalSurgePower(consumers);
  const designLoadPower = getDesignLoadPower(consumers, normalizedSettings);
  const dailyConsumptionWh = getDailyConsumptionWh(consumers);
  const requiredEnergyWh = Number((dailyConsumptionWh * normalizedSettings.autonomyDays).toFixed(2));
  const totalEnergyWh = Number((requiredEnergyWh * normalizedSettings.batteryReserveRatio).toFixed(2));
  const depthOfDischarge = getDepthOfDischargeByBatteryType(normalizedSettings.batteryType);

  const recommendedInverterPower = getRecommendedInverterPower(
    consumers,
    normalizedSettings.reserveRatio,
    normalizedSettings.simultaneityFactor,
  );

  const recommendedBatteryCapacityAh = getRecommendedBatteryCapacityAh(consumers, normalizedSettings);
  const usableBatteryEnergyWh = getUsableEnergyWhFromBatteryAh(recommendedBatteryCapacityAh, normalizedSettings);
  const recommendedBatteryConfigs = getBatteryConfigurationOptions(consumers, normalizedSettings);
  const bestConfig = recommendedBatteryConfigs[0] || null;
  const bestUsableEnergyWh = Number(bestConfig?.usableStoredWh || usableBatteryEnergyWh || 0);

  const criticalPower = consumers
    .filter((item) => item.priority === 'high')
    .reduce((sum, item) => sum + Number(item.power || 0) * Number(item.quantity || 0), 0);

  const estimatedAutonomyHours = getAutonomyHoursByDailyConsumption(bestUsableEnergyWh, dailyConsumptionWh);
  const continuousAutonomyHours = getEstimatedAutonomyHours(bestUsableEnergyWh, designLoadPower);
  const criticalAutonomyHours = getEstimatedAutonomyHours(bestUsableEnergyWh, criticalPower);
  const inverterHeadroomW = Math.max(0, Number(recommendedInverterPower || 0) - Number(totalSurgePower || 0));
  const inverterHeadroomPercent = recommendedInverterPower > 0
    ? Number((inverterHeadroomW / recommendedInverterPower).toFixed(2))
    : 0;
  const recommendedChargeCurrentA = getRecommendedChargeCurrentA(recommendedBatteryCapacityAh, normalizedSettings.batteryType);
  const targetAutonomyHours = normalizedSettings.autonomyDays * 24;
  const autonomyCoverageRatio = requiredEnergyWh > 0 ? Number((bestUsableEnergyWh / requiredEnergyWh).toFixed(2)) : 0;
  const reserveCoverageRatio = totalEnergyWh > 0 ? Number((bestUsableEnergyWh / totalEnergyWh).toFixed(2)) : 0;

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
    recommendedChargeCurrentA,
    targetAutonomyHours,
    autonomyCoverageRatio,
    reserveCoverageRatio,
    simultaneityFactor: normalizedSettings.simultaneityFactor,
    batteryReserveRatio: normalizedSettings.batteryReserveRatio,
    normalizedSettings,
  };
}

export { parseLocaleNumber };
