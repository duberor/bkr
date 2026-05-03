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
    this._selectedVariant = null;
  }

  styles() { return styles; }

  set items(v)    { this._items    = Array.isArray(v) ? v : []; if (this.isConnected) this.update(); }
  get items()     { return this._items; }
  set settings(v) { this._settings = v || {};                    if (this.isConnected) this.update(); }
  get settings()  { return this._settings; }

  renderBadges(items, type) {
    if (!items.length) return type === 'on'
      ? '<span class="sv-all-ok">Усе обладнання ✓</span>'
      : '<span class="sv-none">—</span>';
    return items.map((i) => `<span class="sv-tag sv-tag--${type}">${i}</span>`).join('');
  }

  render() {
    if (!this.items.length) {
      return `
        <div class="sv-wrap sv-wrap--empty">
          <p>Додайте прилади, щоб побачити варіанти.</p>
          <a href="#/consumers">Перейти до приладів →</a>
        </div>`;
    }

    const variants = getSolutionVariants(this.items, this.settings);
    const activeKey = this._selectedVariant
      || variants.find((v) => v.isRecommended)?.key
      || variants[0]?.key;

    return `
      <div class="sv-wrap">
        <div class="sv-header">
          <span class="sv-label">ВАРІАНТИ КОНФІГУРАЦІЇ</span>
        </div>
        <div class="sv-grid">
          ${variants.map((v) => {
            const isActive = activeKey === v.key;
            return `
              <div class="sv-card ${isActive ? 'is-active' : ''} ${v.isRecommended ? 'is-rec' : ''}"
                   data-key="${v.key}">
                <div class="sv-card__top">
                  <span class="sv-card__label">${v.title}</span>
                  ${v.isRecommended ? '<span class="sv-rec-badge">Рекомендовано</span>' : ''}
                </div>
                <div class="sv-card__spec">
                  ${formatPower(v.calc.recommendedInverterPower)} · ${formatBattery(v.calc.recommendedBatteryCapacityAh)}
                </div>
                <div class="sv-card__auto">~${formatAutonomy(v.calc.estimatedAutonomyHours)} · ${v.calc.normalizedSettings?.batteryVoltage || 24} В</div>
                <div class="sv-card__lists">
                  <div class="sv-card__on">${this.renderBadges(v.activeItems, 'on')}</div>
                  ${v.deferredItems.length ? `<div class="sv-card__off">${this.renderBadges(v.deferredItems, 'off')}</div>` : ''}
                </div>
                <button class="sv-card__buy" data-buy="${v.key}">Список покупок ↗</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  afterRender() {
    this.shadowRoot.querySelectorAll('[data-key]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-buy]')) return; // buy button — не міняємо вибір
        this._selectedVariant = card.getAttribute('data-key');
        this.update();
      });
    });
    this.shadowRoot.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        location.hash = '#/report';
      });
    });
  }
}

customElements.define('solution-variants', SolutionVariants);
