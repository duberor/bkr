import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatAutonomy, formatBattery, formatEnergyWh } from '../../../utils/format.js';
import styles from './battery-configurator.scss?inline';

class BatteryConfigurator extends BaseElement {
  constructor() {
    super();
    this._items = [];
    this._settings = {};
  }
  styles() {
    return styles;
  }
  set items(value) {
    this._items = Array.isArray(value) ? value : [];
    if (this.isConnected) this.update();
  }
  set settings(value) {
    this._settings = value || {};
    if (this.isConnected) this.update();
  }
  get items() {
    return this._items;
  }
  get settings() {
    return this._settings;
  }

  renderConfigCard(config, title, isPrimary = false) {
    if (!config) return '';
    return `
        <div class="battery-option ${isPrimary ? 'is-primary' : ''}">
          <div class="battery-option__head">
            <strong>${title}</strong>
          </div>
          <div class="battery-option__grid">
            <div><span>Комплект АКБ</span><strong>${config.bankVoltage} V · ${formatBattery(config.bankCapacityAh)}</strong></div>
            <div><span>Доступна енергія</span><strong>${formatEnergyWh(config.usableStoredWh)}</strong></div>
            <div><span>Час роботи у звичному режимі</span><strong>${formatAutonomy(config.autonomyHours)}</strong></div>
            <div><span>Час роботи при максимальному навантаженні</span><strong>${formatAutonomy(config.continuousAutonomyHours, { preferDays: false })}</strong></div>
          </div>
        </div>
      `;
  }

  renderConfigs(configs = []) {
    if (!configs.length)
      return '<div class="battery-configurator__empty">Недостатньо даних для підбору батарейного банку.</div>';
    const [primary, ...alternatives] = configs;

    return `
      ${this.renderConfigCard(primary, 'Оптимальний варіант', true)}
      ${
        alternatives.length
          ? `
        <ui-disclosure label="Подивитися інші варіанти АКБ">
          <div class="battery-configurator__alternatives">
            ${alternatives.map((config, index) => this.renderConfigCard(config, `Альтернатива ${index + 1}`)).join('')}
          </div>
        </ui-disclosure>
      `
          : ''
      }
    `;
  }
  render() {
    const calc = getSystemCalculation(this.items, this.settings);
    return `
      <ui-card padding="md">
        <section class="battery-configurator">
          <div class="battery-configurator__head">
            <p class="battery-configurator__eyebrow">АКБ</p>
            <h2>Варіанти комплекту АКБ</h2>
          </div>
          <div class="battery-configurator__summary">
            <div><span>Яка ємність потрібна</span><strong>${formatBattery(calc.recommendedBatteryCapacityAh)}</strong></div>
            <div><span>Час роботи у звичному режимі</span><strong>${formatAutonomy(calc.estimatedAutonomyHours)}</strong></div>
            <div><span>Напруга системи</span><strong>${this.settings.batteryVoltage || 24} V</strong></div>
          </div>
          <ui-disclosure label="Що враховано при підборі АКБ">
            <div class="battery-configurator__summary battery-configurator__summary--secondary">
              <div><span>Скільки енергії потрібно без запасу</span><strong>${formatEnergyWh(calc.requiredEnergyWh)}</strong></div>
              <div><span>Час роботи при максимальному навантаженні</span><strong>${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}</strong></div>
            </div>
          </ui-disclosure>
          <div class="battery-configurator__list">${this.renderConfigs(calc.recommendedBatteryConfigs)}</div>
        </section>
      </ui-card>
    `;
  }
}
customElements.define('battery-configurator', BatteryConfigurator);
