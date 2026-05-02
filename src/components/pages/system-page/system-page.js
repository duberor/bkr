import { BaseElement } from '../../base/base-element.js';
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

const STEPS = [
  { hash: '#/dashboard', label: 'Огляд',    n: 1 },
  { hash: '#/consumers', label: 'Прилади',  n: 2 },
  { hash: '#/system',    label: 'Система',  n: 3 },
  { hash: '#/report',    label: 'Звіт',     n: 4 },
];

const TOPO = [
  { key: 'offline',          name: 'Базова',      hint: 'Off-line · 20 мс' },
  { key: 'line-interactive', name: 'Стандартна',  hint: 'Line-interactive · 5 мс, для дому' },
  { key: 'online',           name: 'Безперервна', hint: 'On-line · 0 мс, для серверів' },
];

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

  styles() { return styles; }

  /* ── Steps topbar ── */
  renderSteps() {
    return STEPS.map(({ hash, label, n }) => `
      <a class="sp-step ${location.hash === hash ? 'is-active' : ''}" href="${hash}">
        <span class="sp-step__num">${n}</span>
        <span>${label}</span>
      </a>
    `).join('');
  }

  /* ── Hero ── */
  renderHero(calc) {
    if (!calc.totalPower) return `
      <div class="sp-notice">
        Щоб побачити розрахунок, спочатку
        <a href="#/consumers">додайте прилади</a>.
      </div>`;

    const best = calc.recommendedBatteryConfigs?.[0];
    const batStr = best
      ? `${best.totalBatteries} × ${Math.round((best.bankCapacityAh || 0) / (best.totalBatteries || 1))} Аг`
      : formatBattery(calc.recommendedBatteryCapacityAh);
    const hasWarn = calc.startupCoverageRatio < 1 || calc.inverterHeadroomPercent < 0.15;

    return `
      <div class="sp-hero">
        <div class="sp-hero__ans">
          ${formatPower(calc.recommendedInverterPower)} + ${batStr}
          <span class="sp-hero__eq">= ${formatAutonomy(calc.estimatedAutonomyHours)}</span>
        </div>
        <div class="sp-hero__sub">
          Критичні прилади: ${formatAutonomy(calc.criticalAutonomyHours)}
          &nbsp;·&nbsp;
          Добова: ${formatEnergyWh(calc.dailyConsumptionWh || 0)}
        </div>
        <div class="sp-hero__badges">
          <span class="sp-badge sp-badge--${hasWarn ? 'warn' : 'ok'}">
            ${hasWarn ? '⚠ Є попередження' : '✓ Параметри в нормі'}
          </span>
          <a href="#/report" class="sp-badge sp-badge--link">Детальний звіт →</a>
        </div>
      </div>
    `;
  }

  /* ── Sidebar: topology + settings-form ── */
  renderSidebar() {
    const cur = this.state.systemSettings?.topology || 'line-interactive';
    const hasGen = Boolean(this.state.systemSettings?.hasGenerator);

    return `
      <aside class="sp-sidebar">
        <div class="sp-sidebar__section">Топологія ДБЖ</div>
        <div class="sp-topo">
          ${TOPO.map(({ key, name, hint }) => `
            <div class="sp-topo__opt ${cur === key ? 'is-sel' : ''}" data-topo="${key}">
              <div class="sp-topo__radio"></div>
              <div>
                <div class="sp-topo__name">${name}</div>
                <div class="sp-topo__hint">${hint}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="sp-sidebar__divider"></div>
        <div class="sp-sidebar__section">Генератор</div>
        <label class="sp-toggle-row" data-toggle-gen>
          <div class="sp-toggle ${hasGen ? 'is-on' : ''}">
            <div class="sp-toggle__dot"></div>
          </div>
          <span>${hasGen ? 'Є генератор' : 'Без генератора'}</span>
        </label>

        <div class="sp-sidebar__divider"></div>
        <div class="sp-sidebar__section">Параметри</div>
        <system-settings-form></system-settings-form>
      </aside>
    `;
  }

  render() {
    const calc = getSystemCalculation(this.state.consumers, this.state.systemSettings);

    return `
      <div class="sp-page">

        <!-- topbar зі steps і навігацією -->
        <div class="sp-topbar">
          <nav class="sp-steps">${this.renderSteps()}</nav>
          <div class="sp-topbar__nav">
            <a href="#/consumers" class="sp-nav-btn">← Прилади</a>
            <a href="#/report"    class="sp-nav-btn sp-nav-btn--prim">До звіту →</a>
          </div>
        </div>

        <!-- двоколонковий layout -->
        <div class="sp-layout">

          ${this.renderSidebar()}

          <div class="sp-content">
            ${this.renderHero(calc)}

            <system-checks></system-checks>

            <solution-variants></solution-variants>

            <ui-disclosure label="Схема системи">
              <system-visualizer></system-visualizer>
            </ui-disclosure>

            <ui-disclosure label="Конфігуратор батарейного банку">
              <battery-configurator></battery-configurator>
            </ui-disclosure>
          </div>

        </div>
      </div>
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
      form.setAttribute('compact', '');
      form.items    = this.state.consumers;
      form.settings = this.state.systemSettings;
      form.syncAutoSelections?.();
      form.addEventListener('system-settings-change', this.handleSettingsChange);
    }

    /* topology click */
    this.shadowRoot.querySelectorAll('[data-topo]').forEach((el) => {
      el.addEventListener('click', () => {
        appStore.setSystemSettings({ ...this.state.systemSettings, topology: el.dataset.topo });
      });
    });

    /* generator toggle */
    this.shadowRoot.querySelector('[data-toggle-gen]')?.addEventListener('click', () => {
      appStore.setSystemSettings({
        ...this.state.systemSettings,
        hasGenerator: !this.state.systemSettings?.hasGenerator,
      });
    });
  }

  handleSettingsChange = (e) => appStore.setSystemSettings(e.detail.settings);
}

customElements.define('system-page', SystemPage);
