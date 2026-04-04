import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import { CATEGORY_LABELS } from '../../../data/consumer-categories.js';
import { formatAutonomy, formatBattery, formatEnergyWh, formatPower, formatNumber } from '../../../utils/format.js';
import { escapeHtml } from '../../../utils/escape.js';
import styles from './report-sheet.scss?inline';

const profileLabels = {
  always: 'Постійно 24/7',
  day: 'Переважно вдень',
  evening: 'Переважно ввечері',
  night: 'Переважно вночі',
  office: 'Робочий день',
};

const priorityLabels = {
  high: 'Високий',
  medium: 'Середній',
  low: 'Низький',
};

const batteryTypeLabels = {
  lifepo4: 'LiFePO4',
  agm: 'AGM',
  gel: 'GEL',
};

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

  styles() { return styles; }

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

  get bestConfig() {
    return this.calc.recommendedBatteryConfigs?.[0] || null;
  }

  get groupedZones() {
    const groups = new Map();
    (this._state.consumers || []).forEach((consumer) => {
      const zoneName = this.zoneMap.get(consumer.zoneId) || 'Без зони';
      if (!groups.has(zoneName)) groups.set(zoneName, []);
      groups.get(zoneName).push(consumer);
    });
    return [...groups.entries()].map(([zoneName, consumers]) => {
      const totalPower = consumers.reduce((sum, item) => sum + Number(item.power || 0) * Number(item.quantity || 0), 0);
      const dailyEnergy = consumers.reduce((sum, item) => sum + Number(item.power || 0) * Number(item.quantity || 0) * Number(item.hoursPerDay || 0), 0);
      const surge = consumers.reduce((sum, item) => sum + Number(item.surgePower || 0) * Number(item.quantity || 0), 0);
      return { zoneName, consumers, totalPower, dailyEnergy, surge };
    }).sort((a, b) => b.dailyEnergy - a.dailyEnergy);
  }

  get criticalPower() {
    return this.calc.criticalPower || 0;
  }

  get requestedAutonomyHours() {
    return Number(this.calc.targetAutonomyHours || 0);
  }

  get autonomyCoverageRatio() {
    return Number(this.calc.autonomyCoverageRatio || 0);
  }

  get reserveCoverageRatio() {
    return Number(this.calc.reserveCoverageRatio || 0);
  }

  get fullDcCurrent() {
    const voltage = Number(this.settings.batteryVoltage || 24);
    const efficiency = Number(this.settings.inverterEfficiency || 0.92);
    return voltage ? this.calc.designLoadPower / Math.max(voltage * efficiency, 1) : 0;
  }

  get surgeDcCurrent() {
    const voltage = Number(this.settings.batteryVoltage || 24);
    const efficiency = Number(this.settings.inverterEfficiency || 0.92);
    return voltage ? this.calc.totalSurgePower / Math.max(voltage * efficiency, 1) : 0;
  }

  get engineeringChecks() {
    const headroomPercent = this.calc.inverterHeadroomPercent * 100;
    const autonomyCoveragePercent = this.autonomyCoverageRatio * 100;
    const reserveCoveragePercent = this.reserveCoverageRatio * 100;
    const designCurrent = this.fullDcCurrent;

    return [
      {
        check: 'Запас інвертора на старті',
        value: `${formatNumber(headroomPercent, 0)}%`,
        status: statusByMin(headroomPercent, 18, 8),
        note: 'Бажано тримати запас не менше 15-20% від пускового піку.',
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
    const calc = this.calc;
    const voltage = Number(this.settings.batteryVoltage || 24);

    if (calc.totalPower > 1200 && voltage === 12) {
      warnings.push('Для такого навантаження краще перейти на 24 V або 48 V, щоб зменшити DC струми.');
    }
    if (calc.inverterHeadroomPercent < 0.1 && calc.recommendedInverterPower > 0) {
      warnings.push('Запас інвертора на старті замалий. Розгляньте наступну модель за потужністю.');
    }
    if (this.autonomyCoverageRatio < 0.9 && this._state.consumers.length) {
      warnings.push('Поточна конфігурація не забезпечує бажаний час роботи. Потрібно збільшити ємність АКБ.');
    }
    if (this.reserveCoverageRatio < 0.95 && this._state.consumers.length) {
      warnings.push('Запасу АКБ майже не залишається. Варто додати трохи ємності.');
    }
    if (!this._state.consumers.length) warnings.push('Щоб отримати повноцінний звіт, додайте хоча б один прилад.');

    return warnings;
  }

  get keyTakeaways() {
    const calc = this.calc;
    const best = this.bestConfig;
    const parts = [];

    if (!this._state.consumers.length) return [];

      parts.push(`Навантаження, під яке підібрана система, становить ${formatPower(calc.designLoadPower)}, а пусковий пік сягає ${formatPower(calc.totalSurgePower)}.`);
      parts.push(`Потрібно енергії без запасу: ${formatEnergyWh(calc.requiredEnergyWh)}, із запасом: ${formatEnergyWh(calc.totalEnergyWh)}.`);
      if (best) {
        parts.push(`Базовий комплект АКБ: ${best.totalBatteries} модулів (${best.seriesCount}S/${best.parallelCount}P), доступна енергія ${formatEnergyWh(best.usableStoredWh)}.`);
      }
      if (calc.estimatedAutonomyHours) {
        parts.push(`Час роботи у звичному режимі: ${formatAutonomy(calc.estimatedAutonomyHours)}.`);
      }
      if (calc.continuousAutonomyHours) {
        parts.push(`Час роботи при максимальному навантаженні: ${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}.`);
      }
    if (this.criticalPower) {
      parts.push(`Критичне навантаження становить ${formatPower(this.criticalPower)}.`);
    }

    return parts;
  }

  getSettingsRows() {
    const batteryTypeLabel = batteryTypeLabels[this.settings.batteryType] || String(this.settings.batteryType || 'lifepo4').toUpperCase();
    return [
      { key: 'Напруга системи', value: `${formatNumber(this.settings.batteryVoltage || 24)} V` },
      { key: 'Тип акумуляторів', value: batteryTypeLabel },
      { key: 'Бажаний час роботи', value: `${formatNumber(this.settings.autonomyDays || 1, 1)} доби` },
      { key: 'ККД інвертора', value: `${formatNumber((this.settings.inverterEfficiency || 0.92) * 100, 0)}%` },
      { key: 'Запас інвертора', value: `${formatNumber(this.settings.reserveRatio || 1.2, 2)}×` },
      { key: 'Одночасність роботи', value: `${formatNumber(this.settings.simultaneityFactor || 0.85, 2)}` },
      { key: 'Запас АКБ', value: `${formatNumber(this.settings.batteryReserveRatio || 1.15, 2)}×` },
    ];
  }

  getStatusLabel(status) {
    if (status === 'ok') return 'OK';
    if (status === 'warn') return 'Увага';
    return 'Ризик';
  }

  renderRows() {
    if (!this._state.consumers.length) return '<tr><td colspan="11">Ще не додано жодного приладу.</td></tr>';
    return this._state.consumers.map((consumer, index) => {
      const totalPower = Number(consumer.power || 0) * Number(consumer.quantity || 0);
      const dailyEnergy = totalPower * Number(consumer.hoursPerDay || 0);
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(consumer.name)}</td>
        <td>${escapeHtml(CATEGORY_LABELS[consumer.category] || consumer.category)}</td>
        <td>${escapeHtml(this.zoneMap.get(consumer.zoneId) || '—')}</td>
        <td>${escapeHtml(priorityLabels[consumer.priority] || consumer.priority || '—')}</td>
        <td>${consumer.quantity}</td>
        <td>${formatPower(totalPower)}</td>
        <td>${formatPower(consumer.surgePower)}</td>
        <td>${consumer.hoursPerDay}</td>
        <td>${formatEnergyWh(dailyEnergy)}</td>
        <td>${escapeHtml(profileLabels[consumer.usageProfile] || consumer.usageProfile || '—')}</td>
      </tr>`;
    }).join('');
  }

  renderZoneRows() {
    if (!this.groupedZones.length) return '<tr><td colspan="6">Зони ще не створені.</td></tr>';
    const totalDaily = Math.max(this.calc.dailyConsumptionWh, 1);
    return this.groupedZones.map((group) => `
      <tr>
        <td>${escapeHtml(group.zoneName)}</td>
        <td>${group.consumers.length}</td>
        <td>${formatPower(group.totalPower)}</td>
        <td>${formatPower(group.surge)}</td>
        <td>${formatEnergyWh(group.dailyEnergy)}</td>
        <td>${formatNumber((group.dailyEnergy / totalDaily) * 100, 0)}%</td>
      </tr>`).join('');
  }

  renderConfigurationRows(configs = []) {
    if (!configs.length) return '<tr><td colspan="9">Щоб побачити варіанти конфігурації, додайте хоча б один прилад.</td></tr>';
    return configs.map((config, index) => `
      <tr>
        <td>${index === 0 ? 'Основний' : `Альтернатива ${index}`}</td>
        <td>${config.totalBatteries}</td>
        <td>${config.seriesCount}S / ${config.parallelCount}P</td>
        <td>${config.bankVoltage} V</td>
        <td>${config.bankCapacityAh} Ah</td>
        <td>${formatEnergyWh(config.totalStoredWh)}</td>
        <td>${formatEnergyWh(config.usableStoredWh)}</td>
        <td>${formatAutonomy(config.autonomyHours)}</td>
      </tr>`).join('');
  }

  renderSettingsRows() {
    return this.getSettingsRows().map((row) => `
      <tr>
        <td>${escapeHtml(row.key)}</td>
        <td>${escapeHtml(row.value)}</td>
      </tr>
    `).join('');
  }

  renderCheckRows() {
    return this.engineeringChecks.map((check) => `
      <tr>
        <td>${escapeHtml(check.check)}</td>
        <td>${escapeHtml(check.value)}</td>
        <td><span class="report-sheet__status report-sheet__status--${check.status}">${this.getStatusLabel(check.status)}</span></td>
      </tr>
    `).join('');
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
    const calc = this.calc;
    const best = this.bestConfig;
    const voltage = Number(this.settings.batteryVoltage || 24);
    const criticalRuntime = calc.criticalAutonomyHours;
    const configs = this.isFocusView ? calc.recommendedBatteryConfigs.slice(0, 1) : calc.recommendedBatteryConfigs;
    const batteryTypeLabel = batteryTypeLabels[this.settings.batteryType] || String(this.settings.batteryType || 'lifepo4').toUpperCase();

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
              <span>${formatNumber(this.settings.autonomyDays || 1, 1)} доби</span>
              <span>ККД ${formatNumber((this.settings.inverterEfficiency || 0.92) * 100, 0)}%</span>
            </div>
          </header>

          ${this.renderViewSwitch()}

          <section class="report-sheet__hero-grid">
            <div class="report-sheet__hero-card report-sheet__hero-card--accent">
              <span>Готове рішення</span>
              <strong>${this._state.consumers.length ? `${formatPower(calc.recommendedInverterPower)} + ${best ? `${best.totalBatteries} АКБ (${best.seriesCount}S/${best.parallelCount}P)` : formatBattery(calc.recommendedBatteryCapacityAh)}` : 'Додайте прилади'}</strong>
            </div>
            <div class="report-sheet__hero-card">
              <span>Навантаження, під яке підібрана система</span>
              <strong>${formatPower(calc.designLoadPower)}</strong>
            </div>
            <div class="report-sheet__hero-card">
              <span>Потрібно енергії без запасу</span>
              <strong>${formatEnergyWh(calc.requiredEnergyWh)}</strong>
            </div>
            <div class="report-sheet__hero-card">
              <span>Потрібно енергії із запасом</span>
              <strong>${formatEnergyWh(calc.totalEnergyWh)}</strong>
            </div>
          </section>

          <section class="report-sheet__compact-grid">
            ${this.isFocusView ? `
            <section class="report-sheet__section">
              <div class="report-sheet__title-row">
                <h3>Головне по системі</h3>
                <span class="report-sheet__tag report-sheet__tag--key">Ключове</span>
              </div>
              <div class="report-sheet__metric-grid">
                <div><span>Який інвертор потрібен</span><strong>${formatPower(calc.recommendedInverterPower)}</strong></div>
                <div><span>Яка АКБ потрібна</span><strong>${formatBattery(calc.recommendedBatteryCapacityAh)}</strong></div>
                <div><span>Запас по інвертору</span><strong>${formatNumber(calc.inverterHeadroomPercent * 100, 0)}%</strong></div>
                <div><span>Час роботи у звичному режимі</span><strong>${formatAutonomy(calc.estimatedAutonomyHours)}</strong></div>
              </div>
            </section>
            ` : `
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
            `}
          </section>

          <section class="report-sheet__section">
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

          <section class="report-sheet__section">
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
                    <th>Схема</th>
                    <th>Напруга</th>
                    <th>Ємність</th>
                    <th>Енергія брутто</th>
                    <th>Енергія корисна</th>
                    <th>Час роботи у звичному режимі</th>
                  </tr>
                </thead>
                <tbody>${this.renderConfigurationRows(configs)}</tbody>
              </table>
            </div>
          </section>

          <section class="report-sheet__compact-grid">
            <section class="report-sheet__section">
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

            <section class="report-sheet__section">
              <div class="report-sheet__title-row">
                <h3>Попередження</h3>
                <span class="report-sheet__tag report-sheet__tag--key">Ключове</span>
              </div>
              <ul class="report-sheet__list report-sheet__list--warning report-sheet__list--compact">
                ${(this.warnings.length ? this.warnings : ['Критичних зауважень для поточної моделі не виявлено.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </section>
          </section>

          ${this.isFocusView ? '' : `
          <section class="report-sheet__section">
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

          <section class="report-sheet__section">
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
          `}
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
