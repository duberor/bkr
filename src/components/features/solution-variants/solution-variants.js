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
  }

  styles() {
    return styles;
  }

  set items(value) {
    this._items = Array.isArray(value) ? value : [];
    if (this.isConnected) this.update();
  }

  get items() {
    return this._items;
  }

  set settings(value) {
    this._settings = value || {};
    if (this.isConnected) this.update();
  }

  get settings() {
    return this._settings;
  }

  renderItems(items = []) {
    if (!items.length)
      return '<span class="solution-variants__placeholder">Усе навантаження входить у цей варіант.</span>';

    const visible = items.slice(0, 4);
    const rest = items.length - visible.length;

    return `
      <ul class="solution-variants__list">
        ${visible.map((item) => `<li>${item}</li>`).join('')}
        ${rest > 0 ? `<li>Ще ${rest} приладів</li>` : ''}
      </ul>
    `;
  }

  render() {
    if (!this.items.length) {
      return `
        <ui-card padding="md">
          <section class="solution-variants solution-variants--empty">
            <p>Щоб побачити кілька варіантів рішення, спочатку додайте прилади до проєкту.</p>
            <a class="solution-variants__link" href="#/consumers">Перейти до приладів</a>
          </section>
        </ui-card>
      `;
    }

    const variants = getSolutionVariants(this.items, this.settings);

    return `
      <ui-card padding="md">
        <section class="solution-variants">
          <div class="solution-variants__head">
            <p class="solution-variants__eyebrow">Крок 4</p>
            <h2>Кілька варіантів рішення</h2>
          </div>

          <div class="solution-variants__grid">
            ${variants
              .map(
                (variant) => `
              <article class="solution-variants__card ${variant.isRecommended ? 'is-recommended' : ''}">
                <div class="solution-variants__card-head">
                  <div>
                    <span class="solution-variants__badge">${variant.isRecommended ? 'Рекомендовано' : 'Варіант'}</span>
                    <h3>${variant.title}</h3>
                  </div>
                </div>

                <div class="solution-variants__metrics">
                  <div><span>Інвертор</span><strong>${formatPower(variant.calc.recommendedInverterPower)}</strong></div>
                  <div><span>АКБ</span><strong>${formatBattery(variant.calc.recommendedBatteryCapacityAh)}</strong></div>
                  <div><span>Час роботи</span><strong>${formatAutonomy(variant.calc.estimatedAutonomyHours)}</strong></div>
                </div>

                <div class="solution-variants__lists">
                  <div>
                    <span>Що працюватиме</span>
                    ${this.renderItems(variant.activeItems)}
                  </div>
                  <div>
                    <span>Що краще відкласти</span>
                    ${this.renderItems(variant.deferredItems)}
                  </div>
                </div>
              </article>
            `,
              )
              .join('')}
          </div>
        </section>
      </ui-card>
    `;
  }
}

customElements.define('solution-variants', SolutionVariants);
