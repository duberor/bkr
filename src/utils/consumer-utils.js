import { parseLocaleNumber } from './number.js';
import { generateId } from './id.js';
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
const inverterOptions = [500, 1000, 1500, 2000, 3000, 5000, 6000, 8000, 10000];
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

const TOPOLOGY_TUNING = {
  offline: {
    inverterReserveDelta: 0.1,
    batteryReserveDelta: 0.05,
    efficiencyPenalty: 0,
  },
  'line-interactive': {
    inverterReserveDelta: 0,
    batteryReserveDelta: 0,
    efficiencyPenalty: 0,
  },
  online: {
    inverterReserveDelta: 0,
    batteryReserveDelta: 0.03,
    efficiencyPenalty: 0.03,
  },
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
  if (variantKey === 'essentials') {
    return consumers.filter((item) => item.priority !== 'low');
  }
  return consumers;
}

function buildVariantSettings(settings = {}, variantKey = 'balance') {
  const normalized = normalizeSystemSettings(settings);

  if (variantKey === 'essentials') {
    return {
      ...normalized,
      reserveRatio: 1.0,
      batteryReserveRatio: 1.0,
    };
  }

  if (variantKey === 'economy') {
    return {
      ...normalized,
      targetAutonomyHours: clampNumber(
        normalized.targetAutonomyHours * 0.7,
        1,
        720,
        normalized.targetAutonomyHours,
      ),
      reserveRatio: 1.0,
      batteryReserveRatio: 1.0,
    };
  }

  if (variantKey === 'balance') {
    return {
      ...normalized,
      reserveRatio: 1.0,
      batteryReserveRatio: 1.0,
    };
  }

  if (variantKey === 'reliability') {
    return {
      ...normalized,
      targetAutonomyHours: clampNumber(
        normalized.targetAutonomyHours * 1.2,
        1,
        720,
        normalized.targetAutonomyHours,
      ),
      reserveRatio: clampNumber(normalized.reserveRatio + 0.1, 1, 2, normalized.reserveRatio),
      batteryReserveRatio: clampNumber(
        normalized.batteryReserveRatio + 0.05,
        1,
        1.8,
        1.15,
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
  const topology = ['offline', 'line-interactive', 'online'].includes(settings?.topology)
    ? settings.topology
    : 'line-interactive';
  const inverterEfficiencyValue = clampNumber(settings.inverterEfficiency, 0.7, 0.99, 0.92);
  const inverterEfficiencyMode = normalizeSelectionMode(
    settings.inverterEfficiencyMode,
    Math.abs(inverterEfficiencyValue - 0.92) > 1e-9 ? 'manual' : 'auto',
  );
  const reserveRatioValue = clampNumber(settings.reserveRatio, 1, 2, 1.2);
  const reserveRatioMode = normalizeSelectionMode(
    settings.reserveRatioMode,
    Math.abs(reserveRatioValue - 1.2) > 1e-9 ? 'manual' : 'auto',
  );
  const batteryReserveRatioValue = clampNumber(settings.batteryReserveRatio, 1, 1.8, 1.15);
  const batteryReserveRatioMode = normalizeSelectionMode(
    settings.batteryReserveRatioMode,
    Math.abs(batteryReserveRatioValue - 1.15) > 1e-9 ? 'manual' : 'auto',
  );

  return {
    batteryVoltage: normalizedBatteryVoltage,
    batteryVoltageMode,
    batteryType: batteryTypeValue,
    batteryTypeMode,
    targetAutonomyHours,
    autonomyInputUnit,
    inverterEfficiency: inverterEfficiencyValue,
    inverterEfficiencyMode,
    reserveRatio: reserveRatioValue,
    reserveRatioMode,
    batteryReserveRatio: batteryReserveRatioValue,
    batteryReserveRatioMode,
    selectedBatteryConfigIndex: Math.max(0, Math.floor(Number(settings.selectedBatteryConfigIndex || 0))),
    topology,
  };
}

function getEffectiveSizingSettings(settings = {}) {
  const normalized = normalizeSystemSettings(settings);
  const topology = normalized.topology || 'line-interactive';
  const tuning = TOPOLOGY_TUNING[topology] || TOPOLOGY_TUNING['line-interactive'];

  const effectiveTargetAutonomyHours = normalized.targetAutonomyHours;

  const effectiveReserveRatio = clampNumber(
    normalized.reserveRatio + tuning.inverterReserveDelta,
    1,
    2,
    normalized.reserveRatio,
  );

  const effectiveBatteryReserveRatio = clampNumber(
    normalized.batteryReserveRatio + tuning.batteryReserveDelta,
    1,
    1.8,
    normalized.batteryReserveRatio,
  );

  const effectiveInverterEfficiency = clampNumber(
    normalized.inverterEfficiency - tuning.efficiencyPenalty,
    0.7,
    0.99,
    normalized.inverterEfficiency,
  );

  return {
    ...normalized,
    effectiveTargetAutonomyHours,
    effectiveReserveRatio,
    effectiveBatteryReserveRatio,
    effectiveInverterEfficiency,
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
  const power = Math.max(0, parseLocaleNumber(raw.power || 0));
  const quantity = Math.max(1, Math.round(parseLocaleNumber(raw.quantity || 1, 1)));
  const surgePower = Math.max(parseLocaleNumber(raw.surgePower || power || 0, power || 0), power);
  const hoursPerDay = clampNumber(parseLocaleNumber(raw.hoursPerDay || 0), 0, 24, 0);

  return {
    id: raw.id || generateId(),
    name: String(raw.name || '').trim(),
    category: raw.category || 'other',
    zoneId: String(raw.zoneId || '').trim(),
    power,
    quantity,
    hoursPerDay: Number(hoursPerDay.toFixed(2)),
    surgePower,
    priority: raw.priority || 'medium',
    usageProfile: raw.usageProfile || 'day',
    notes: String(raw.notes || '').trim(),
  };
}

/**
 * Формула 2.1 — Сумарна розрахункова потужність навантаження
 * P_Σ = Ko · Σ(Pi · ni) [Вт]
 *
 * Ko — коефіцієнт одночасності (для побутових систем Ko = 1.0)
 * Pi — номінальна потужність i-го споживача, Вт
 * ni — кількість одиниць i-го споживача
 *
 * @param {Array} consumers — масив споживачів
 * @param {number} simultaneityFactor — коефіцієнт одночасності Ko (0.6–1.0, default 1.0)
 */
export function getTotalPower(consumers = [], simultaneityFactor = 1.0) {
  return consumers.reduce(
    (sum, item) => sum + Number(item.power || 0) * Number(item.quantity || 0),
    0,
  ) * simultaneityFactor;
}

/**
 * Формула 2.5а — Пускова потужність системи
 * P_пуск = P_розр + max_i{(Pi_пуск − Pi) · ni} [Вт]
 *
 * При одночасній роботі всіх приладів найгірший сценарій —
 * запуск одного індуктивного навантаження з найбільшою дельтою пуску.
 */
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

/**
 * Формула 2.2 — Добове енергоспоживання
 * W_доб = Σ(Pi · ni · ti) [Вт·год]
 *
 * Pi — потужність, ni — кількість, ti — годин роботи на добу
 */
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

/**
 * Формула 2.5 — Розрахункова потужність інвертора
 * P_інв = max(P_розр · K_з_інв, P_пуск) [Вт]
 *
 * P_розр — пікове навантаження за добовим профілем (формула 2.1а)
 * K_з_інв — коефіцієнт запасу потужності інвертора (1.2–1.3)
 * P_пуск — пускова потужність (формула 2.5а)
 *
 * Результат округлюється до стандартного ряду інверторів.
 */
export function getRecommendedInverterPower(consumers = [], reserveRatio = 1.2) {
  if (!consumers.length) return 0;

  const designLoadPower = getDesignLoadPower(consumers);
  const startupPeakPower = getTotalSurgePower(consumers);
  const target = Math.max(designLoadPower * clampNumber(reserveRatio, 1, 2, 1.2), startupPeakPower);

  return inverterOptions.find((value) => value >= target) || Math.ceil(target / 500) * 500;
}

/**
 * Формула 2.3 — Необхідна енергія від акумуляторного банку
 * W_АКБ = (W_доб · τ) / (24 · η_інв) · K_з [Вт·год]
 *
 * W_доб — добове споживання, τ — час автономності (год),
 * η_інв — ККД інвертора (0.85–0.95), K_з — коефіцієнт запасу (1.1–1.25)
 *
 * Джерело: IEEE Std 485-2020, Oregon State ESE 471 Battery Sizing
 */
export function getRequiredBatteryEnergyWh(consumers = [], settings = {}) {
  const normalized = getEffectiveSizingSettings(settings);
  const dailyConsumptionWh = getDailyConsumptionWh(consumers);
  const requiredEnergyWh = dailyConsumptionWh * (normalized.effectiveTargetAutonomyHours / 24);
  return (
    (requiredEnergyWh / normalized.effectiveInverterEfficiency) *
    normalized.effectiveBatteryReserveRatio
  );
}

/**
 * Формула 2.4 — Мінімальна ємність акумуляторного банку
 * C_АКБ = W_АКБ / (U_сист · DOD) [А·год]
 *
 * W_АКБ — з формули 2.3 (вже враховує η_інв),
 * U_сист — напруга системи (В), DOD — глибина розряду
 *
 * DOD: AGM=0.50, GEL=0.55, LiFePO4=0.80
 * Джерело: IEEE Std 485-2020
 */
export function getRecommendedBatteryCapacityAh(consumers = [], settings = {}) {
  if (!consumers.length) return 0;

  const normalized = normalizeSystemSettings(settings);
  const batteryEnergyWh = getRequiredBatteryEnergyWh(consumers, normalized);
  const dod = getDepthOfDischargeByBatteryType(normalized.batteryType);

  if (!normalized.batteryVoltage || !dod) return 0;
  return Math.ceil(batteryEnergyWh / (normalized.batteryVoltage * dod));
}

/**
 * Формула 2.6 — Корисна енергія акумуляторного банку
 * W_корисна = C_АКБ · U_сист · DOD · η_інв [Вт·год]
 *
 * Це та частина запасеної енергії, яку реально отримають прилади
 * після втрат на перетворення (η) і обмеження глибини розряду (DOD).
 */
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

/**
 * Автономність при постійному навантаженні (гірший випадок)
 * τ_конт = W_корисна / P_розр [год]
 */
export function getEstimatedAutonomyHours(usableEnergyWh = 0, loadPower = 0) {
  if (!usableEnergyWh || !loadPower) return 0;
  return Number((usableEnergyWh / Math.max(loadPower, 1)).toFixed(2));
}

/**
 * Формула 2.7 — Автономність за добовим профілем
 * τ_авт = W_корисна / (W_доб / 24) = 24 · W_корисна / W_доб [год]
 *
 * Використовує середню потужність (W_доб/24) замість пікової —
 * дає реалістичнішу оцінку для нерівномірного навантаження.
 */
export function getAutonomyHoursByDailyConsumption(usableEnergyWh = 0, dailyConsumptionWh = 0) {
  if (!usableEnergyWh || !dailyConsumptionWh) return 0;
  const averageLoadPower = Number(dailyConsumptionWh || 0) / 24;
  return getEstimatedAutonomyHours(usableEnergyWh, averageLoadPower);
}

/**
 * Формула 2.9 — Рекомендований струм заряду АКБ
 * I_зар = C_н · K_зар [А]
 *
 * K_зар: AGM=0.12, GEL=0.10, LiFePO4=0.20
 */
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

/**
 * Формула 2.1а — Пікове навантаження за добовим профілем
 * P_розр = max(h=0..23) Σ(Pi · ni · w_i,h) [Вт]
 *
 * w_i,h — вагова функція профілю використання i-го споживача для години h.
 * Профілі: always (24/7), day, evening, night, office.
 *
 * Точніша за формулу 2.1 — враховує що не всі прилади працюють одночасно.
 */
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

  const hasLowPriorityConsumers = consumers.some((item) => item.priority === 'low');

  const variantMeta = [
    hasLowPriorityConsumers && {
      key: 'essentials',
      title: 'Без необов’язкового',
      strategy: 'Прибрано низькопріоритетні · повний час · без запасу',
      audience: 'Найменший банк за рахунок відключення того, що не критично.',
      description:
        'Зі списку прибираємо прилади з пріоритетом «Необов’язково». Решта — на повний цільовий час без додаткового запасу.',
    },
    {
      key: 'economy',
      title: 'Мінімум',
      strategy: 'Усі прилади · 70% часу · без запасу',
      audience: 'Найдешевший спосіб тримати все обладнання живим.',
      description:
        'Покриває всі прилади, але цільовий час скорочуємо до 70% і без додаткового запасу. Найменший банк АКБ, ціна — найнижча.',
    },
    {
      key: 'balance',
      title: 'Стандарт',
      strategy: 'Усі прилади · повний час · без додаткового запасу',
      audience: 'Оптимальний варіант для більшості сценаріїв.',
      description:
        'Усі прилади на заданий час — рівно стільки ємності, скільки потрібно. Без штучного запасу.',
      isRecommended: true,
    },
    {
      key: 'reliability',
      title: 'З запасом',
      strategy: 'Усі прилади · 120% часу · помірний запас',
      audience: 'Якщо хочете трохи більший запас на просадки і старіння АКБ.',
      description:
        'Усі прилади, цільовий час +20%, запас по АКБ +15%. Орієнтовно в півтора рази більший банк, ніж у Стандарті.',
    },
  ];

  const variants = variantMeta.filter(Boolean).map((variant) => {
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
      variant.calc.normalizedSettings?.batteryType || '',
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

/**
 * Формула 2.8 — Конфігурація акумуляторного банку
 * n_посл = ⌈U_сист / U_мод⌉ — послідовні модулі (набирають напругу)
 * n_пар  = ⌈C_АКБ / C_мод⌉ — паралельні модулі (набирають ємність)
 * N_бат  = n_посл · n_пар   — загальна кількість акумуляторів
 *
 * Конфігурації ранжуються за fitScore = |C_мод·n_пар − C_АКБ|
 * (чим менший — тим ближче до розрахункової ємності).
 */
export function getBatteryConfigurationOptions(consumers = [], settings = {}) {
  const normalized = getEffectiveSizingSettings(settings);
  const requiredAh = getRecommendedBatteryCapacityAh(consumers, normalized);
  if (!requiredAh) return [];

  const dailyConsumptionWh = getDailyConsumptionWh(consumers);
  const requiredEnergyWh = dailyConsumptionWh * (normalized.effectiveTargetAutonomyHours / 24);
  const designEnergyWh = requiredEnergyWh * normalized.effectiveBatteryReserveRatio;
  const designLoadPower = getDesignLoadPower(consumers, normalized);
  const seriesCount = Math.max(1, Math.ceil(normalized.batteryVoltage / 12));

  const candidates = standardBatteryOptions
    .map((capacityAh) => {
      const parallelCount = Math.max(1, Math.ceil(requiredAh / capacityAh));
      const totalBatteries = seriesCount * parallelCount;
      const totalStoredWh = normalized.batteryVoltage * capacityAh * parallelCount;
      const usableStoredWh = getUsableStoredEnergyWh(totalStoredWh, normalized);
      const autonomyHours = getAutonomyHoursByDailyConsumption(usableStoredWh, dailyConsumptionWh);
      const continuousAutonomyHours = getEstimatedAutonomyHours(usableStoredWh, designLoadPower);
      const bankCapacityAh = capacityAh * parallelCount;
      const oversizeRatio = Math.max(0, (bankCapacityAh - requiredAh) / Math.max(requiredAh, 1));
      const moduleCountPenalty = Math.max(0, totalBatteries - 2) * 0.08;
      const tinyModulePenalty = capacityAh < 100 ? 0.16 : 0;
      const practicalScore = Number((oversizeRatio + moduleCountPenalty + tinyModulePenalty).toFixed(4));

      return {
        label: `Модулі ${capacityAh} Ah · ${seriesCount} послідовно × ${parallelCount} паралельно`,
        moduleVoltage: 12,
        moduleCapacityAh: capacityAh,
        seriesCount,
        parallelCount,
        totalBatteries,
        bankVoltage: normalized.batteryVoltage,
        bankCapacityAh,
        totalStoredWh,
        usableStoredWh,
        autonomyHours,
        continuousAutonomyHours,
        fitScore: Math.abs(capacityAh * parallelCount - requiredAh),
        practicalScore,
        targetCoverageRatio:
          requiredEnergyWh > 0 ? Number((usableStoredWh / requiredEnergyWh).toFixed(2)) : 0,
        reserveCoverageRatio:
          designEnergyWh > 0 ? Number((usableStoredWh / designEnergyWh).toFixed(2)) : 0,
      };
    });

  // Відсікаємо надто громіздкі конфігурації, якщо є адекватніші варіанти.
  const practicalPool = candidates.filter((candidate) => candidate.totalBatteries <= 8);
  const source = practicalPool.length ? practicalPool : candidates;

  // Забираємо дублікати з однаковою сумарною ємністю банку:
  // лишаємо практичніший варіант (нижчий score, менше батарей).
  const byBankCapacity = new Map();
  source.forEach((candidate) => {
    const key = `${candidate.bankVoltage}:${candidate.bankCapacityAh}`;
    const current = byBankCapacity.get(key);
    if (!current) {
      byBankCapacity.set(key, candidate);
      return;
    }
    if (
      candidate.practicalScore < current.practicalScore ||
      (candidate.practicalScore === current.practicalScore &&
        candidate.totalBatteries < current.totalBatteries)
    ) {
      byBankCapacity.set(key, candidate);
    }
  });

  return [...byBankCapacity.values()]
    .sort((a, b) => {
      if (a.practicalScore !== b.practicalScore) return a.practicalScore - b.practicalScore;
      if (a.fitScore !== b.fitScore) return a.fitScore - b.fitScore;
      return a.totalBatteries - b.totalBatteries;
    })
    .slice(0, 3);
}

export function getSystemCalculation(consumers = [], settings = {}) {
  const normalizedSettings = normalizeSystemSettings(settings);
  const effectiveSettings = getEffectiveSizingSettings(settings);
  const totalPower = getTotalPower(consumers);
  const totalSurgePower = getTotalSurgePower(consumers);
  const designLoadPower = getDesignLoadPower(consumers, normalizedSettings);
  const dailyConsumptionWh = getDailyConsumptionWh(consumers);
  const requiredEnergyWh = Number(
    (dailyConsumptionWh * (effectiveSettings.effectiveTargetAutonomyHours / 24)).toFixed(2),
  );
  const totalEnergyWh = Number(
    (requiredEnergyWh * effectiveSettings.effectiveBatteryReserveRatio).toFixed(2),
  );
  const depthOfDischarge = getDepthOfDischargeByBatteryType(normalizedSettings.batteryType);

  const recommendedInverterPower = getRecommendedInverterPower(
    consumers,
    effectiveSettings.effectiveReserveRatio,
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
  const selectedBatteryConfigIndex = clampNumber(
    normalizedSettings.selectedBatteryConfigIndex,
    0,
    Math.max(0, recommendedBatteryConfigs.length - 1),
    0,
  );
  const bestConfig = recommendedBatteryConfigs[selectedBatteryConfigIndex] || recommendedBatteryConfigs[0] || null;
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
  const targetAutonomyHours = effectiveSettings.effectiveTargetAutonomyHours;
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
    effectiveSettings,
    selectedBatteryConfigIndex,
    selectedBatteryConfig: bestConfig,
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
