import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import '../../features/planner-shell/planner-shell.js';
import '../../features/scenario-presets/scenario-presets.js';
import {
  Chart,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineController,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { appStore } from '../../../store/app-store.js';
import {
  getCategoryBreakdown,
  getConsumerPowerRows,
  getHourlyLoadProfile,
  getSystemCalculation,
} from '../../../utils/consumer-utils.js';
import { formatPower, formatNumber, formatEnergyWh } from '../../../utils/format.js';
import styles from './dashboard-page.scss?inline';

Chart.register(
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineController,
  PointElement,
  LineElement,
  Filler,
);

class DashboardPage extends BaseElement {
  constructor() {
    super();
    this.state = appStore.getState();
    this.charts = [];
    this.projectMessage = null;
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
    this.destroyCharts();
  }

  styles() {
    return styles;
  }

  destroyCharts() {
    this.charts.forEach((chart) => chart?.destroy());
    this.charts = [];
  }

  renderStatCards(calc) {
    const dailyWh = this.state.consumers.reduce(
      (sum, c) => sum + Number(c.power || 0) * Number(c.quantity || 1) * Number(c.hoursPerDay || 0),
      0,
    );
    const surgeWarn = calc.totalSurgePower > 0 && calc.recommendedInverterPower > 0
      && calc.totalSurgePower > calc.recommendedInverterPower * 0.8;
    return `
      <div class="dashboard__stats">
        <ui-card padding="md"><div class="stat"><span>Приладів у проєкті</span><strong>${formatNumber(this.state.consumers.length)}</strong></div></ui-card>
        <ui-card padding="md"><div class="stat"><span>Сумарна потужність</span><strong>${formatPower(calc.totalPower)}</strong></div></ui-card>
        <ui-card padding="md"><div class="stat ${surgeWarn ? 'stat--warn' : ''}"><span>Пусковий пік</span><strong>${formatPower(calc.totalSurgePower)}</strong></div></ui-card>
        <ui-card padding="md"><div class="stat"><span>Добова енергія</span><strong>${formatEnergyWh(dailyWh)}</strong></div></ui-card>
      </div>
    `;
  }

  getProfileSummary(profileData) {
    if (!profileData.length) return null;
    const values = profileData.map((item) => Number(item.value || 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const peak = profileData.find((item) => item.value === max);
    return {
      min,
      avg,
      max,
      peakHour: peak?.hour || '—',
    };
  }

  renderProfileInfo(profileData) {
    const summary = this.getProfileSummary(profileData);
    if (!summary) {
      return `
        <div class="dashboard__profile-empty">
          Додайте хоча б один прилад, щоб побачити зміну навантаження протягом доби.
        </div>
      `;
    }

    return `
      <ui-disclosure label="Деталі навантаження за добу">
        <div class="dashboard__profile-info">
          <div class="dashboard__profile-metrics">
            <span>Мінімум: <strong>${formatPower(summary.min)}</strong></span>
            <span>Середнє: <strong>${formatPower(summary.avg)}</strong></span>
            <span>Пік: <strong>${formatPower(summary.max)}</strong> о <strong>${summary.peakHour}</strong></span>
          </div>
        </div>
      </ui-disclosure>
    `;
  }

  renderProjectTools() {
    if (!this.projectMessage?.text) return '';
    return `
      <div class="dashboard__project-message dashboard__project-message--${this.projectMessage.type || 'info'}"
           role="status" aria-live="polite">
        ${this.projectMessage.text}
      </div>
    `;
  }

  renderTopbar() {
    const steps = [
      { hash: '#/dashboard', label: 'Огляд',   n: 1 },
      { hash: '#/consumers', label: 'Прилади', n: 2 },
      { hash: '#/system',    label: 'Система', n: 3 },
      { hash: '#/report',    label: 'Звіт',    n: 4 },
    ];
    return `
      <div class="page-topbar">
        <nav class="page-steps">
          ${steps.map(({ hash, label, n }) => `
            <a class="page-step ${location.hash === hash ? 'is-active' : ''}" href="${hash}">
              <span class="page-step__n">${n}</span><span>${label}</span>
            </a>`).join('')}
        </nav>
        <div class="page-topbar__end">
          <button class="page-btn" data-project-export>Зберегти</button>
          <button class="page-btn" data-project-import>Завантажити</button>
          <input class="dashboard__project-file" type="file" accept="application/json,.json" data-project-file />
        </div>
      </div>`;
  }

  render() {
    const calc = getSystemCalculation(this.state.consumers, this.state.systemSettings);
    const profileData = getHourlyLoadProfile(this.state.consumers);
    const hasConsumers = this.state.consumers.length > 0;

    return `
      <div class="page-wrap">
        ${this.renderTopbar()}
        <div class="page-body">
          ${hasConsumers ? '' : `
            <ui-card padding="md">
              <div class="dashboard__empty">
                <h2>Почніть з приладів</h2>
                <p>Додайте прилади, які мають працювати при відключенні світла. Система автоматично підбере інвертор та акумулятори.</p>
                <div class="dashboard__empty-steps">
                  <div class="dashboard__empty-step"><strong>1</strong><span>Додайте прилади</span></div>
                  <div class="dashboard__empty-step"><strong>2</strong><span>Налаштуйте систему</span></div>
                  <div class="dashboard__empty-step"><strong>3</strong><span>Отримайте звіт</span></div>
                </div>
                <a href="#/consumers" class="dashboard__empty-btn">Додати перший прилад</a>
              </div>
            </ui-card>
            <scenario-presets></scenario-presets>
          `}

          ${hasConsumers && calc.totalSurgePower > calc.recommendedInverterPower * 0.8 ? `
            <div class="dashboard__alert dashboard__alert--warn">
              <span>⚠</span>
              <span>Пусковий струм (${formatPower(calc.totalSurgePower)}) перевищує 80% розрахункового інвертора — перевірте сумісність перед покупкою</span>
            </div>
          ` : ''}

          ${this.renderStatCards(calc)}

          <div class="dashboard__charts">
            <ui-card padding="md"><div class="chart-card"><div class="chart-card__head"><h2>На що йде енергія</h2></div><div class="chart-card__canvas-wrap"><canvas data-chart="category"></canvas></div></div></ui-card>
            <ui-card padding="md"><div class="chart-card"><div class="chart-card__head"><h2>Потужність окремих приладів</h2></div><div class="chart-card__canvas-wrap"><canvas data-chart="consumers"></canvas></div></div></ui-card>
            <ui-card padding="md" class="chart-card--wide"><div class="chart-card"><div class="chart-card__head"><h2>Навантаження протягом доби</h2></div>${this.renderProfileInfo(profileData)}<div class="chart-card__canvas-wrap chart-card__canvas-wrap--wide"><canvas data-chart="profile"></canvas></div></div></ui-card>
          </div>

          ${this.renderProjectTools()}
        </div>
      </div>
    `;
  }

  afterRender() {
    this.destroyCharts();

    // scenario-presets у empty state
    const presetsEl = this.shadowRoot.querySelector('scenario-presets');
    if (presetsEl) {
      presetsEl.addEventListener('scenario-preset-select', this.handlePresetSelect);
    }

    const categoryCtx = this.shadowRoot.querySelector('[data-chart="category"]');
    const consumersCtx = this.shadowRoot.querySelector('[data-chart="consumers"]');
    const profileCtx = this.shadowRoot.querySelector('[data-chart="profile"]');

    const categoryData = getCategoryBreakdown(this.state.consumers);
    const consumerData = getConsumerPowerRows(this.state.consumers);
    const profileData = getHourlyLoadProfile(this.state.consumers);

    if (categoryCtx && categoryData.length) {
      this.charts.push(
        new Chart(categoryCtx, {
          type: 'doughnut',
          data: {
            labels: categoryData.map((item) => item.label),
            datasets: [
              {
                data: categoryData.map((item) => item.value),
                backgroundColor: ['#4077d1', '#47d5a6', '#d7ac61', '#d94a4a', '#9bb4c0', '#a18d6d'],
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#fff' } } },
          },
        }),
      );
    }

    if (consumersCtx && consumerData.length) {
      this.charts.push(
        new Chart(consumersCtx, {
          type: 'bar',
          data: {
            labels: consumerData.map((item) => item.label),
            datasets: [
              {
                label: 'W',
                data: consumerData.map((item) => item.value),
                backgroundColor: '#4077d1',
                borderRadius: 10,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.08)' } },
              y: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.08)' } },
            },
            plugins: { legend: { display: false } },
          },
        }),
      );
    }

    if (profileCtx && profileData.length) {
      this.charts.push(
        new Chart(profileCtx, {
          type: 'line',
          data: {
            labels: profileData.map((item) => item.hour),
            datasets: [
              {
                label: 'W',
                data: profileData.map((item) => item.value),
                borderColor: '#47d5a6',
                backgroundColor: 'rgba(71,213,166,.16)',
                fill: true,
                tension: 0.35,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                ticks: { color: '#fff', maxRotation: 0, autoSkip: true },
                grid: { color: 'rgba(255,255,255,0.08)' },
              },
              y: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.08)' } },
            },
            plugins: { legend: { labels: { color: '#fff' } } },
          },
        }),
      );
    }

    this.shadowRoot
      .querySelector('[data-project-export]')
      ?.addEventListener('click', this.handleProjectExport);
    this.shadowRoot
      .querySelector('[data-project-import]')
      ?.addEventListener('click', this.handleProjectImportClick);
    this.shadowRoot
      .querySelector('[data-project-file]')
      ?.addEventListener('change', this.handleProjectImportFile);
  }

  handlePresetSelect = (event) => {
    const { preset } = event.detail;
    if (!preset) return;
    appStore.replaceProject({
      consumers: preset.consumers || [],
      zones: preset.zones || [],
      systemSettings: preset.systemSettings || {},
      scenario: preset.scenario || {},
    });
    location.hash = '#/consumers';
  };

  handleProjectExport = () => {
    const payload = {
      meta: {
        app: 'UPS Planner Pro',
        version: 3,
        exportedAt: new Date().toISOString(),
      },
      consumers: this.state.consumers || [],
      zones: this.state.zones || [],
      systemSettings: this.state.systemSettings || {},
      scenario: this.state.scenario || {},
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ups-planner-project-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.projectMessage = { text: 'Проєкт експортовано в JSON.', type: 'success' };
    this.update();
  };

  handleProjectImportClick = () => {
    this.shadowRoot.querySelector('[data-project-file]')?.click();
  };

  handleProjectImportFile = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const project =
        payload?.project && typeof payload.project === 'object' ? payload.project : payload;

      if (!project || typeof project !== 'object') {
        throw new Error('Файл не схожий на проєкт UPS Planner Pro.');
      }

      appStore.replaceProject(project);
      this.projectMessage = { text: 'Проєкт успішно імпортовано.', type: 'success' };
      this.update();
    } catch (error) {
      this.projectMessage = {
        text: error?.message ? String(error.message) : 'Не вдалося імпортувати файл проєкту.',
        type: 'error',
      };
      this.update();
    } finally {
      event.target.value = '';
    }
  };
}

customElements.define('dashboard-page', DashboardPage);
