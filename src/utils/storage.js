const STORAGE_KEYS = {
  consumers: 'ups-planner-consumers',
  systemSettings: 'ups-planner-system-settings',
  zones: 'ups-planner-zones',
};

const defaultSettings = {
  batteryVoltage: 24,
  batteryType: 'lifepo4',
  autonomyDays: 1,
  inverterEfficiency: 0.92,
  reserveRatio: 1.2,
  simultaneityFactor: 0.85,
  batteryReserveRatio: 1.15,
};

const defaultZones = [
  { id: 'zone-kitchen', name: 'Кухня' },
  { id: 'zone-boiler', name: 'Котельня' },
  { id: 'zone-living', name: 'Вітальня' },
];

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

export function loadSystemSettings() {
  const parsed = safeParse(STORAGE_KEYS.systemSettings);
  if (!parsed || typeof parsed !== 'object') return defaultSettings;

  return {
    ...defaultSettings,
    ...parsed,
    batteryVoltage: Number(parsed?.batteryVoltage || defaultSettings.batteryVoltage),
    autonomyDays: Number(parsed?.autonomyDays || defaultSettings.autonomyDays),
    inverterEfficiency: Number(parsed?.inverterEfficiency || defaultSettings.inverterEfficiency),
    reserveRatio: Number(parsed?.reserveRatio || defaultSettings.reserveRatio),
    simultaneityFactor: Number(parsed?.simultaneityFactor || defaultSettings.simultaneityFactor),
    batteryReserveRatio: Number(parsed?.batteryReserveRatio || defaultSettings.batteryReserveRatio),
  };
}

export function saveSystemSettings(settings = {}) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.systemSettings,
      JSON.stringify({
        ...defaultSettings,
        ...settings,
      })
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
}

export { defaultSettings, defaultZones };
