import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import { getSolutionVariants } from '../../../utils/consumer-utils.js';
import { formatAutonomy, formatBattery, formatPower } from '../../../utils/format.js';
import styles from './solution-variants.scss?inline';

class SolutionVariants extends BaseElement {
  constructor() {
    super();
    this._items = [];
    this._settings = {};
    this._selectedVariant = null; // локальний стан — не йде через store
  }

  styles() {
    return styles;
  }

  set items(value) {
    this._items = Array.isArray(value) ? value : [];
    if (this.isConnected) this.update();
  }

  get items() { return this._items; }

  set settings(value) {
    this._settings = value || {};
    if (this.isConnected) this.update();
  }

  get settings() { return this._settings; }

  renderItemBadges(items = []) {
    if (!items.length) return '<span class="sv-none">—</span>';
    return items.slice(0, 3).map((i) => `<span class="sv-tag sv-tag--on">${i}</span>`).join('') +
      (items.length > 3 ? `<span class="sv-tag sv-tag--more">+${items.length - 3}</span>` : '');
  }

  renderDeferredBadges(items = []) {
    if (!items.length) return '<span class="sv-none">Усе покривається</span>';
    return items.slice(0, 3).map((i) => `<span class="sv-tag sv-tag--off">${i}</span>`).join('') +
      (items.length > 3 ? `<span class="sv-tag sv-tag--more">+${items.length - 3}</span>` : '');
  }

  render() {
    if (!this.items.length) {
      return `
        <ui-card padding="md">
          <div class="sv-empty">
            <p>Додайте прилади, щоб побачити варіанти конфігурації.</p>
            <a href="#/consumers">Перейти до приладів →</a>
          </div>
        </ui-card>
      `;
    }

    const variants = getSolutionVariants(this.items, this.settings);
    const activeKey = this._selectedVariant
      || variants.find((v) => v.isRecommended)?.key
      || variants[0]?.key;

    return `
      <ui-card padding="md">
        <div class="sv-head">
          <p class="sv-eyebrow">Варіанти системи</p>
        </div>
        <div class="sv-tabs">
          ${variants.map((v) => `
            <button class="sv-tab ${activeKey === v.key ? 'is-active' : ''}" data-key="${v.key}">
              ${v.isRecommended ? '<span class="sv-rec-dot"></span>' : ''}
              ${v.title}
            </button>
          `).join('')}
        </div>
        ${variants.map((v) => `
          <div class="sv-panel ${activeKey === v.key ? 'is-visible' : 'is-hidden'}" data-panel="${v.key}">
            <div class="sv-metrics">
              <div class="sv-metric">
                <span>Інвертор</span>
                <strong>${formatPower(v.calc.recommendedInverterPower)}</strong>
              </div>
              <div class="sv-metric">
                <span>АКБ</span>
                <strong>${formatBattery(v.calc.recommendedBatteryCapacityAh)}</strong>
              </div>
              <div class="sv-metric">
                <span>Автономність</span>
                <strong>${formatAutonomy(v.calc.estimatedAutonomyHours)}</strong>
              </div>
              <div class="sv-metric">
                <span>Крит. прилади</span>
                <strong>${formatAutonomy(v.calc.criticalAutonomyHours)}</strong>
              </div>
            </div>
            <div class="sv-lists">
              <div class="sv-list-row">
                <span class="sv-list-label">Працюватиме:</span>
                <div class="sv-tags">${this.renderItemBadges(v.activeItems)}</div>
              </div>
              <div class="sv-list-row">
                <span class="sv-list-label">Відкласти:</span>
                <div class="sv-tags">${this.renderDeferredBadges(v.deferredItems)}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </ui-card>
    `;
  }

  afterRender() {
    this.shadowRoot.querySelectorAll('[data-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._selectedVariant = btn.getAttribute('data-key');
        this.update();
      });
    });
  }
}

customElements.define('solution-variants', SolutionVariants);
