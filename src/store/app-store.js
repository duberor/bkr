import {
  loadConsumers,
  saveConsumers,
  loadSystemSettings,
  saveSystemSettings,
  loadScenario,
  saveScenario,
  loadZones,
  saveZones,
  clearAllProjectStorage,
  defaultSettings,
  defaultScenario,
  defaultZones,
} from '../utils/storage.js';
import { normalizeConsumer, normalizeSystemSettings } from '../utils/consumer-utils.js';

const defaultState = {
  consumers: [],
  zones: defaultZones,
  systemSettings: defaultSettings,
  scenario: defaultScenario,
};

function normalizeZone(zone, index = 0) {
  const name = String(zone?.name || '').trim();
  if (!name) return null;

  return {
    id: String(zone?.id || `zone-${crypto.randomUUID()}`),
    name,
  };
}

function normalizeScenario(scenario = {}) {
  return {
    objectType: scenario?.objectType || defaultScenario.objectType,
    scenarioType: scenario?.scenarioType || defaultScenario.scenarioType,
    backupScope: scenario?.backupScope || defaultScenario.backupScope,
    hasBoiler: Boolean(scenario?.hasBoiler),
    hasPump: Boolean(scenario?.hasPump),
    hasFridge:
      typeof scenario?.hasFridge === 'boolean' ? scenario.hasFridge : defaultScenario.hasFridge,
    presetId: String(scenario?.presetId || ''),
    userMode: scenario?.userMode === 'advanced' ? 'advanced' : defaultScenario.userMode,
  };
}

class AppStore {
  constructor() {
    this.listeners = new Set();
    this.state = {
      consumers: loadConsumers(),
      zones: loadZones(),
      systemSettings: loadSystemSettings(),
      scenario: loadScenario(),
    };

    if (!Array.isArray(this.state.consumers)) this.state.consumers = defaultState.consumers;
    if (!Array.isArray(this.state.zones) || !this.state.zones.length)
      this.state.zones = defaultState.zones;

    this.state.systemSettings = {
      ...defaultState.systemSettings,
      ...(this.state.systemSettings || {}),
    };
    this.state.scenario = normalizeScenario({
      ...defaultState.scenario,
      ...(this.state.scenario || {}),
    });
  }

  getState() {
    return structuredClone(this.state);
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  emit() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  setConsumers(consumers) {
    this.state.consumers = Array.isArray(consumers) ? consumers : [];
    saveConsumers(this.state.consumers);
    this.emit();
  }

  addConsumer(consumer) {
    this.setConsumers([...this.state.consumers, consumer]);
  }

  updateConsumer(id, patch) {
    this.setConsumers(
      this.state.consumers.map((consumer) =>
        consumer.id === id ? { ...consumer, ...patch } : consumer,
      ),
    );
  }

  removeConsumer(id) {
    this.setConsumers(this.state.consumers.filter((consumer) => consumer.id !== id));
  }

  clearConsumers() {
    this.setConsumers([]);
  }

  setZones(zones) {
    this.state.zones = Array.isArray(zones) ? zones : [];
    saveZones(this.state.zones);
    this.emit();
  }

  addZone(zone) {
    this.setZones([...this.state.zones, zone]);
  }

  updateZone(zoneId, patch) {
    this.setZones(
      this.state.zones.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone)),
    );
  }

  removeZone(zoneId) {
    this.setZones(this.state.zones.filter((zone) => zone.id !== zoneId));
  }

  setSystemSettings(settings) {
    this.state.systemSettings = {
      ...this.state.systemSettings,
      ...normalizeSystemSettings({
        ...this.state.systemSettings,
        ...settings,
      }),
    };
    saveSystemSettings(this.state.systemSettings);
    this.emit();
  }

  setScenario(scenario) {
    this.state.scenario = normalizeScenario({
      ...this.state.scenario,
      ...scenario,
    });
    saveScenario(this.state.scenario);
    this.emit();
  }

  replaceProject(project = {}) {
    const zones = (Array.isArray(project?.zones) ? project.zones : defaultState.zones)
      .map((zone, index) => normalizeZone(zone, index))
      .filter(Boolean);
    const nextZones = zones.length ? zones : defaultState.zones;
    const validZoneIds = new Set(nextZones.map((zone) => zone.id));
    const consumers = (Array.isArray(project?.consumers) ? project.consumers : [])
      .map((consumer) => normalizeConsumer(consumer))
      .map((consumer) => ({
        ...consumer,
        zoneId: validZoneIds.has(consumer.zoneId) ? consumer.zoneId : '',
      }));

    this.state = {
      consumers,
      zones: nextZones,
      systemSettings: normalizeSystemSettings(
        project?.systemSettings || defaultState.systemSettings,
      ),
      scenario: normalizeScenario(project?.scenario || defaultState.scenario),
    };

    saveConsumers(this.state.consumers);
    saveZones(this.state.zones);
    saveSystemSettings(this.state.systemSettings);
    saveScenario(this.state.scenario);
    this.emit();
  }

  clearAll() {
    this.state = {
      consumers: [],
      zones: defaultZones,
      systemSettings: defaultSettings,
      scenario: defaultScenario,
    };
    clearAllProjectStorage();
    saveZones(this.state.zones);
    saveSystemSettings(this.state.systemSettings);
    saveScenario(this.state.scenario);
    this.emit();
  }
}

export const appStore = new AppStore();
