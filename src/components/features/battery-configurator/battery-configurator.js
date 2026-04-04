import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatAutonomy, formatBattery, formatEnergyWh, formatNumber } from '../../../utils/format.js';
import styles from './battery-configurator.scss?inline';

class BatteryConfigurator extends BaseElement {
  constructor() { super(); this._items = []; this._settings = {}; }
  styles() { return styles; }
  set items(value) { this._items = Array.isArray(value) ? value : []; if (this.isConnected) this.update(); }
  set settings(value) { this._settings = value || {}; if (this.isConnected) this.update(); }
  get items() { return this._items; }
  get settings() { return this._settings; }

  renderConfigCard(config, title, isPrimary = false) {
    if (!config) return '';
    return `
      <div class="battery-option ${isPrimary ? 'is-primary' : ''}">
        <div class="battery-option__head">
          <strong>${title}</strong>
          <span>${config.label}</span>
        </div>
        <div class="battery-option__grid">
          <div><span>Схема з'єднання</span><strong>${config.seriesCount}S / ${config.parallelCount}P</strong></div>
          <div><span>Кількість модулів</span><strong>${config.totalBatteries}</strong></div>
          <div><span>Комплект АКБ</span><strong>${config.bankVoltage} V · ${formatBattery(config.bankCapacityAh)}</strong></div>
          <div><span>Доступна енергія</span><strong>${formatEnergyWh(config.usableStoredWh)}</strong></div>
          <div><span>Повна ємність за енергією</span><strong>${formatEnergyWh(config.totalStoredWh)}</strong></div>
          <div><span>Час роботи у звичному режимі</span><strong>${formatAutonomy(config.autonomyHours)}</strong></div>
          <div><span>Час роботи при розрахунковому навантаженні</span><strong>${formatAutonomy(config.continuousAutonomyHours, { preferDays: false })}</strong></div>
          <div><span>Відповідність бажаному часу роботи</span><strong>${formatNumber(config.targetCoverageRatio * 100, 0)}%</strong></div>
          <div><span>Покриття запасу енергії</span><strong>${formatNumber(config.reserveCoverageRatio * 100, 0)}%</strong></div>
        </div>
      </div>
    `;
  }

  renderConfigs(configs = []) {
    if (!configs.length) return '<div class="battery-configurator__empty">Недостатньо даних для підбору батарейного банку.</div>';
    const [primary, ...alternatives] = configs;

    return `
      ${this.renderConfigCard(primary, 'Оптимальний варіант', true)}
      ${alternatives.length ? `
        <ui-disclosure label="Показати інші варіанти АКБ">
          <div class="battery-configurator__alternatives">
            ${alternatives.map((config, index) => this.renderConfigCard(config, `Альтернатива ${index + 1}`)).join('')}
          </div>
        </ui-disclosure>
      ` : ''}
    `;
  }
  render() {
    const calc = getSystemCalculation(this.items, this.settings);
    return `
      <ui-card padding="md">
        <section class="battery-configurator">
          <div class="battery-configurator__head">
            <p class="battery-configurator__eyebrow">Варіанти АКБ</p>
            <h2>Рекомендований комплект АКБ</h2>
          </div>
          <div class="battery-configurator__summary">
            <div><span>Рекомендована ємність АКБ</span><strong>${formatBattery(calc.recommendedBatteryCapacityAh)}</strong></div>
            <div><span>Потрібна енергія з запасом</span><strong>${formatEnergyWh(calc.totalEnergyWh)}</strong></div>
            <div><span>Час роботи у звичному режимі</span><strong>${formatAutonomy(calc.estimatedAutonomyHours)}</strong></div>
            <div><span>Напруга системи</span><strong>${formatNumber(this.settings.batteryVoltage || 24)} V</strong></div>
          </div>
          <ui-disclosure label="Деталі розрахунку АКБ">
            <div class="battery-configurator__summary battery-configurator__summary--secondary">
              <div><span>Потрібна енергія без запасу</span><strong>${formatEnergyWh(calc.requiredEnergyWh)}</strong></div>
              <div><span>Зарядний струм</span><strong>${formatNumber(calc.recommendedChargeCurrentA)} A</strong></div>
              <div><span>Час роботи при розрахунковому навантаженні</span><strong>${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}</strong></div>
              <div><span>Відповідність бажаному часу роботи</span><strong>${formatNumber(calc.autonomyCoverageRatio * 100, 0)}%</strong></div>
            </div>
          </ui-disclosure>
          <div class="battery-configurator__list">${this.renderConfigs(calc.recommendedBatteryConfigs)}</div>
        </section>
      </ui-card>
    `;
  }
}
customElements.define('battery-configurator', BatteryConfigurator);
