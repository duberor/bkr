import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatNumber } from '../../../utils/format.js';
import styles from './system-checks.scss?inline';

function statusByMin(value, good, warn) {
  if (value >= good) return 'ok';
  if (value >= warn) return 'warn';
  return 'risk';
}

function statusByMax(value, good, warn) {
  if (value <= good) return 'ok';
  if (value <= warn) return 'warn';
  return 'risk';
}

const STATUS_ICON = { ok: '✓', warn: '!', risk: '✕' };
const STATUS_LABEL = { ok: 'ок', warn: 'увага', risk: 'проблема' };

class SystemChecks extends BaseElement {
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

  getChecks() {
    const calc = getSystemCalculation(this._items, this._settings);
    if (!this._items.length) return [];

    const headroom = calc.inverterHeadroomPercent * 100;
    const startupCoverage = calc.startupCoverageRatio * 100;
    const voltage = Number(this._settings.batteryVoltage || 24);
    const efficiency = Number(this._settings.inverterEfficiency || 0.92);
    const dcCurrent = voltage ? calc.designLoadPower / Math.max(voltage * efficiency, 1) : 0;

    const best = calc.recommendedBatteryConfigs?.[0];
    const usable = best?.usableStoredWh || 0;
    const required = calc.requiredEnergyWh || 1;
    const autonomyCoverage = (usable / Math.max(required, 1)) * 100;

    const checks = [];

    // 1. Inverter covers startup
    checks.push({
      label: startupCoverage >= 100
        ? 'Інвертор витримає пуск усіх приладів'
        : 'Пусковий пік не перекривається повністю',
      value: `${formatNumber(startupCoverage, 0)}%`,
      status: statusByMin(startupCoverage, 100, 95),
    });

    // 2. Inverter headroom
    checks.push({
      label: headroom >= 15
        ? `Запас інвертора ${formatNumber(headroom, 0)}%`
        : `Мало запасу інвертора - лише ${formatNumber(headroom, 0)}%`,
      value: `${formatNumber(headroom, 0)}%`,
      status: statusByMin(headroom, 18, 8),
    });

    // 3. Autonomy coverage
    checks.push({
      label: autonomyCoverage >= 100
        ? 'Акумуляторів вистачає на бажаний час'
        : 'Акумуляторів не вистачає на бажаний час',
      value: `${formatNumber(autonomyCoverage, 0)}%`,
      status: statusByMin(autonomyCoverage, 100, 90),
    });

    // 4. Voltage warning
    if (calc.totalPower > 1200 && voltage === 12) {
      checks.push({
        label: 'При такому навантаженні краще 24V або 48V',
        value: `${voltage}V`,
        status: 'warn',
      });
    }

    // 5. High surge consumers
    const maxSurge = this._items.reduce((max, c) => {
      const surge = Number(c.surgePower || 0);
      return surge > max.surge ? { name: c.name, surge } : max;
    }, { name: '', surge: 0 });

    if (maxSurge.surge > calc.recommendedInverterPower * 0.7) {
      checks.push({
        label: `${maxSurge.name} при пуску бере ${formatNumber(maxSurge.surge, 0)} W - обережно з одночасним пуском`,
        value: `${formatNumber(maxSurge.surge, 0)} W`,
        status: 'warn',
      });
    }

    return checks;
  }

  render() {
    const checks = this.getChecks();
    if (!checks.length) {
      return `
        <ui-card padding="md">
          <section class="checks">
            <h2>Перевірки</h2>
            <p class="checks__empty">Додайте прилади, щоб побачити перевірки системи.</p>
          </section>
        </ui-card>
      `;
    }

    return `
      <ui-card padding="md">
        <section class="checks">
          <h2>Все в порядку?</h2>
          <div class="checks__list">
            ${checks.map(c => `
              <div class="checks__row checks__row--${c.status}">
                <span class="checks__icon checks__icon--${c.status}">${STATUS_ICON[c.status]}</span>
                <span class="checks__label">${c.label}</span>
                <span class="checks__badge checks__badge--${c.status}">${STATUS_LABEL[c.status]}</span>
              </div>
            `).join('')}
          </div>
        </section>
      </ui-card>
    `;
  }
}

customElements.define('system-checks', SystemChecks);
