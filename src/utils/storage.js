const STORAGE_KEYS = {
  consumers: 'ups-planner-consumers',
  systemSettings: 'ups-planner-system-settings',
  zones: 'ups-planner-zones',
  scenario: 'ups-planner-scenario',
};

const defaultSettings = {
  batteryVoltage: 24,
  batteryVoltageMode: 'auto',
  batteryType: 'lifepo4',
  batteryTypeMode: 'auto',
  targetAutonomyHours: 24,
  autonomyInputUnit: 'days',
  inverterEfficiency: 0.92,
  reserveRatio: 1.2,
  batteryReserveRatio: 1.15,
};

const defaultZones = [
  { id: 'zone-kitchen', name: 'Кухня' },
  { id: 'zone-boiler', name: 'Котельня' },
  { id: 'zone-living', name: 'Вітальня' },
];

const defaultScenario = {
  objectType: 'apartment',
  scenarioType: 'custom',
  backupScope: 'critical',
  hasBoiler: false,
  hasPump: false,
  hasFridge: true,
  presetId: '',
  userMode: 'basic',
};

function safeParse(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadConsumers() {
  const parsed = safeParse(STORAGE_KEYS.consumers);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveConsumers(consumers = []) {
  try {
    localStorage.setItem(STORAGE_KEYS.consumers, JSON.stringify(consumers));
  } catch (error) {
    console.error('Failed to save consumers:', error);
  }
}

export function clearConsumers() {
  try {
    localStorage.removeItem(STORAGE_KEYS.consumers);
  } catch (error) {
    console.error('Failed to clear consumers:', error);
  }
}

export function loadZones() {
  const parsed = safeParse(STORAGE_KEYS.zones);
  return Array.isArray(parsed) && parsed.length ? parsed : defaultZones;
}

export function saveZones(zones = []) {
  try {
    localStorage.setItem(STORAGE_KEYS.zones, JSON.stringify(zones));
  } catch (error) {
    console.error('Failed to save zones:', error);
  }
}

export function clearZones() {
  try {
    localStorage.removeItem(STORAGE_KEYS.zones);
  } catch (error) {
    console.error('Failed to clear zones:', error);
  }
}

export function loadScenario() {
  const parsed = safeParse(STORAGE_KEYS.scenario);
  if (!parsed || typeof parsed !== 'object') return defaultScenario;

  return {
    objectType: parsed?.objectType || defaultScenario.objectType,
    scenarioType: parsed?.scenarioType || defaultScenario.scenarioType,
    backupScope: parsed?.backupScope || defaultScenario.backupScope,
    hasBoiler: Boolean(parsed?.hasBoiler),
    hasPump: Boolean(parsed?.hasPump),
    hasFridge:
      typeof parsed?.hasFridge === 'boolean' ? parsed.hasFridge : defaultScenario.hasFridge,
    presetId: String(parsed?.presetId || ''),
    userMode: parsed?.userMode === 'advanced' ? 'advanced' : defaultScenario.userMode,
  };
}

export function saveScenario(scenario = {}) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.scenario,
      JSON.stringify({
        ...defaultScenario,
        objectType: scenario?.objectType || defaultScenario.objectType,
        scenarioType: scenario?.scenarioType || defaultScenario.scenarioType,
        backupScope: scenario?.backupScope || defaultScenario.backupScope,
        hasBoiler: Boolean(scenario?.hasBoiler),
        hasPump: Boolean(scenario?.hasPump),
        hasFridge:
          typeof scenario?.hasFridge === 'boolean' ? scenario.hasFridge : defaultScenario.hasFridge,
        presetId: String(scenario?.presetId || ''),
        userMode: scenario?.userMode === 'advanced' ? 'advanced' : defaultScenario.userMode,
      }),
    );
  } catch (error) {
    console.error('Failed to save scenario:', error);
  }
}

export function clearScenario() {
  try {
    localStorage.removeItem(STORAGE_KEYS.scenario);
  } catch (error) {
    console.error('Failed to clear scenario:', error);
  }
}

