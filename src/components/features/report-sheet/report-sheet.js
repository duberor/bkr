import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import {
  getCriticalityLabel,
  getSolutionVariants,
  getSystemCalculation,
  getTopDrivers,
} from '../../../utils/consumer-utils.js';
import { CATEGORY_LABELS } from '../../../data/consumer-categories.js';
import {
  formatAutonomy,
  formatBattery,
  formatBatteryTopology,
  formatEnergyWh,
  formatPower,
  formatNumber,
} from '../../../utils/format.js';
import { escapeHtml } from '../../../utils/escape.js';
import styles from './report-sheet.scss?inline';

const profileLabels = {
  always: 'Постійно 24/7',
  day: 'Переважно вдень',
  evening: 'Переважно ввечері',
  night: 'Переважно вночі',
  office: 'Робочий день',
};

const batteryTypeLabels = {
  lifepo4: 'LiFePO4',
  agm: 'AGM',
  gel: 'GEL',
};

function getPrimaryBatteryConfig(calc = {}) {
  return calc?.recommendedBatteryConfigs?.[0] || null;
}

function formatBatteryBank(config = null, calc = null) {
  if (config) {
    return `${formatNumber(config.bankVoltage, 0)} V · ${formatBattery(config.bankCapacityAh)}`;
  }

  if (calc?.recommendedBatteryCapacityAh) {
    return formatBattery(calc.recommendedBatteryCapacityAh);
  }

  return '—';
}

function statusByMin(value, goodThreshold, warnThreshold) {
  if (value >= goodThreshold) return 'ok';
  if (value >= warnThreshold) return 'warn';
  return 'risk';
}

function statusByMax(value, goodThreshold, warnThreshold) {
  if (value <= goodThreshold) return 'ok';
  if (value <= warnThreshold) return 'warn';
  return 'risk';
}

class ReportSheet extends BaseElement {
  constructor() {
    super();
    this._state = { consumers: [], zones: [], systemSettings: {} };
    this._viewMode = 'focus';
  }

  styles() {
    return styles;
  }

  set state(value) {
    this._state = value || this._state;
    if (this.isConnected) this.update();
  }

  get viewMode() {
    return this._viewMode;
  }

  set viewMode(value) {
    const next = value === 'all' ? 'all' : 'focus';
    if (this._viewMode === next) return;
    this._viewMode = next;
    if (this.isConnected) this.update();
  }

  get isFocusView() {
    return this._viewMode !== 'all';
  }

  get zoneMap() {
    return new Map((this._state.zones || []).map((zone) => [zone.id, zone.name]));
  }

  get calc() {
    return getSystemCalculation(this._state.consumers, this._state.systemSettings);
  }

  get settings() {
    return this.calc.normalizedSettings || {};
  }

  get reportCalc() {
    return this.recommendedVariant?.calc || this.calc;
  }

  get reportSettings() {
    return this.reportCalc.normalizedSettings || this.settings;
  }

  get reportBestConfig() {
    return getPrimaryBatteryConfig(this.reportCalc) || this.bestConfig;
  }

  get reportConsumers() {
    return this.recommendedVariant?.consumers?.length
      ? this.recommendedVariant.consumers
      : this._state.consumers;
  }

  get bestConfig() {
    return this.calc.recommendedBatteryConfigs?.[0] || null;
  }

  get solutionVariants() {
    return getSolutionVariants(this._state.consumers, this._state.systemSettings);
  }

  get recommendedVariant() {
    return (
      this.solutionVariants.find((variant) => variant.isRecommended) ||
      this.solutionVariants[0] ||
      null
    );
  }

  get topDrivers() {
    return getTopDrivers(this.reportConsumers, this.reportSettings);
  }

