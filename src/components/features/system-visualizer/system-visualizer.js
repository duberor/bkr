import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatAutonomy, formatBattery, formatEnergyWh, formatNumber, formatPower } from '../../../utils/format.js';
import styles from './system-visualizer.scss?inline';

class SystemVisualizer extends BaseElement {
  constructor() {
    super();
    this._items = [];
    this._settings = {};
  }

  styles() { return styles; }

  set items(value) {
    this._items = Array.isArray(value) ? value : [];
    if (this.isConnected) this.update();
  }

  set settings(value) {
    this._settings = value || {};
    if (this.isConnected) this.update();
  }

  render() {
    const calc = getSystemCalculation(this._items, this._settings);
    const voltage = Number(calc.normalizedSettings?.batteryVoltage || 24);
    const efficiency = Number(calc.normalizedSettings?.inverterEfficiency || 0.92);
    const designDcCurrent = voltage ? calc.designLoadPower / Math.max(voltage * efficiency, 1) : 0;
    const surgeDcCurrent = voltage ? calc.totalSurgePower / Math.max(voltage * efficiency, 1) : 0;
    const best = calc.recommendedBatteryConfigs?.[0] || null;
    const usableEnergyWh = Number(best?.usableStoredWh || calc.usableBatteryEnergyWh || 0);

    return `
      <ui-card padding="md">
        <section class="visualizer">
          <div class="visualizer__head">
            <p class="visualizer__eyebrow">Схема</p>
            <h2>Як виглядає система</h2>
          </div>

          <div class="visualizer__scheme-card">
            <div class="visualizer__flow">
              <div class="node"><span>Живлення від мережі</span><strong>Мережа / генератор</strong></div>
              <div class="arrow">→</div>
              <div class="node"><span>Перемикання і заряджання</span><strong>Автоматичне перемикання + зарядний</strong></div>
              <div class="arrow">→</div>
              <div class="node node--accent"><span>Інвертор</span><strong>${formatPower(calc.recommendedInverterPower)}</strong></div>
              <div class="arrow">→</div>
              <div class="node"><span>Критичні прилади</span><strong>${formatPower(calc.criticalPower || calc.designLoadPower)}</strong></div>
            </div>

            <div class="visualizer__flow visualizer__flow--battery">
              <div class="node node--accent"><span>Комплект АКБ</span><strong>${voltage} V · ${formatBattery(calc.recommendedBatteryCapacityAh)}</strong></div>
              <div class="arrow">⇄</div>
              <div class="node"><span>Захист по постійному струму</span><strong>${formatNumber(designDcCurrent, 0)} A / ${formatNumber(surgeDcCurrent, 0)} A</strong></div>
              <div class="arrow">⇄</div>
              <div class="node"><span>Корисний запас енергії</span><strong>${formatEnergyWh(usableEnergyWh)}</strong></div>
            </div>
          </div>

          <div class="visualizer__metrics">
            <div><span>Навантаження, під яке підібрана система</span><strong>${formatPower(calc.designLoadPower)}</strong></div>
            <div><span>Пусковий пік</span><strong>${formatPower(calc.totalSurgePower)}</strong></div>
            <div><span>Час роботи у звичному режимі</span><strong>${formatAutonomy(calc.estimatedAutonomyHours)}</strong></div>
            <div><span>Час роботи при максимальному навантаженні</span><strong>${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}</strong></div>
          </div>
        </section>
      </ui-card>
    `;
  }
}

customElements.define('system-visualizer', SystemVisualizer);
