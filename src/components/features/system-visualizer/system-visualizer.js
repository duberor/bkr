import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import {
  formatAutonomy,
  formatBattery,
  formatEnergyWh,
  formatNumber,
  formatPower,
} from '../../../utils/format.js';
import styles from './system-visualizer.scss?inline';

class SystemVisualizer extends BaseElement {
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

  render() {
    const calc = getSystemCalculation(this._items, this._settings);
    const voltage = Number(calc.normalizedSettings?.batteryVoltage || 24);
    const efficiency = Number(calc.normalizedSettings?.inverterEfficiency || 0.92);
    const designDcCurrent = voltage ? calc.designLoadPower / Math.max(voltage * efficiency, 1) : 0;
    const surgeDcCurrent = voltage ? calc.totalSurgePower / Math.max(voltage * efficiency, 1) : 0;
    const best = calc.recommendedBatteryConfigs?.[0] || null;
    const usableEnergyWh = Number(best?.usableStoredWh || calc.usableBatteryEnergyWh || 0);
    const totalBatteries = best?.totalBatteries || 0;

    return `
      <ui-card padding="md">
        <section class="visualizer">
          <div class="visualizer__head">
            <p class="visualizer__eyebrow">Схема підключення</p>
            <h2>Як працює система</h2>
          </div>

          <p class="visualizer__explain">
            Інвертор - центр системи. Коли мережа є, він пропускає 220V на прилади і заряджає батареї.
            Коли мережа зникає - бере енергію з батарей і перетворює її в 220V. Перемикання за 5-20 мс.
          </p>

          <div class="visualizer__scheme-card">
            <p class="visualizer__side-label">AC - змінний струм 220V</p>

            <div class="visualizer__flow">
              <div class="node"><span>Вхід</span><strong>Мережа 220V</strong></div>
              <div class="arrow">→</div>
              <div class="node node--accent">
                <span>Інвертор / зарядний</span>
                <strong>${formatPower(calc.recommendedInverterPower)}</strong>
                <em>ATS + заряд + перетворення</em>
              </div>
              <div class="arrow">→</div>
              <div class="node"><span>Прилади</span><strong>${formatPower(calc.totalPower)}</strong></div>
            </div>

            <div class="visualizer__connector">
              <div class="visualizer__connector-line"></div>
              <span>↕</span>
              <div class="visualizer__connector-line"></div>
            </div>

            <p class="visualizer__side-label">DC - постійний струм ${voltage}V</p>

            <div class="visualizer__flow visualizer__flow--battery">
              <div class="node node--battery">
                <span>Батареї</span>
                <strong>${totalBatteries ? totalBatteries + ' шт' : formatBattery(calc.recommendedBatteryCapacityAh)}</strong>
                <em>${voltage}V · ${formatBattery(calc.recommendedBatteryCapacityAh)}</em>
              </div>
              <div class="arrow">⇄</div>
              <div class="node"><span>DC захист</span><strong>Автомат ${formatNumber(designDcCurrent, 0)}A</strong></div>
            </div>
          </div>

          <div class="visualizer__tip">
            ${formatEnergyWh(usableEnergyWh)} доступної енергії -
            це ${calc.estimatedAutonomyHours ? formatAutonomy(calc.estimatedAutonomyHours) : '—'} роботи
            при звичному використанні приладів.
          </div>

          <div class="visualizer__metrics">
            <div><span>Розрахункове навантаження</span><strong>${formatPower(calc.designLoadPower)}</strong></div>
            <div><span>Пусковий пік</span><strong>${formatPower(calc.totalSurgePower)}</strong></div>
            <div><span>Час при звичному використанні</span><strong>${formatAutonomy(calc.estimatedAutonomyHours)}</strong></div>
            <div><span>Час при максимальному навантаженні</span><strong>${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}</strong></div>
          </div>
        </section>
      </ui-card>
    `;
  }
}

customElements.define('system-visualizer', SystemVisualizer);
