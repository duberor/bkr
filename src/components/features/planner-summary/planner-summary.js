import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import { appStore } from '../../../store/app-store.js';
import { getProjectSummary } from '../../../utils/consumer-utils.js';
import { formatAutonomy, formatPower } from '../../../utils/format.js';
import styles from './planner-summary.scss?inline';

class PlannerSummary extends BaseElement {
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

  render() {
    const summary = getProjectSummary(this.state.consumers, this.state.systemSettings);
    const hasConsumers = summary.consumerCount > 0;

    return `
      <div class="planner-summary">
        <ui-card padding="md">
          <section class="planner-summary__card">
            <div class="planner-summary__head">
              <p class="planner-summary__eyebrow">Коротко</p>
              <h2>Проєкт під рукою</h2>
            </div>

            <div class="planner-summary__grid">
              <div><span>Бажаний час роботи</span><strong>${formatAutonomy(summary.targetAutonomyHours, { preferDays: summary.targetAutonomyHours >= 24 })}</strong></div>
              <div><span>Приладів у проєкті</span><strong>${summary.consumerCount}</strong></div>
              <div><span>Сумарна потужність</span><strong>${hasConsumers ? formatPower(summary.totalPower) : '—'}</strong></div>
              <div><span>Орієнтир по інвертору</span><strong>${hasConsumers ? formatPower(summary.recommendedInverterPower) : '—'}</strong></div>
            </div>

            ${
              hasConsumers
                ? ''
                : `
              <div class="planner-summary__empty">
                Додайте прилади, щоб побачити робочі цифри.
              </div>
            `
            }
          </section>
        </ui-card>
      </div>
    `;
  }
}

customElements.define('planner-summary', PlannerSummary);