  get groupedZones() {
    const groups = new Map();
    (this._state.consumers || []).forEach((consumer) => {
      const zoneName = this.zoneMap.get(consumer.zoneId) || 'Без зони';
      if (!groups.has(zoneName)) groups.set(zoneName, []);
      groups.get(zoneName).push(consumer);
    });
    return [...groups.entries()]
      .map(([zoneName, consumers]) => {
        const totalPower = consumers.reduce(
          (sum, item) => sum + Number(item.power || 0) * Number(item.quantity || 0),
          0,
        );
        const dailyEnergy = consumers.reduce(
          (sum, item) =>
            sum +
            Number(item.power || 0) * Number(item.quantity || 0) * Number(item.hoursPerDay || 0),
          0,
        );
        const surge = consumers.reduce(
          (sum, item) => sum + Number(item.surgePower || 0) * Number(item.quantity || 0),
          0,
        );
        return { zoneName, consumers, totalPower, dailyEnergy, surge };
      })
      .sort((a, b) => b.dailyEnergy - a.dailyEnergy);
  }

  get criticalPower() {
    return this.reportCalc.criticalPower || 0;
  }

  get requestedAutonomyHours() {
    return Number(this.reportCalc.targetAutonomyHours || 0);
  }

  get autonomyCoverageRatio() {
    return Number(this.reportCalc.autonomyCoverageRatio || 0);
  }

  get reserveCoverageRatio() {
    return Number(this.reportCalc.reserveCoverageRatio || 0);
  }

  get fullDcCurrent() {
    const voltage = Number(this.reportSettings.batteryVoltage || 24);
    const efficiency = Number(this.reportSettings.inverterEfficiency || 0.92);
    return voltage ? this.reportCalc.designLoadPower / Math.max(voltage * efficiency, 1) : 0;
  }

  get surgeDcCurrent() {
    const voltage = Number(this.reportSettings.batteryVoltage || 24);
    const efficiency = Number(this.reportSettings.inverterEfficiency || 0.92);
    return voltage ? this.reportCalc.totalSurgePower / Math.max(voltage * efficiency, 1) : 0;
  }

  get engineeringChecks() {
    const calc = this.reportCalc;
    const headroomPercent = calc.inverterHeadroomPercent * 100;
    const startupCoveragePercent = calc.startupCoverageRatio * 100;
    const autonomyCoveragePercent = this.autonomyCoverageRatio * 100;
    const reserveCoveragePercent = this.reserveCoverageRatio * 100;
    const designCurrent = this.fullDcCurrent;

    return [
      {
        check: 'Пусковий пік перекривається',
        value: `${formatNumber(startupCoveragePercent, 0)}%`,
        status: statusByMin(startupCoveragePercent, 100, 95),
        note: '100% і більше означає, що рекомендований інвертор перекриває розрахунковий стартовий пік.',
      },
      {
        check: 'Запас по робочому навантаженню',
        value: `${formatNumber(headroomPercent, 0)}%`,
        status: statusByMin(headroomPercent, 18, 8),
        note: 'Показує, який запас потужності лишається над робочим навантаженням системи.',
      },
      {
        check: 'DC струм при розрахунковому навантаженні',
        value: `${formatNumber(designCurrent, 0)} A`,
        status: statusByMax(designCurrent, 80, 140),
        note: 'Використовується для підбору кабелю, автомата і запобіжника.',
      },
      {
        check: 'Чи вистачає на бажаний час роботи',
        value: `${formatNumber(autonomyCoveragePercent, 0)}%`,
        status: statusByMin(autonomyCoveragePercent, 100, 90),
        note: 'Порівняння покриття добового профілю з установленою ціллю автономності.',
      },
      {
        check: 'Чи вистачає запасу енергії',
        value: `${formatNumber(reserveCoveragePercent, 0)}%`,
        status: statusByMin(reserveCoveragePercent, 100, 95),
        note: 'Перевірка, що корисної енергії АКБ вистачає на розрахунковий резерв.',
      },
    ];
  }

