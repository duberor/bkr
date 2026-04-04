import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import { Chart, BarController, BarElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend, LineController, PointElement, LineElement, Filler } from 'chart.js';
import { appStore } from '../../../store/app-store.js';
import { getCategoryBreakdown, getConsumerPowerRows, getHourlyLoadProfile, getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatEnergyWh, formatPower, formatBattery, formatNumber } from '../../../utils/format.js';
import styles from './dashboard-page.scss?inline';

Chart.register(BarController, BarElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend, LineController, PointElement, LineElement, Filler);

class DashboardPage extends BaseElement {
  constructor() {
    super();
    this.state = appStore.getState();
    this.charts = [];
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
    return `
      <div class="dashboard__stats">
        <ui-card padding="md"><div class="stat"><span>Усього приладів</span><strong>${formatNumber(this.state.consumers.length)}</strong></div></ui-card>
        <ui-card padding="md"><div class="stat"><span>Сумарна потужність</span><strong>${formatPower(calc.totalPower)}</strong></div></ui-card>
        <ui-card padding="md"><div class="stat"><span>Пікове навантаження</span><strong>${formatPower(calc.totalSurgePower)}</strong></div></ui-card>
        <ui-card padding="md"><div class="stat"><span>Добове споживання</span><strong>${formatEnergyWh(calc.dailyConsumptionWh)}</strong></div></ui-card>
        <ui-card padding="md"><div class="stat"><span>Рекомендований інвертор</span><strong>${formatPower(calc.recommendedInverterPower)}</strong></div></ui-card>
        <ui-card padding="md"><div class="stat"><span>Рекомендована АКБ</span><strong>${formatBattery(calc.recommendedBatteryCapacityAh)}</strong></div></ui-card>
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
          Додайте хоча б один прилад.
        </div>
      `;
    }

    return `
      <ui-disclosure label="Деталі навантаження за добу">
        <div class="dashboard__profile-info">
          <div class="dashboard__profile-metrics">
            <span>Мінімальне навантаження: <strong>${formatPower(summary.min)}</strong></span>
            <span>Середнє навантаження: <strong>${formatPower(summary.avg)}</strong></span>
            <span>Пікове навантаження: <strong>${formatPower(summary.max)}</strong> о <strong>${summary.peakHour}</strong></span>
          </div>
        </div>
      </ui-disclosure>
    `;
  }

  render() {
    const calc = getSystemCalculation(this.state.consumers, this.state.systemSettings);
    const profileData = getHourlyLoadProfile(this.state.consumers);

    return `
      <section class="dashboard">
        <div class="dashboard__hero">
          <div>
            <p class="dashboard__eyebrow">Огляд проєкту</p>
            <h1 class="dashboard__title">Огляд вашої системи</h1>
          </div>
        </div>

        ${this.renderStatCards(calc)}

        <div class="dashboard__charts">
          <ui-card padding="md"><div class="chart-card"><div class="chart-card__head"><h2>На що йде енергія</h2></div><div class="chart-card__canvas-wrap"><canvas data-chart="category"></canvas></div></div></ui-card>
          <ui-card padding="md"><div class="chart-card"><div class="chart-card__head"><h2>Потужність приладів</h2></div><div class="chart-card__canvas-wrap"><canvas data-chart="consumers"></canvas></div></div></ui-card>
          <ui-card padding="md" class="chart-card--wide"><div class="chart-card"><div class="chart-card__head"><h2>Навантаження протягом доби</h2></div>${this.renderProfileInfo(profileData)}<div class="chart-card__canvas-wrap chart-card__canvas-wrap--wide"><canvas data-chart="profile"></canvas></div></div></ui-card>
        </div>
      </section>
    `;
  }

  afterRender() {
    this.destroyCharts();

    const categoryCtx = this.shadowRoot.querySelector('[data-chart="category"]');
    const consumersCtx = this.shadowRoot.querySelector('[data-chart="consumers"]');
    const profileCtx = this.shadowRoot.querySelector('[data-chart="profile"]');

    const categoryData = getCategoryBreakdown(this.state.consumers);
    const consumerData = getConsumerPowerRows(this.state.consumers);
    const profileData = getHourlyLoadProfile(this.state.consumers);

    if (categoryCtx && categoryData.length) {
      this.charts.push(new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
          labels: categoryData.map((item) => item.label),
          datasets: [{ data: categoryData.map((item) => item.value), backgroundColor: ['#4077d1', '#47d5a6', '#d7ac61', '#d94a4a', '#9bb4c0', '#a18d6d'] }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#fff' } } } },
      }));
    }

    if (consumersCtx && consumerData.length) {
      this.charts.push(new Chart(consumersCtx, {
        type: 'bar',
        data: {
          labels: consumerData.map((item) => item.label),
          datasets: [{ label: 'W', data: consumerData.map((item) => item.value), backgroundColor: '#4077d1', borderRadius: 10 }],
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
      }));
    }

    if (profileCtx && profileData.length) {
      this.charts.push(new Chart(profileCtx, {
        type: 'line',
        data: {
          labels: profileData.map((item) => item.hour),
          datasets: [{ label: 'W', data: profileData.map((item) => item.value), borderColor: '#47d5a6', backgroundColor: 'rgba(71,213,166,.16)', fill: true, tension: 0.35 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { color: '#fff', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(255,255,255,0.08)' } },
            y: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.08)' } },
          },
          plugins: { legend: { labels: { color: '#fff' } } },
        },
      }));
    }
  }
}

customElements.define('dashboard-page', DashboardPage);
