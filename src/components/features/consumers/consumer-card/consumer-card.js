import { BaseElement } from '../../../base/base-element.js';
import '../../../ui/ui-button/ui-button.js';
import '../../../ui/ui-card/ui-card.js';
import { formatEnergyWh, formatPower } from '../../../../utils/format.js';
import { CATEGORY_LABELS } from '../../../../data/consumer-categories.js';
import { escapeHtml } from '../../../../utils/escape.js';
import styles from './consumer-card.scss?inline';

const priorityLabels = { high: 'Високий', medium: 'Середній', low: 'Низький' };
const profileLabels = { always: 'Постійно 24/7', day: 'День', evening: 'Вечір', night: 'Ніч', office: 'Робочі години' };

class ConsumerCard extends BaseElement {
  static get observedAttributes() {
    return ['consumer-id', 'name', 'category', 'zone-name', 'zone-id', 'power', 'quantity', 'hours-per-day', 'surge-power', 'priority', 'usage-profile', 'notes'];
  }

  constructor() {
    super();
    this._open = false;
  }

  attributeChangedCallback() {
    if (this.isConnected) this.update();
  }

  styles() { return styles; }
  getAttr(name, fallback = '') { return this.getAttribute(name) || fallback; }
  getNumber(name, fallback = 0) { return Number(this.getAttribute(name) || fallback); }
  get totalPower() { return this.getNumber('power') * this.getNumber('quantity'); }
  get dailyConsumption() { return this.totalPower * this.getNumber('hours-per-day'); }

  get consumer() {
    return {
      id: this.getAttr('consumer-id'),
      name: this.getAttr('name'),
      category: this.getAttr('category'),
      zoneId: this.getAttr('zone-id'),
      power: this.getNumber('power'),
      quantity: this.getNumber('quantity'),
      hoursPerDay: this.getNumber('hours-per-day'),
      surgePower: this.getNumber('surge-power'),
      priority: this.getAttr('priority', 'medium'),
      usageProfile: this.getAttr('usage-profile', 'day'),
      notes: this.getAttr('notes'),
    };
  }

  render() {
    const category = CATEGORY_LABELS[this.getAttr('category')] || this.getAttr('category');
    const priority = priorityLabels[this.getAttr('priority','medium')] || this.getAttr('priority','medium');
    const profile = profileLabels[this.getAttr('usage-profile')] || this.getAttr('usage-profile');

    return `
      <ui-card padding="md">
        <article class="consumer-card ${this._open ? 'is-open' : ''}">
          <button class="consumer-card__summary" type="button" aria-expanded="${this._open ? 'true' : 'false'}">
            <div class="consumer-card__summary-main">
              <div class="consumer-card__summary-text">
                <div class="consumer-card__tags">
                  <span class="tag">${escapeHtml(category)}</span>
                  <span class="tag tag--muted">${escapeHtml(this.getAttr('zone-name') || 'Без зони')}</span>
                  <span class="tag tag--priority tag--${escapeHtml(this.getAttr('priority','medium'))}">${escapeHtml(priority)}</span>
                </div>
                <h3>${escapeHtml(this.getAttr('name'))}</h3>
                <p>${escapeHtml(profile)}</p>
              </div>
              <div class="consumer-card__summary-stats">
                <span>${formatPower(this.totalPower)}</span>
                <span>${formatEnergyWh(this.dailyConsumption)}</span>
              </div>
            </div>
            <span class="consumer-card__chevron" aria-hidden="true"></span>
          </button>

          ${this._open ? `
            <div class="consumer-card__body">
              <div class="consumer-card__note">
                ${escapeHtml(this.getAttr('notes') || 'Без додаткових приміток.')}
              </div>

              <div class="consumer-card__grid">
                <div><span>Робоча</span><strong>${formatPower(this.getNumber('power'))}</strong></div>
                <div><span>Пускова</span><strong>${formatPower(this.getNumber('surge-power'))}</strong></div>
                <div><span>Кількість</span><strong>${this.getNumber('quantity')}</strong></div>
                <div><span>Год/добу</span><strong>${this.getNumber('hours-per-day')}</strong></div>
                <div><span>Профіль</span><strong>${escapeHtml(profile)}</strong></div>
                <div><span>Добове споживання</span><strong>${formatEnergyWh(this.dailyConsumption)}</strong></div>
              </div>

              <div class="consumer-card__actions">
                <ui-button class="consumer-card__edit" variant="secondary" size="sm">Редагувати</ui-button>
                <ui-button class="consumer-card__delete" variant="secondary" size="sm">Видалити</ui-button>
              </div>
            </div>
          ` : ''}
        </article>
      </ui-card>
    `;
  }

  afterRender() {
    this.shadowRoot.querySelector('.consumer-card__summary')?.addEventListener('click', () => {
      this._open = !this._open;
      this.update();
    });

    this.shadowRoot.querySelector('.consumer-card__delete')?.addEventListener('ui-click', (event) => {
      event.stopPropagation();
      this.dispatchEvent(new CustomEvent('consumer-remove', {
        detail: { id: this.getAttr('consumer-id') },
        bubbles: true,
        composed: true,
      }));
    });

    this.shadowRoot.querySelector('.consumer-card__edit')?.addEventListener('ui-click', (event) => {
      event.stopPropagation();
      this.dispatchEvent(new CustomEvent('consumer-edit', {
        detail: { consumer: this.consumer },
        bubbles: true,
        composed: true,
      }));
    });
  }
}

customElements.define('consumer-card', ConsumerCard);
