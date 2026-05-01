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

const TOPOLOGY_INFO = {
  'offline': {
    name: 'Off-line (Standby)',
    desc: 'Прилади живляться від мережі напряму. Інвертор вмикається тільки коли мережа зникає. Перемикання займає 5-20 мс. Найпростіший і найдешевший варіант.',
  },
  'line-interactive': {
    name: 'Line-interactive',
    desc: 'Інвертор постійно підключений і стабілізує напругу. При зникненні мережі перемикається на батареї за 2-5 мс. Найпоширеніший варіант для дому.',
  },
  'online': {
    name: 'On-line (подвійне перетворення)',
    desc: 'Прилади завжди живляться від інвертора. Мережа лише заряджає батареї. Нульовий час перемикання. Для серверів та медичного обладнання.',
  },
};

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

  renderOfflineSchema(calc, voltage, designDcCurrent, totalBatteries) {
    const hasGen = this._settings.hasGenerator;
    return `
      <p class="visualizer__side-label">AC - змінний струм 220V</p>
      <div class="visualizer__flow">
        <div class="node">
          <span>${hasGen ? 'Мережа / Генератор' : 'Мережа 220V'}</span>
          <strong>Вхід AC</strong>
        </div>
        <div class="arrow">→</div>
        <div class="node">
          <span>Перемикач</span>
          <strong>Реле / ATS</strong>
          <em>перемикання 5-20 мс</em>
        </div>
        <div class="arrow">→</div>
        <div class="node"><span>Прилади</span><strong>${formatPower(calc.totalPower)}</strong></div>
      </div>

      <div class="visualizer__connector">
        <div class="visualizer__connector-line"></div>
        <span>↕</span>
        <div class="visualizer__connector-line"></div>
      </div>

      <p class="visualizer__side-label">DC - постійний струм ${voltage}V (резерв)</p>
      <div class="visualizer__flow visualizer__flow--battery">
        <div class="node node--accent">
          <span>Інвертор</span>
          <strong>${formatPower(calc.recommendedInverterPower)}</strong>
          <em>DC → AC при відключенні</em>
        </div>
        <div class="arrow">⇄</div>
        <div class="node node--battery">
          <span>Батареї</span>
          <strong>${totalBatteries ? totalBatteries + ' шт' : formatBattery(calc.recommendedBatteryCapacityAh)}</strong>
          <em>${voltage}V · ${formatBattery(calc.recommendedBatteryCapacityAh)}</em>
        </div>
      </div>
    `;
  }

  renderLineInteractiveSchema(calc, voltage, designDcCurrent, totalBatteries) {
    const hasGen = this._settings.hasGenerator;
    return `
      <p class="visualizer__side-label">AC - змінний струм 220V</p>
      <div class="visualizer__flow">
        <div class="node">
          <span>${hasGen ? 'Мережа / Генератор' : 'Мережа 220V'}</span>
          <strong>Вхід AC</strong>
        </div>
        <div class="arrow">→</div>
        <div class="node node--accent">
          <span>Інвертор / зарядний</span>
          <strong>${formatPower(calc.recommendedInverterPower)}</strong>
          <em>ATS + стабілізація + заряд</em>
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
    `;
  }

  renderOnlineSchema(calc, voltage, designDcCurrent, totalBatteries) {
    const hasGen = this._settings.hasGenerator;
    return `
      <p class="visualizer__side-label">AC вхід</p>
      <div class="visualizer__flow visualizer__flow--online">
        <div class="node">
          <span>${hasGen ? 'Мережа / Генератор' : 'Мережа 220V'}</span>
          <strong>Вхід AC</strong>
        </div>
        <div class="arrow">→</div>
        <div class="node node--accent">
          <span>Випрямляч + зарядний</span>
          <strong>AC → DC</strong>
          <em>постійний заряд батарей</em>
        </div>
      </div>

      <div class="visualizer__connector">
        <div class="visualizer__connector-line"></div>
        <span>↕</span>
        <div class="visualizer__connector-line"></div>
      </div>

      <p class="visualizer__side-label">DC шина ${voltage}V</p>
      <div class="visualizer__flow visualizer__flow--battery">
        <div class="node node--battery">
          <span>Батареї</span>
          <strong>${totalBatteries ? totalBatteries + ' шт' : formatBattery(calc.recommendedBatteryCapacityAh)}</strong>
          <em>${voltage}V · ${formatBattery(calc.recommendedBatteryCapacityAh)}</em>
        </div>
        <div class="arrow">⇄</div>
        <div class="node"><span>DC захист</span><strong>Автомат ${formatNumber(designDcCurrent, 0)}A</strong></div>
      </div>

      <div class="visualizer__connector">
        <div class="visualizer__connector-line"></div>
        <span>↕</span>
        <div class="visualizer__connector-line"></div>
      </div>

      <p class="visualizer__side-label">AC вихід (завжди від інвертора)</p>
      <div class="visualizer__flow visualizer__flow--battery">
        <div class="node node--accent">
          <span>Інвертор</span>
          <strong>${formatPower(calc.recommendedInverterPower)}</strong>
          <em>DC → AC, 0 мс перемикання</em>
        </div>
        <div class="arrow">→</div>
        <div class="node"><span>Прилади</span><strong>${formatPower(calc.totalPower)}</strong></div>
      </div>
    `;
  }

  render() {
    const calc = getSystemCalculation(this._items, this._settings);
    const topology = this._settings.topology || 'line-interactive';
    const voltage = Number(calc.normalizedSettings?.batteryVoltage || 24);
    const efficiency = Number(calc.normalizedSettings?.inverterEfficiency || 0.92);
    const designDcCurrent = voltage ? calc.designLoadPower / Math.max(voltage * efficiency, 1) : 0;
    const best = calc.recommendedBatteryConfigs?.[0] || null;
    const usableEnergyWh = Number(best?.usableStoredWh || calc.usableBatteryEnergyWh || 0);
    const totalBatteries = best?.totalBatteries || 0;
    const info = TOPOLOGY_INFO[topology] || TOPOLOGY_INFO['line-interactive'];

    let schemaHtml = '';
    if (topology === 'offline') {
      schemaHtml = this.renderOfflineSchema(calc, voltage, designDcCurrent, totalBatteries);
    } else if (topology === 'online') {
      schemaHtml = this.renderOnlineSchema(calc, voltage, designDcCurrent, totalBatteries);
    } else {
      schemaHtml = this.renderLineInteractiveSchema(calc, voltage, designDcCurrent, totalBatteries);
    }

    return `
      <ui-card padding="md">
        <section class="visualizer">
          <div class="visualizer__head">
            <p class="visualizer__eyebrow">Схема підключення</p>
            <h2>Як працює система</h2>
          </div>

          <div class="visualizer__topology-badge">
            <span class="visualizer__topology-name">${info.name}</span>
          </div>

          <p class="visualizer__explain">${info.desc}</p>

          <div class="visualizer__scheme-card">
            ${schemaHtml}
          </div>

          <div class="visualizer__tip">
            ${formatEnergyWh(usableEnergyWh)} доступної енергії -
            це ${calc.estimatedAutonomyHours ? formatAutonomy(calc.estimatedAutonomyHours) : '\u2014'} роботи
            при звичному використанні приладів.
          </div>

          <div class="visualizer__metrics">
            <div><span>Розрахункове навантаження</span><strong>${formatPower(calc.designLoadPower)}</strong></div>
            <div><span>Пусковий пік</span><strong>${formatPower(calc.totalSurgePower)}</strong></div>
            <div><span>Час при звичному використанні</span><strong>${formatAutonomy(calc.estimatedAutonomyHours)}</strong></div>
            <div><span>Час при макс. навантаженні</span><strong>${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}</strong></div>
          </div>
        </section>
      </ui-card>
    `;
  }
}

customElements.define('system-visualizer', SystemVisualizer);
