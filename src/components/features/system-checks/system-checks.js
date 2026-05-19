import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import { getRecommendedBatteryVoltage, getSystemCalculation } from '../../../utils/consumer-utils.js';
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

  set baseSettings(value) {
    this._baseSettings = value || null;
    if (this.isConnected) this.update();
  }

  set excludedItems(value) {
    this._excludedItems = Array.isArray(value) ? value : [];
    if (this.isConnected) this.update();
  }

  getChecks() {
    const calc = getSystemCalculation(this._items, this._settings);
    if (!this._items.length) return [];

    const headroom = calc.inverterHeadroomPercent * 100;
    const startupCoverage = calc.startupCoverageRatio * 100;
    const voltage = Number(this._settings.batteryVoltage || 24);
    const efficiency = Number(
      calc.effectiveSettings?.effectiveInverterEfficiency ||
        this._settings.inverterEfficiency ||
        0.92,
    );
    const dcCurrent = voltage ? calc.designLoadPower / Math.max(voltage * efficiency, 1) : 0;

    const best = calc.selectedBatteryConfig || calc.recommendedBatteryConfigs?.[0];
    const usable = best?.usableStoredWh || 0;
    // Покриття вимірюємо проти ЦІЛІ КОРИСТУВАЧА (baseSettings.targetAutonomyHours),
    // інакше всі варіанти показують ~100% і блок не реагує на вибір.
    const baseTargetHours = Number(
      this._baseSettings?.targetAutonomyHours || this._settings.targetAutonomyHours || 24,
    );
    const dailyWh = calc.dailyConsumptionWh || 0;
    const baseRequired = (dailyWh * baseTargetHours) / 24;
    const autonomyCoverage = baseRequired > 0
      ? (usable / baseRequired) * 100
      : (usable / Math.max(calc.requiredEnergyWh || 1, 1)) * 100;

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

    // 3. Autonomy coverage relative to user's target
    const actualAutonomyHours = Number(calc.estimatedAutonomyHours || 0);
    checks.push({
      label: autonomyCoverage >= 100
        ? `Цього вистачить на ${formatNumber(actualAutonomyHours, 1)} год — більше за бажане`
        : `На бажаний час не вистачить: вистачить лише на ${formatNumber(actualAutonomyHours, 1)} год`,
      value: `${formatNumber(autonomyCoverage, 0)}%`,
      status: statusByMin(autonomyCoverage, 100, 90),
    });

    // 4. Voltage warning — тільки якщо поточна напруга НИЖЧА за рекомендовану.
    // Якщо користувач у auto-режимі, напруга вже = рекомендована, тож не показуємо.
    const recommendedVoltage = getRecommendedBatteryVoltage(this._items, this._settings);
    if (voltage < recommendedVoltage) {
      checks.push({
        label: `Для такого навантаження краще ${recommendedVoltage}V замість ${voltage}V`,
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

    // 6. Excluded items (для варіанту «Без необов'язкового»)
    const excluded = Array.isArray(this._excludedItems) ? this._excludedItems : [];
    if (excluded.length) {
      checks.push({
        label: `У цьому варіанті прибрано: ${excluded.join(', ')}`,
        value: `−${excluded.length}`,
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