  get warnings() {
    const warnings = [];
    const calc = this.reportCalc;
    const voltage = Number(this.reportSettings.batteryVoltage || 24);

    if (calc.totalPower > 1200 && voltage === 12) {
      warnings.push(
        'Для такого навантаження краще перейти на 24 V або 48 V, щоб зменшити DC струми.',
      );
    }
    if (calc.startupCoverageRatio < 1 && calc.recommendedInverterPower > 0) {
      warnings.push(
        'Пусковий пік не перекривається повністю. Варто розглянути наступну модель інвертора за потужністю.',
      );
    }
    if (this.autonomyCoverageRatio < 0.9 && this.reportConsumers.length) {
      warnings.push(
        'Поточна конфігурація не забезпечує бажаний час роботи. Потрібно збільшити ємність АКБ.',
      );
    }
    if (this.reserveCoverageRatio < 0.95 && this.reportConsumers.length) {
      warnings.push('Запасу АКБ майже не залишається. Варто додати трохи ємності.');
    }
    if (!this._state.consumers.length)
      warnings.push('Щоб отримати повноцінний звіт, додайте хоча б один прилад.');

    return warnings;
  }

  get keyTakeaways() {
    const calc = this.reportCalc;
    const best = this.reportBestConfig;
    const parts = [];

    if (!this._state.consumers.length) return [];

    parts.push(
      `Навантаження, під яке підібрана система, становить ${formatPower(calc.designLoadPower)}, а пусковий пік сягає ${formatPower(calc.totalSurgePower)}.`,
    );
    parts.push(
      `Потрібно енергії без запасу: ${formatEnergyWh(calc.requiredEnergyWh)}, із запасом: ${formatEnergyWh(calc.totalEnergyWh)}.`,
    );
    if (best) {
      parts.push(
        `Базовий комплект АКБ: ${best.totalBatteries} модулів (${formatBatteryTopology(best.seriesCount, best.parallelCount)}), доступна енергія ${formatEnergyWh(best.usableStoredWh)}.`,
      );
    }
    if (calc.estimatedAutonomyHours) {
      parts.push(`Час роботи у звичному режимі: ${formatAutonomy(calc.estimatedAutonomyHours)}.`);
    }
    if (calc.continuousAutonomyHours) {
      parts.push(
        `Час роботи при максимальному навантаженні: ${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}.`,
      );
    }
    if (this.criticalPower) {
      parts.push(`Критичне навантаження становить ${formatPower(this.criticalPower)}.`);
    }

    return parts;
  }

  getSettingsRows() {
    const batteryTypeLabel =
      batteryTypeLabels[this.reportSettings.batteryType] ||
      String(this.reportSettings.batteryType || 'lifepo4').toUpperCase();
    return [
      {
        key: 'Напруга системи',
        value: `${formatNumber(this.reportSettings.batteryVoltage || 24)} V`,
      },
      { key: 'Тип акумуляторів', value: batteryTypeLabel },
      {
        key: 'Бажаний час роботи',
        value: formatAutonomy(this.reportSettings.targetAutonomyHours || 24),
      },
      {
        key: 'ККД інвертора',
        value: `${formatNumber((this.reportSettings.inverterEfficiency || 0.92) * 100, 0)}%`,
      },
      {
        key: 'Запас інвертора',
        value: `${formatNumber(this.reportSettings.reserveRatio || 1.2, 2)}×`,
      },
      {
        key: 'Запас АКБ',
        value: `${formatNumber(this.reportSettings.batteryReserveRatio || 1.15, 2)}×`,
      },
    ];
  }

  getStatusLabel(status) {
    if (status === 'ok') return 'OK';
    if (status === 'warn') return 'Увага';
    return 'Ризик';
  }

