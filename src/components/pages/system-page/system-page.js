import { BaseElement } from '../../base/base-element.js';
import '../../features/planner-shell/planner-shell.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import '../../ui/ui-tooltip/ui-tooltip.js';
import '../../features/system-settings-form/system-settings-form.js';
import '../../features/system-summary/system-summary.js';
import '../../features/solution-variants/solution-variants.js';
import '../../features/battery-configurator/battery-configurator.js';
import '../../features/system-visualizer/system-visualizer.js';
import '../../features/system-checks/system-checks.js';
import { appStore } from '../../../store/app-store.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import {
  formatAutonomy,
  formatBattery,
  formatBatteryTopology,
  formatEnergyWh,
  formatNumber,
  formatPower,
} from '../../../utils/format.js';
import styles from './system-page.scss?inline';

class SystemPage extends BaseElement {
  constructor() {
    super();
    this.state = appStore.getState();
  }

  connectedCallback() {
    this.unsubscribe = appStore.subscribe((state) => {
      this.state = state;
      this.update();
    });
    super.connectedCallback();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  styles() {
    return styles;
  }

  get zoneMap() {
    return new Map((this.state.zones || []).map((zone) => [zone.id, zone.name]));
  }

  get zoneRows() {
    const groups = new Map();
    (this.state.consumers || []).forEach((consumer) => {
      const zoneName = this.zoneMap.get(consumer.zoneId) || 'Без зони';
      if (!groups.has(zoneName)) {
        groups.set(zoneName, { count: 0, totalPower: 0, dailyEnergy: 0, highPriority: 0 });
      }
      const row = groups.get(zoneName);
      const power = Number(consumer.power || 0) * Number(consumer.quantity || 0);
      row.count += 1;
      row.totalPower += power;
      row.dailyEnergy += power * Number(consumer.hoursPerDay || 0);
      if (consumer.priority === 'high') row.highPriority += power;
    });
    return [...groups.entries()]
      .map(([zoneName, row]) => ({ zoneName, ...row }))
      .sort((a, b) => b.dailyEnergy - a.dailyEnergy);
  }

  renderHero(calc) {
    if (!calc.totalPower) return '';
    const best = calc.recommendedBatteryConfigs?.[0];
    const batStr = best
      ? `${best.totalBatteries} акум. × ${Math.round((best.bankCapacityAh || 0) / (best.totalBatteries || 1))} Аг`
      : formatBattery(calc.recommendedBatteryCapacityAh);
    const auto    = formatAutonomy(calc.estimatedAutonomyHours);
    const autoCrit = formatAutonomy(calc.criticalAutonomyHours);
    const hasWarn = calc.startupCoverageRatio < 1 || calc.inverterHeadroomPercent < 0.15;
    const badgeCls  = hasWarn ? 'system-page__hero-badge--warn' : 'system-page__hero-badge--ok';
    const badgeText = hasWarn ? '⚠ Є попередження' : '✓ Параметри в нормі';
    return `
      <div class="system-page__hero">
        <div class="system-page__hero-main">
          Інвертор ${formatPower(calc.recommendedInverterPower)} + ${batStr} = ${auto}
        </div>
        <div class="system-page__hero-sub">Тільки критичні прилади: ${autoCrit}</div>
        <div class="system-page__hero-row">
          <span class="system-page__hero-badge ${badgeCls}">${badgeText}</span>
          <a href="#/report" class="system-page__hero-link">Детальний звіт →</a>
        </div>
      </div>
    `;
  }

  renderTopologySelector() {
    const topologies = [
      { key: 'offline',          main: 'Базова',      sub: 'Off-line · 20 мс' },
      { key: 'line-interactive', main: 'Стандартна',  sub: 'Line-interactive · 5 мс, для дому' },
      { key: 'online',           main: 'Безперервна', sub: 'On-line · 0 мс, для серверів' },
    ];
    const cur = this.state.systemSettings?.topology || 'line-interactive';
    return `
      <ui-card padding="md">
        <div class="system-page__topo-head">
          <span class="system-page__topo-label">Тип ДБЖ</span>
          <ui-tooltip label="?" text="Базова: найдешевша, перемикання 20 мс. Стандартна: 5 мс, підходить для більшості будинків. Безперервна: 0 мс, для серверів і медтехніки."></ui-tooltip>
        </div>
        <div class="system-page__topo-group">
          ${topologies.map(({ key, main, sub }) => `
            <div class="system-page__topo-opt ${cur === key ? 'is-sel' : ''}" data-topo="${key}">
              <div class="system-page__topo-radio"></div>
              <div>
                <div class="system-page__topo-main">${main}</div>
                <div class="system-page__topo-sub">${sub}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </ui-card>
    `;
  }

  renderZoneRows() {
    if (!this.zoneRows.length)
      return '<tr><td colspan="5">Ще не додано жодної зони або приладу.</td></tr>';
    return this.zoneRows
      .map(
        (row) => `
      <tr>
        <td>${row.zoneName}</td>
        <td>${row.count}</td>
        <td>${formatPower(row.totalPower)}</td>
        <td>${formatEnergyWh(row.dailyEnergy)}</td>
        <td>${formatPower(row.highPriority)}</td>
      </tr>
    `,
      )
      .join('');
  }

  renderConfigRows(configs = []) {
    if (!configs.length)
      return '<tr><td colspan="9">Щоб побачити варіанти системи, додайте прилади та налаштуйте параметри.</td></tr>';
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
        <td>${config.label}</td>
      </tr>
    `,
      )
      .join('');
  }

