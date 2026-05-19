import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import { getSolutionVariants, getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatAutonomy, formatBattery, formatPower } from '../../../utils/format.js';
import styles from './system-summary.scss?inline';

class SystemSummary extends BaseElement {
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
  get items() {
    return this._items;
  }
  set settings(value) {
    this._settings = value || {};
    if (this.isConnected) this.update();
  }
  get settings() {
    return this._settings;
  }

  renderRecommendation(calc, recommendedVariant) {
    if (!this.items.length) {
      return `
        <div class="system-summary__empty">
          <p>Додайте хоча б один прилад, щоб побачити, який інвертор і яка АКБ потрібні для вашого сценарію.</p>
          <a class="system-summary__empty-link" href="#/consumers">Перейти до приладів</a>
        </div>
      `;
    }

    return `
      <div class="system-summary__recommendation">
        <div class="system-summary__recommendation-grid">
          <div>
            <span>Зараз найкраще виглядає</span>
            <strong>${recommendedVariant?.title || 'Баланс'}</strong>
          </div>
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
            <strong>${formatAutonomy(calc.estimatedAutonomyHours)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  renderSecondaryMetrics(calc) {
    return `
      <div class="system-summary__mini-grid">
        <div><span>Напруга системи</span><strong>${this.settings.batteryVoltage || 24} V</strong></div>
        <div><span>Час роботи при максимальному навантаженні</span><strong>${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}</strong></div>
      </div>
    `;
  }

  renderPrimaryMetrics(calc) {
    return `
      <div class="system-summary__grid">
        <div><span>Сумарна потужність</span><strong>${formatPower(calc.totalPower)}</strong></div>
        <div><span>Пусковий пік</span><strong>${formatPower(calc.totalSurgePower)}</strong></div>
        <div><span>Орієнтир по інвертору</span><strong>${formatPower(calc.recommendedInverterPower)}</strong></div>
        <div><span>Орієнтир по АКБ</span><strong>${formatBattery(calc.recommendedBatteryCapacityAh)}</strong></div>
      </div>
    `;
  }

  render() {
    const variants = getSolutionVariants(this.items, this.settings);
    const recommendedVariant =
      variants.find((variant) => variant.isRecommended) || variants[0] || null;
    const calc = recommendedVariant?.calc || getSystemCalculation(this.items, this.settings);

    return `
      <ui-card padding="md">
        <section class="system-summary">
          <div class="system-summary__head">
            <p class="system-summary__eyebrow">Попередній результат</p>
            <h2>Короткий орієнтир</h2>
          </div>
          ${this.renderRecommendation(calc, recommendedVariant)}
          ${this.renderPrimaryMetrics(calc)}
          <ui-disclosure label="Технічні деталі">
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