export function loadSystemSettings() {
  const parsed = safeParse(STORAGE_KEYS.systemSettings);
  if (!parsed || typeof parsed !== 'object') return defaultSettings;

  const legacyAutonomyDays = Number(parsed?.autonomyDays);
  const rawTargetAutonomyHours = Number(
    parsed?.targetAutonomyHours ??
      (Number.isFinite(legacyAutonomyDays)
        ? legacyAutonomyDays * 24
        : defaultSettings.targetAutonomyHours),
  );
  const targetAutonomyHours = Number.isFinite(rawTargetAutonomyHours)
    ? Math.min(720, Math.max(1, Number(rawTargetAutonomyHours.toFixed(2))))
    : defaultSettings.targetAutonomyHours;

  const autonomyInputUnit = ['hours', 'days'].includes(parsed?.autonomyInputUnit)
    ? parsed.autonomyInputUnit
    : Number.isFinite(legacyAutonomyDays) ||
        (targetAutonomyHours >= 24 && targetAutonomyHours % 24 === 0)
      ? 'days'
      : 'hours';

  return {
    batteryVoltage: Number(parsed?.batteryVoltage || defaultSettings.batteryVoltage),
    batteryVoltageMode:
      parsed?.batteryVoltageMode === 'manual'
        ? 'manual'
        : parsed?.batteryVoltageMode === 'auto'
          ? 'auto'
          : Number(parsed?.batteryVoltage || defaultSettings.batteryVoltage) !==
              defaultSettings.batteryVoltage
            ? 'manual'
            : 'auto',
    batteryType: parsed?.batteryType || defaultSettings.batteryType,
    batteryTypeMode:
      parsed?.batteryTypeMode === 'manual'
        ? 'manual'
        : parsed?.batteryTypeMode === 'auto'
          ? 'auto'
          : (parsed?.batteryType || defaultSettings.batteryType) !== defaultSettings.batteryType
            ? 'manual'
            : 'auto',
    targetAutonomyHours,
    autonomyInputUnit,
    inverterEfficiency: Number(parsed?.inverterEfficiency || defaultSettings.inverterEfficiency),
    reserveRatio: Number(parsed?.reserveRatio || defaultSettings.reserveRatio),
    batteryReserveRatio: Number(parsed?.batteryReserveRatio || defaultSettings.batteryReserveRatio),
  };
}

export function saveSystemSettings(settings = {}) {
  const legacyAutonomyDays = Number(settings?.autonomyDays);
  const rawTargetAutonomyHours = Number(
    settings?.targetAutonomyHours ??
      (Number.isFinite(legacyAutonomyDays)
        ? legacyAutonomyDays * 24
        : defaultSettings.targetAutonomyHours),
  );
  const targetAutonomyHours = Number.isFinite(rawTargetAutonomyHours)
    ? Math.min(720, Math.max(1, Number(rawTargetAutonomyHours.toFixed(2))))
    : defaultSettings.targetAutonomyHours;
  const autonomyInputUnit = ['hours', 'days'].includes(settings?.autonomyInputUnit)
    ? settings.autonomyInputUnit
    : Number.isFinite(legacyAutonomyDays) ||
        (targetAutonomyHours >= 24 && targetAutonomyHours % 24 === 0)
      ? 'days'
      : 'hours';

  try {
    localStorage.setItem(
      STORAGE_KEYS.systemSettings,
      JSON.stringify({
        ...defaultSettings,
        batteryVoltage: Number(settings?.batteryVoltage || defaultSettings.batteryVoltage),
        batteryVoltageMode: settings?.batteryVoltageMode === 'manual' ? 'manual' : 'auto',
        batteryType: settings?.batteryType || defaultSettings.batteryType,
        batteryTypeMode: settings?.batteryTypeMode === 'manual' ? 'manual' : 'auto',
        targetAutonomyHours,
        autonomyInputUnit,
        inverterEfficiency: Number(
          settings?.inverterEfficiency || defaultSettings.inverterEfficiency,
        ),
        reserveRatio: Number(settings?.reserveRatio || defaultSettings.reserveRatio),
        batteryReserveRatio: Number(
          settings?.batteryReserveRatio || defaultSettings.batteryReserveRatio,
        ),
      }),
    );
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function clearSystemSettings() {
  try {
    localStorage.removeItem(STORAGE_KEYS.systemSettings);
  } catch (error) {
    console.error('Failed to clear settings:', error);
  }
}

export function clearAllProjectStorage() {
  clearConsumers();
  clearZones();
  clearSystemSettings();
  clearScenario();
}

export { defaultSettings, defaultZones, defaultScenario };