  render() {
    const calc = getSystemCalculation(this.state.consumers, this.state.systemSettings);
    const hasConsumers = this.state.consumers.length > 0;
    const voltage = Number(this.state.systemSettings?.batteryVoltage || 24);
    const efficiency = Number(this.state.systemSettings?.inverterEfficiency || 0.92);
    const fullDcCurrent = voltage ? calc.totalPower / Math.max(voltage * efficiency, 1) : 0;
    const designDcCurrent = voltage ? calc.designLoadPower / Math.max(voltage * efficiency, 1) : 0;
    const surgeDcCurrent = voltage ? calc.totalSurgePower / Math.max(voltage * efficiency, 1) : 0;
    const highPriorityPower = calc.criticalPower;
    const highPriorityRuntime = calc.criticalAutonomyHours;

    return `
      <planner-shell
        step="3"
        eyebrow="Система"
        title="Конфігурація системи"
        prev-href="#/consumers"
        prev-label="Повернутися до приладів"
        next-href="#/report"
        next-label="Перейти до звіту"
      >
        ${
          hasConsumers
            ? ''
            : `
          <div class="system-page__notice">
            <span>Щоб побачити готове рішення, спочатку додайте хоча б один прилад.</span>
            <a class="system-page__notice-link" href="#/consumers">Перейти до приладів</a>
          </div>
        `
        }

        ${this.renderHero(calc)}

        ${this.renderTopologySelector()}

        <solution-variants></solution-variants>

        <system-checks></system-checks>

        <system-visualizer></system-visualizer>

        <section class="system-page__detail-grid">
          <ui-card padding="md">
            <section class="system-page__panel">
              <div class="system-page__panel-head">
                <div class="system-page__title-row">
                  <h2>Що споживає найбільше</h2>
                  <ui-tooltip label="Пояснення" text="Порівняння зон за кількістю приладів, потужністю та добовим споживанням."></ui-tooltip>
                </div>
              </div>
              <!-- zones table shown directly -->
                <div class="system-page__table-wrap">
                  <table class="system-page__table">
                    <thead>
                      <tr>
                        <th>Зона</th>
                        <th>Приладів</th>
                        <th>Потужність</th>
                        <th>За добу</th>
                        <th>Критичне</th>
                      </tr>
                    </thead>
                    <tbody>${this.renderZoneRows()}</tbody>
                  </table>
                </div>
            </section>
          </ui-card>
        </section>

        <!-- Таблиця варіантів АКБ прибрана, конфігурації показуються через battery-configurator -->
        <ui-card padding="md" style="display:none;">
          <section class="system-page__panel">
            <div class="system-page__panel-head">
              <div class="system-page__title-row">
                <h2>Інші варіанти АКБ</h2>
                <ui-tooltip label="Пояснення" text="Готові конфігурації АКБ із кількістю модулів, схемою з’єднання та запасом енергії."></ui-tooltip>
              </div>
            </div>
            <ui-disclosure label="Подивитися всі варіанти АКБ">
              <div class="system-page__table-wrap">
                <table class="system-page__table system-page__table--configs">
                  <thead>
                    <tr>
                      <th>Варіант</th>
                      <th>Модулів</th>
                      <th>З'єднання модулів</th>
                      <th>Напруга</th>
                      <th>Ємність</th>
                      <th>Повна енергія</th>
                      <th>Корисна енергія</th>
                      <th>Час роботи у звичному режимі</th>
                      <th>Коментар</th>
                    </tr>
                  </thead>
                  <tbody>${this.renderConfigRows(calc.recommendedBatteryConfigs)}</tbody>
                </table>
              </div>
            </ui-disclosure>
          </section>
        </ui-card>

        <battery-configurator></battery-configurator>

        <ui-card padding="md">
          <section class="system-page__panel">
            <div class="system-page__panel-head">
              <h2>Налаштування розрахунку</h2>
            </div>
            <system-settings-form></system-settings-form>
          </section>
        </ui-card>

      </planner-shell>
    `;
  }

  afterRender() {
    const variants = this.shadowRoot.querySelector('solution-variants');
    const battery = this.shadowRoot.querySelector('battery-configurator');
    const visualizer = this.shadowRoot.querySelector('system-visualizer');
    const form = this.shadowRoot.querySelector('system-settings-form');

    if (variants) { variants.items = this.state.consumers; variants.settings = this.state.systemSettings; }
    if (battery)  { battery.items  = this.state.consumers; battery.settings  = this.state.systemSettings; }
    if (visualizer) { visualizer.items = this.state.consumers; visualizer.settings = this.state.systemSettings; }

    const checks = this.shadowRoot.querySelector('system-checks');
    if (checks) { checks.items = this.state.consumers; checks.settings = this.state.systemSettings; }

    if (form) {
      form.items = this.state.consumers;
      form.settings = this.state.systemSettings;
      form.syncAutoSelections?.();
      form.addEventListener('system-settings-change', this.handleSettingsChange);
    }

    // Topology radio click
    this.shadowRoot.querySelectorAll('[data-topo]').forEach((el) => {
      el.addEventListener('click', () => {
        appStore.setSystemSettings({ ...this.state.systemSettings, topology: el.getAttribute('data-topo') });
      });
    });
  }

  handleSettingsChange = (event) => appStore.setSystemSettings(event.detail.settings);
}

customElements.define('system-page', SystemPage);