  renderRows() {
    if (!this._state.consumers.length)
      return '<tr><td colspan="11">Ще не додано жодного приладу.</td></tr>';
    return this._state.consumers
      .map((consumer, index) => {
        const totalPower = Number(consumer.power || 0) * Number(consumer.quantity || 0);
        const dailyEnergy = totalPower * Number(consumer.hoursPerDay || 0);
        return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(consumer.name)}</td>
        <td>${escapeHtml(CATEGORY_LABELS[consumer.category] || consumer.category)}</td>
        <td>${escapeHtml(this.zoneMap.get(consumer.zoneId) || '—')}</td>
        <td>${escapeHtml(getCriticalityLabel(consumer.priority || 'medium'))}</td>
        <td>${consumer.quantity}</td>
        <td>${formatPower(totalPower)}</td>
        <td>${formatPower(consumer.surgePower)}</td>
        <td>${consumer.hoursPerDay}</td>
        <td>${formatEnergyWh(dailyEnergy)}</td>
        <td>${escapeHtml(profileLabels[consumer.usageProfile] || consumer.usageProfile || '—')}</td>
      </tr>`;
      })
      .join('');
  }

  renderZoneRows() {
    if (!this.groupedZones.length) return '<tr><td colspan="6">Зони ще не створені.</td></tr>';
    const totalDaily = Math.max(this.calc.dailyConsumptionWh, 1);
    return this.groupedZones
      .map(
        (group) => `
      <tr>
        <td>${escapeHtml(group.zoneName)}</td>
        <td>${group.consumers.length}</td>
        <td>${formatPower(group.totalPower)}</td>
        <td>${formatPower(group.surge)}</td>
        <td>${formatEnergyWh(group.dailyEnergy)}</td>
        <td>${formatNumber((group.dailyEnergy / totalDaily) * 100, 0)}%</td>
      </tr>`,
      )
      .join('');
  }

  renderConfigurationRows(configs = []) {
    if (!configs.length)
      return '<tr><td colspan="9">Щоб побачити варіанти конфігурації, додайте хоча б один прилад.</td></tr>';
    return configs
      .map(
        (config, index) => `
      <tr>
        <td>${index === 0 ? 'Основний' : `Альтернатива ${index}`}</td>
        <td>${config.totalBatteries}</td>
        <td>${formatBatteryTopology(config.seriesCount, config.parallelCount)}</td>
        <td>${config.bankVoltage} V</td>
        <td>${config.bankCapacityAh} Ah</td>
        <td>${formatEnergyWh(config.totalStoredWh)}</td>
        <td>${formatEnergyWh(config.usableStoredWh)}</td>
        <td>${formatAutonomy(config.autonomyHours)}</td>
      </tr>`,
      )
      .join('');
  }

  renderSettingsRows() {
    return this.getSettingsRows()
      .map(
        (row) => `
      <tr>
        <td>${escapeHtml(row.key)}</td>
        <td>${escapeHtml(row.value)}</td>
      </tr>
    `,
      )
      .join('');
  }

  renderCheckRows() {
    return this.engineeringChecks
      .map(
        (check) => `
      <tr>
        <td>${escapeHtml(check.check)}</td>
        <td>${escapeHtml(check.value)}</td>
        <td><span class="report-sheet__status report-sheet__status--${check.status}">${this.getStatusLabel(check.status)}</span></td>
      </tr>
    `,
      )
      .join('');
  }

  renderItemList(items = []) {
    if (!items.length) {
      return '<p class="report-sheet__text-muted">Окремих обмежень для цього блоку не виявлено.</p>';
    }

    return `
      <ul class="report-sheet__list report-sheet__list--compact">
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    `;
  }

  renderVariantCards() {
    if (!this.solutionVariants.length) {
      return '<div class="report-sheet__section"><p class="report-sheet__text-muted">Щоб побачити варіанти рішення, додайте хоча б один прилад.</p></div>';
    }

    return `
      <div class="report-sheet__variant-grid">
        ${this.solutionVariants
          .map((variant) => {
            const variantConfig = getPrimaryBatteryConfig(variant.calc);

            return `
          <article class="report-sheet__variant-card ${variant.isRecommended ? 'is-recommended' : ''}">
            <div class="report-sheet__variant-head">
              <div>
                <span class="report-sheet__tag ${variant.isRecommended ? 'report-sheet__tag--key' : 'report-sheet__tag--info'}">${variant.isRecommended ? 'Рекомендовано' : 'Варіант'}</span>
                <h4>${variant.title}</h4>
              </div>
            </div>
            <div class="report-sheet__metric-grid">
              <div><span>Інвертор</span><strong>${formatPower(variant.calc.recommendedInverterPower)}</strong></div>
              <div><span>Комплект АКБ</span><strong>${formatBatteryBank(variantConfig, variant.calc)}</strong></div>
              <div><span>Час роботи</span><strong>${formatAutonomy(variant.calc.estimatedAutonomyHours)}</strong></div>
              <div><span>Пусковий пік</span><strong>${formatPower(variant.calc.totalSurgePower)}</strong></div>
            </div>
            <div class="report-sheet__compact-grid">
              <section class="report-sheet__section report-sheet__variant-list report-sheet__variant-list--active">
                <div class="report-sheet__title-row">
                  <h3>Що працюватиме</h3>
                </div>
                ${this.renderItemList(variant.activeItems)}
              </section>
              <section class="report-sheet__section report-sheet__variant-list report-sheet__variant-list--deferred">
                <div class="report-sheet__title-row">
                  <h3>Що краще не вмикати</h3>
                </div>
                ${this.renderItemList(variant.deferredItems)}
              </section>
            </div>
          </article>
        `;
          })
          .join('')}
      </div>
    `;
  }

  renderViewSwitch() {
    return `
      <div class="report-sheet__view-switch" role="tablist" aria-label="Режим перегляду звіту">
        <button type="button" data-view-mode="focus" class="report-sheet__view-btn ${this.isFocusView ? 'is-active' : ''}" role="tab" aria-selected="${this.isFocusView ? 'true' : 'false'}">Головне</button>
        <button type="button" data-view-mode="all" class="report-sheet__view-btn ${this.isFocusView ? '' : 'is-active'}" role="tab" aria-selected="${this.isFocusView ? 'false' : 'true'}">Повний звіт</button>
      </div>
    `;
  }

  render() {
    const calc = this.reportCalc;
    const best = this.reportBestConfig;
    const recommendedVariant = this.recommendedVariant;
    const voltage = Number(this.reportSettings.batteryVoltage || 24);
    const criticalRuntime = calc.criticalAutonomyHours;
    const configs = this.isFocusView
      ? calc.recommendedBatteryConfigs.slice(0, 1)
      : calc.recommendedBatteryConfigs;
    const batteryTypeLabel =
      batteryTypeLabels[this.reportSettings.batteryType] ||
      String(this.reportSettings.batteryType || 'lifepo4').toUpperCase();
    const recommendedBankLabel = formatBatteryBank(best, calc);
    const recommendedTopology = best
      ? `${best.totalBatteries} АКБ (${formatBatteryTopology(best.seriesCount, best.parallelCount)})`
      : formatBattery(calc.recommendedBatteryCapacityAh);

    return `
      <ui-card padding="lg">
        <article class="report-sheet">
          <header class="report-sheet__head">
            <div>
              <p class="report-sheet__eyebrow">Підсумковий звіт</p>
              <h2>Готовий звіт по системі</h2>
            </div>
            <div class="report-sheet__meta">
              <span>${voltage} V</span>
              <span>${batteryTypeLabel}</span>
              <span>${formatAutonomy(this.reportSettings.targetAutonomyHours || 24)}</span>
              <span>ККД ${formatNumber((this.reportSettings.inverterEfficiency || 0.92) * 100, 0)}%</span>
            </div>
          </header>

          ${this.renderViewSwitch()}

          <section class="report-sheet__section report-sheet__section--accent report-sheet__section--summary">
            <div class="report-sheet__title-row">
              <h3>Короткий висновок</h3>
              <span class="report-sheet__tag report-sheet__tag--key">Ключове</span>
            </div>
            <p class="report-sheet__summary-text">
              ${
                this._state.consumers.length
                  ? `Для цього сценарію найкраще підходить варіант «${recommendedVariant?.title || 'Баланс'}». Він розрахований на ${formatPower(calc.designLoadPower)} робочого навантаження, враховує пусковий пік ${formatPower(calc.totalSurgePower)} і дає приблизно ${formatAutonomy(calc.estimatedAutonomyHours)} роботи у звичному режимі. Рекомендований комплект: інвертор ${formatPower(calc.recommendedInverterPower)} і батарейний банк ${recommendedBankLabel}${best ? ` (${recommendedTopology})` : ''}.`
                  : 'Додайте прилади, щоб отримати повноцінний підсумок по системі.'
              }
            </p>
          </section>

          <section class="report-sheet__hero-grid">
            <div class="report-sheet__hero-card report-sheet__hero-card--accent">
              <span>Рекомендований інвертор</span>
              <strong>${this._state.consumers.length ? formatPower(calc.recommendedInverterPower) : 'Додайте прилади'}</strong>
            </div>
            <div class="report-sheet__hero-card">
              <span>Комплект АКБ</span>
              <strong>${this._state.consumers.length ? recommendedBankLabel : 'Додайте прилади'}</strong>
            </div>
            <div class="report-sheet__hero-card">
              <span>Час роботи у звичному режимі</span>
              <strong>${formatAutonomy(calc.estimatedAutonomyHours)}</strong>
            </div>
            <div class="report-sheet__hero-card">
              <span>Пусковий пік, який враховано</span>
              <strong>${formatPower(calc.totalSurgePower)}</strong>
            </div>
          </section>

          <section class="report-sheet__section report-sheet__section--variants">
            <div class="report-sheet__title-row">
              <h3>Варіанти рішення</h3>
              <span class="report-sheet__tag report-sheet__tag--key">Ключове</span>
            </div>
            ${this.renderVariantCards()}
          </section>

          ${
            this.isFocusView
              ? `
          <section class="report-sheet__section report-sheet__section--warnings">
            <div class="report-sheet__title-row">
              <h3>Попередження</h3>
              <span class="report-sheet__tag report-sheet__tag--key">Ключове</span>
            </div>
            <ul class="report-sheet__list report-sheet__list--warning report-sheet__list--compact">
              ${(this.warnings.length ? this.warnings : ['Критичних зауважень для поточної моделі не виявлено.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </section>
          `
              : `
          <section class="report-sheet__section report-sheet__section--drivers">
            <div class="report-sheet__title-row">
              <h3>Що найбільше вплинуло на рішення</h3>
              <span class="report-sheet__tag report-sheet__tag--key">Ключове</span>
            </div>
            ${this.renderItemList(this.topDrivers)}
          </section>
          `
          }

          ${
            this.isFocusView
              ? ''
              : `
          <section class="report-sheet__compact-grid report-sheet__compact-grid--core">
            <section class="report-sheet__section">
              <div class="report-sheet__title-row">
              <h3>Вихідні параметри</h3>
                <span class="report-sheet__tag report-sheet__tag--info">Довідково</span>
              </div>
              <div class="report-sheet__table-wrap">
                <table class="report-sheet__table report-sheet__table--compact">
                  <thead>
                    <tr>
                      <th>Параметр</th>
                      <th>Значення</th>
                    </tr>
                  </thead>
                  <tbody>${this.renderSettingsRows()}</tbody>
                </table>
              </div>
            </section>
          </section>
          `
          }

          ${
            this.isFocusView
              ? ''
              : `
          <section class="report-sheet__section report-sheet__section--checks">
            <div class="report-sheet__title-row">
              <h3>Ключові перевірки</h3>
              <span class="report-sheet__tag report-sheet__tag--key">Ключове</span>
            </div>
            <div class="report-sheet__table-wrap">
              <table class="report-sheet__table">
                <thead>
                  <tr>
                    <th>Перевірка</th>
                    <th>Значення</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>${this.renderCheckRows()}</tbody>
              </table>
            </div>
          </section>
          `
          }

          ${
            this.isFocusView
              ? ''
              : `
          <section class="report-sheet__section report-sheet__section--battery-options">
            <div class="report-sheet__title-row">
              <h3>Варіанти АКБ</h3>
              <span class="report-sheet__tag ${this.isFocusView ? 'report-sheet__tag--key' : 'report-sheet__tag--info'}">${this.isFocusView ? 'Ключове' : 'Довідково'}</span>
            </div>
            <div class="report-sheet__table-wrap">
              <table class="report-sheet__table">
                <thead>
                  <tr>
                    <th>Варіант</th>
                    <th>АКБ</th>
                    <th>З'єднання модулів</th>
                    <th>Напруга</th>
                    <th>Ємність</th>
                    <th>Повна енергія</th>
                    <th>Доступна енергія</th>
                    <th>Час роботи у звичному режимі</th>
                  </tr>
                </thead>
                <tbody>${this.renderConfigurationRows(configs)}</tbody>
              </table>
            </div>
          </section>
          `
          }

          ${
            this.isFocusView
              ? ''
              : `
          <section class="report-sheet__compact-grid report-sheet__compact-grid--runtime">
            <section class="report-sheet__section report-sheet__section--runtime">
              <div class="report-sheet__title-row">
              <h3>Скільки працюватиме система</h3>
                <span class="report-sheet__tag report-sheet__tag--key">Ключове</span>
              </div>
              <div class="report-sheet__metric-grid">
                <div><span>Час роботи у звичному режимі</span><strong>${formatAutonomy(calc.estimatedAutonomyHours)}</strong></div>
                <div><span>Час роботи при максимальному навантаженні</span><strong>${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}</strong></div>
                <div><span>DC струм при розрахунковому навантаженні</span><strong>${formatNumber(this.fullDcCurrent, 0)} A</strong></div>
                <div><span>Час роботи для критичних приладів</span><strong>${formatAutonomy(criticalRuntime, { preferDays: false })}</strong></div>
              </div>
            </section>

            <section class="report-sheet__section report-sheet__section--warnings">
              <div class="report-sheet__title-row">
                <h3>Попередження</h3>
                <span class="report-sheet__tag report-sheet__tag--key">Ключове</span>
              </div>
              <ul class="report-sheet__list report-sheet__list--warning report-sheet__list--compact">
                ${(this.warnings.length ? this.warnings : ['Критичних зауважень для поточної моделі не виявлено.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </section>
          </section>
          `
          }

          ${
            this.isFocusView
              ? ''
              : `
          <section class="report-sheet__section report-sheet__section--zones">
            <div class="report-sheet__title-row">
              <h3>Підсумки по зонах</h3>
              <span class="report-sheet__tag report-sheet__tag--info">Довідково</span>
            </div>
            <div class="report-sheet__table-wrap">
              <table class="report-sheet__table">
                <thead>
                  <tr>
                    <th>Зона</th>
                    <th>Приладів</th>
                    <th>Робоча</th>
                    <th>Пускова</th>
                    <th>За добу</th>
                    <th>Частка</th>
                  </tr>
                </thead>
                <tbody>${this.renderZoneRows()}</tbody>
              </table>
            </div>
          </section>

          <section class="report-sheet__section report-sheet__section--devices">
            <div class="report-sheet__title-row">
              <h3>Детальний перелік приладів</h3>
              <span class="report-sheet__tag report-sheet__tag--info">Довідково</span>
            </div>
            <div class="report-sheet__table-wrap">
              <table class="report-sheet__table report-sheet__table--devices">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Прилад</th>
                    <th>Категорія</th>
                    <th>Зона</th>
                    <th>Пріоритет</th>
                    <th>К-сть</th>
                    <th>Робоча</th>
                    <th>Пускова</th>
                    <th>Год/добу</th>
                    <th>За добу</th>
                    <th>Профіль</th>
                  </tr>
                </thead>
                <tbody>${this.renderRows()}</tbody>
              </table>
            </div>
          </section>
          `
          }
        </article>
      </ui-card>
    `;
  }

  afterRender() {
    this.shadowRoot.querySelectorAll('[data-view-mode]').forEach((button) => {
      button.addEventListener('click', this.handleViewModeSwitch);
    });
  }

  handleViewModeSwitch = (event) => {
    const nextMode = event.currentTarget?.dataset?.viewMode;
    if (!nextMode) return;
    this.viewMode = nextMode;
  };
}

customElements.define('report-sheet', ReportSheet);
