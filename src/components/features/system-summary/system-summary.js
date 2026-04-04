import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatAutonomy, formatBattery, formatEnergyWh, formatNumber, formatPower } from '../../../utils/format.js';
import styles from './system-summary.scss?inline';

class SystemSummary extends BaseElement {
  constructor() { super(); this._items = []; this._settings = {}; }
  styles() { return styles; }
  set items(value) { this._items = Array.isArray(value) ? value : []; if (this.isConnected) this.update(); }
  get items() { return this._items; }
  set settings(value) { this._settings = value || {}; if (this.isConnected) this.update(); }
  get settings() { return this._settings; }

  renderRecommendation(calc) {
    if (!this.items.length) {
      return '<div class="system-summary__empty">Додайте хоча б один прилад, щоб отримати рекомендації щодо інвертора, акумулятора та автономності.</div>';
    }

    const autonomyHours = calc.estimatedAutonomyHours;
    return `
      <div class="system-summary__recommendation">
        <div class="system-summary__recommendation-grid">
          <div>
            <span>Інвертор</span>
            <strong>${formatPower(calc.recommendedInverterPower)}</strong>
          </div>
          <div>
            <span>Комплект АКБ</span>
            <strong>${this.settings.batteryVoltage || 24} V · ${formatBattery(calc.recommendedBatteryCapacityAh)}</strong>
          </div>
          <div>
            <span>Час роботи у звичному режимі</span>
            <strong>${formatAutonomy(autonomyHours)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  renderSecondaryMetrics(calc) {
    return `
      <div class="system-summary__mini-grid">
          <div><span>Потрібна енергія без запасу</span><strong>${formatEnergyWh(calc.requiredEnergyWh)}</strong></div>
          <div><span>Потрібна енергія з запасом</span><strong>${formatEnergyWh(calc.totalEnergyWh)}</strong></div>
          <div><span>Доступна енергія АКБ</span><strong>${formatEnergyWh(calc.usableBatteryEnergyWh)}</strong></div>
          <div><span>Зарядний струм</span><strong>${formatNumber(calc.recommendedChargeCurrentA)} A</strong></div>
          <div><span>Допустима глибина розряду</span><strong>${formatNumber(calc.depthOfDischarge * 100)}%</strong></div>
          <div><span>Відповідність бажаному часу роботи</span><strong>${formatNumber(calc.autonomyCoverageRatio * 100, 0)}%</strong></div>
          <div><span>Одночасність роботи</span><strong>${formatNumber(calc.simultaneityFactor, 2)}</strong></div>
          <div><span>Запас АКБ</span><strong>${formatNumber(calc.batteryReserveRatio, 2)}×</strong></div>
          <div><span>Час роботи при розрахунковому навантаженні</span><strong>${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}</strong></div>
          <div><span>Напруга системи</span><strong>${this.settings.batteryVoltage || 24} V</strong></div>
      </div>
    `;
  }

  renderPrimaryMetrics(calc) {
    return `
      <div class="system-summary__grid">
        <div><span>Сумарна потужність приладів</span><strong>${formatPower(calc.totalPower)}</strong></div>
        <div><span>Розрахункова потужність</span><strong>${formatPower(calc.designLoadPower)}</strong></div>
        <div><span>Пускова потужність</span><strong>${formatPower(calc.totalSurgePower)}</strong></div>
        <div><span>Добове споживання</span><strong>${formatEnergyWh(calc.dailyConsumptionWh)}</strong></div>
        <div><span>Рекомендований інвертор</span><strong>${formatPower(calc.recommendedInverterPower)}</strong></div>
        <div><span>Рекомендована ємність АКБ</span><strong>${formatBattery(calc.recommendedBatteryCapacityAh)}</strong></div>
      </div>
    `;
  }

  render() {
    const calc = getSystemCalculation(this.items, this.settings);
    return `
      <ui-card padding="md">
        <section class="system-summary">
          <div class="system-summary__head">
            <p class="system-summary__eyebrow">Підсумок розрахунку</p>
            <h2>Що потрібно для системи</h2>
          </div>
          ${this.renderPrimaryMetrics(calc)}
          ${this.renderRecommendation(calc)}
          <ui-disclosure label="Що враховано в розрахунку">
            <div class="system-summary__explainer">
              ${this.renderSecondaryMetrics(calc)}
            </div>
          </ui-disclosure>
        </section>
      </ui-card>
    `;
  }
}
customElements.define('system-summary', SystemSummary);
