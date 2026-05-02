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
  formatEnergyWh,
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

  renderHero(calc) {
    if (!calc.totalPower) return '';

    const best = calc.recommendedBatteryConfigs?.[0];
    const batStr = best
      ? `${best.totalBatteries} × ${Math.round((best.bankCapacityAh || 0) / (best.totalBatteries || 1))} Аг`
      : formatBattery(calc.recommendedBatteryCapacityAh);

    const hasWarn = calc.startupCoverageRatio < 1 || calc.inverterHeadroomPercent < 0.15;

    return `
      <div class="system-page__hero">
        <div class="system-page__hero-main">
          ${formatPower(calc.recommendedInverterPower)} + ${batStr} = ${formatAutonomy(calc.estimatedAutonomyHours)}
        </div>
        <div class="system-page__hero-sub">
          Критичні прилади: ${formatAutonomy(calc.criticalAutonomyHours)} · Добова енергія: ${formatEnergyWh(calc.dailyConsumptionWh || 0)}
        </div>
        <div class="system-page__hero-row">
          <span class="system-page__hero-badge ${hasWarn ? 'system-page__hero-badge--warn' : 'system-page__hero-badge--ok'}">
            ${hasWarn ? '⚠ Є попередження' : '✓ Параметри в нормі'}
          </span>
        </div>
      </div>
    `;
  }

  get zoneMap() {
    return new Map((this.state.zones || []).map((z) => [z.id, z.name]));
  }

  get zoneRows() {
    const groups = new Map();
    (this.state.consumers || []).forEach((c) => {
      const name = this.zoneMap.get(c.zoneId) || 'Без зони';
      if (!groups.has(name)) groups.set(name, { count: 0, totalPower: 0, dailyEnergy: 0, highPriority: 0 });
      const row = groups.get(name);
      const power = Number(c.power || 0) * Number(c.quantity || 1);
      row.count += 1;
      row.totalPower += power;
      row.dailyEnergy += power * Number(c.hoursPerDay || 0);
      if (c.priority === 'high') row.highPriority += power;
    });
    return [...groups.entries()]
      .map(([zoneName, row]) => ({ zoneName, ...row }))
      .sort((a, b) => b.dailyEnergy - a.dailyEnergy);
  }

  renderZoneRows() {
    if (!this.zoneRows.length)
      return '<tr><td colspan="5" style="color:rgba(255,255,255,0.45);padding:12px 8px">Ще не додано жодної зони або приладу.</td></tr>';
    return this.zoneRows.map((row) => `
      <tr>
        <td>${row.zoneName}</td>
        <td>${row.count}</td>
        <td>${formatPower(row.totalPower)}</td>
        <td>${formatEnergyWh(row.dailyEnergy)}</td>
        <td>${formatPower(row.highPriority)}</td>
      </tr>
    `).join('');
  }

  render() {
    const calc = getSystemCalculation(this.state.consumers, this.state.systemSettings);
    const hasConsumers = this.state.consumers.length > 0;

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
        ${!hasConsumers ? `
          <div class="system-page__notice">
            <span>Щоб побачити готове рішення, спочатку додайте хоча б один прилад.</span>
            <a class="system-page__notice-link" href="#/consumers">Перейти до приладів</a>
          </div>
        ` : ''}

        ${this.renderHero(calc)}

        <system-checks></system-checks>

        <solution-variants></solution-variants>

        <system-visualizer></system-visualizer>

        <ui-disclosure label="Що споживає найбільше (по зонах)">
          <div class="system-page__table-wrap">
            <table class="system-page__table">
              <thead>
                <tr>
                  <th>Зона</th><th>Приладів</th><th>Потужність</th><th>За добу</th><th>Критичне</th>
                </tr>
              </thead>
              <tbody>${this.renderZoneRows()}</tbody>
            </table>
          </div>
        </ui-disclosure>

        <ui-disclosure label="Конфігуратор батарейного банку">
          <battery-configurator></battery-configurator>
        </ui-disclosure>

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
    const variants   = this.shadowRoot.querySelector('solution-variants');
    const battery    = this.shadowRoot.querySelector('battery-configurator');
    const visualizer = this.shadowRoot.querySelector('system-visualizer');
    const checks     = this.shadowRoot.querySelector('system-checks');
    const form       = this.shadowRoot.querySelector('system-settings-form');

    if (variants)   { variants.items   = this.state.consumers; variants.settings   = this.state.systemSettings; }
    if (battery)    { battery.items    = this.state.consumers; battery.settings    = this.state.systemSettings; }
    if (visualizer) { visualizer.items = this.state.consumers; visualizer.settings = this.state.systemSettings; }
    if (checks)     { checks.items     = this.state.consumers; checks.settings     = this.state.systemSettings; }

    if (form) {
      form.items    = this.state.consumers;
      form.settings = this.state.systemSettings;
      form.syncAutoSelections?.();
      form.addEventListener('system-settings-change', this.handleSettingsChange);
    }
  }

  handleSettingsChange = (e) => appStore.setSystemSettings(e.detail.settings);
}

customElements.define('system-page', SystemPage);
