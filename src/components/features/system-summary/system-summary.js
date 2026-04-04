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
      return '<div class="system-summary__empty">Додайте хоча б один прилад, щоб побачити, який інвертор і яка АКБ потрібні для вашого сценарію.</div>';
    }

    const autonomyHours = calc.estimatedAutonomyHours;
    return `
      <div class="system-summary__recommendation">
        <div class="system-summary__recommendation-grid">
          <div>
            <span>Який інвертор потрібен</span>
            <strong>${formatPower(calc.recommendedInverterPower)}</strong>
          </div>
          <div>
            <span>Яка АКБ потрібна</span>
            <strong>${this.settings.batteryVoltage || 24} V · ${formatBattery(calc.recommendedBatteryCapacityAh)}</strong>
          </div>
          <div>
            <span>Скільки пропрацює у звичному режимі</span>
            <strong>${formatAutonomy(autonomyHours)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  renderSecondaryMetrics(calc) {
    return `
      <div class="system-summary__mini-grid">
          <div><span>Скільки енергії потрібно</span><strong>${formatEnergyWh(calc.requiredEnergyWh)}</strong></div>
          <div><span>Скільки енергії потрібно із запасом</span><strong>${formatEnergyWh(calc.totalEnergyWh)}</strong></div>
          <div><span>Корисний запас енергії АКБ</span><strong>${formatEnergyWh(calc.usableBatteryEnergyWh)}</strong></div>
          <div><span>Який зарядний струм потрібен</span><strong>${formatNumber(calc.recommendedChargeCurrentA)} A</strong></div>
          <div><span>Глибина розряду АКБ</span><strong>${formatNumber(calc.depthOfDischarge * 100)}%</strong></div>
          <div><span>Чи вистачає на бажаний час роботи</span><strong>${formatNumber(calc.autonomyCoverageRatio * 100, 0)}%</strong></div>
          <div><span>Скільки приладів працює одночасно</span><strong>${formatNumber(calc.simultaneityFactor, 2)}</strong></div>
          <div><span>Додатковий запас АКБ</span><strong>${formatNumber(calc.batteryReserveRatio, 2)}×</strong></div>
          <div><span>Час роботи при максимальному навантаженні</span><strong>${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}</strong></div>
          <div><span>Напруга системи</span><strong>${this.settings.batteryVoltage || 24} V</strong></div>
      </div>
    `;
  }

  renderPrimaryMetrics(calc) {
    return `
      <div class="system-summary__grid">
        <div><span>Сумарна потужність приладів</span><strong>${formatPower(calc.totalPower)}</strong></div>
        <div><span>Навантаження, під яке підбираємо систему</span><strong>${formatPower(calc.designLoadPower)}</strong></div>
        <div><span>Пусковий пік</span><strong>${formatPower(calc.totalSurgePower)}</strong></div>
        <div><span>Споживання за добу</span><strong>${formatEnergyWh(calc.dailyConsumptionWh)}</strong></div>
        <div><span>Який інвертор потрібен</span><strong>${formatPower(calc.recommendedInverterPower)}</strong></div>
        <div><span>Яка ємність АКБ потрібна</span><strong>${formatBattery(calc.recommendedBatteryCapacityAh)}</strong></div>
      </div>
    `;
  }

  render() {
    const calc = getSystemCalculation(this.items, this.settings);
    return `
      <ui-card padding="md">
        <section class="system-summary">
          <div class="system-summary__head">
            <p class="system-summary__eyebrow">Попередній результат</p>
            <h2>Що система рекомендує</h2>
          </div>
          ${this.renderPrimaryMetrics(calc)}
          ${this.renderRecommendation(calc)}
          <ui-disclosure label="Як це пораховано">
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
