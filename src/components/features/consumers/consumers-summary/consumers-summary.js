import { BaseElement } from '../../../base/base-element.js';
import '../../../ui/ui-card/ui-card.js';
import '../../../ui/ui-disclosure/ui-disclosure.js';
import { getCategoryBreakdown, getSystemCalculation } from '../../../../utils/consumer-utils.js';
import { formatEnergyWh, formatPower, formatNumber } from '../../../../utils/format.js';
import styles from './consumers-summary.scss?inline';

class ConsumersSummary extends BaseElement {
  constructor() { super(); this._items = []; this._settings = {}; }
  styles() { return styles; }
  set items(value) { this._items = Array.isArray(value) ? value : []; if (this.isConnected) this.update(); }
  get items() { return this._items; }
  set settings(value) { this._settings = value || {}; if (this.isConnected) this.update(); }
  get settings() { return this._settings; }
  render() {
    const calc = getSystemCalculation(this.items, this.settings);
    const topCategory = getCategoryBreakdown(this.items).sort((a,b) => b.value - a.value)[0];
    return `
      <ui-card padding="md">
        <section class="summary">
          <div class="summary__head"><p class="summary__eyebrow">Коротко</p><h2>Поточний стан проєкту</h2></div>
          <div class="summary__grid">
            <div><span>Кількість приладів</span><strong>${formatNumber(this.items.length)}</strong></div>
            <div><span>Робоче навантаження</span><strong>${formatPower(calc.totalPower)}</strong></div>
            <div><span>Пускове навантаження</span><strong>${formatPower(calc.totalSurgePower)}</strong></div>
            <div><span>Добове споживання</span><strong>${formatEnergyWh(calc.dailyConsumptionWh)}</strong></div>
          </div>
          <ui-disclosure label="Ще кілька підсумків">
            <div class="summary__grid summary__grid--secondary">
              <div><span>Найбільше споживає</span><strong>${topCategory?.label || '—'}</strong></div>
              <div><span>Рекомендована ємність АКБ</span><strong>${calc.recommendedBatteryCapacityAh} Ah</strong></div>
            </div>
          </ui-disclosure>
        </section>
      </ui-card>
    `;
  }
}
customElements.define('consumers-summary', ConsumersSummary);
