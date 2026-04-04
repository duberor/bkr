import {
  loadConsumers,
  saveConsumers,
  loadSystemSettings,
  saveSystemSettings,
  loadZones,
  saveZones,
  clearAllProjectStorage,
  defaultSettings,
  defaultZones,
} from '../utils/storage.js';

const defaultState = {
  consumers: [],
  zones: defaultZones,
  systemSettings: defaultSettings,
};

class AppStore {
  constructor() {
    this.listeners = new Set();
    this.state = {
      consumers: loadConsumers(),
      zones: loadZones(),
      systemSettings: loadSystemSettings(),
    };

    if (!Array.isArray(this.state.consumers)) this.state.consumers = defaultState.consumers;
    if (!Array.isArray(this.state.zones) || !this.state.zones.length) this.state.zones = defaultState.zones;

    this.state.systemSettings = {
      ...defaultState.systemSettings,
      ...(this.state.systemSettings || {}),
    };
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
      this.state.consumers.map((consumer) => (
        consumer.id === id ? { ...consumer, ...patch } : consumer
      ))
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
    this.setZones(this.state.zones.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone)));
  }

  removeZone(zoneId) {
    this.setZones(this.state.zones.filter((zone) => zone.id !== zoneId));
  }

  setSystemSettings(settings) {
    this.state.systemSettings = {
      ...this.state.systemSettings,
      ...settings,
    };
    saveSystemSettings(this.state.systemSettings);
    this.emit();
  }

  clearAll() {
    this.state = {
      consumers: [],
      zones: defaultZones,
      systemSettings: defaultSettings,
    };
    clearAllProjectStorage();
    saveZones(this.state.zones);
    saveSystemSettings(this.state.systemSettings);
    this.emit();
  }
}

export const appStore = new AppStore();
