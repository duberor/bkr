import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../features/system-settings-form/system-settings-form.js';
import '../../features/system-summary/system-summary.js';
import { appStore } from '../../../store/app-store.js';
import styles from './calculation-page.scss?inline';

class CalculationPage extends BaseElement {
  constructor() { super(); this.state = appStore.getState(); }
  connectedCallback() { this.unsubscribe = appStore.subscribe((state) => { this.state = state; this.update(); }); super.connectedCallback(); }
  disconnectedCallback() { this.unsubscribe?.(); }
  styles() { return styles; }
  render() {
    return `
      <section class="calculation-page">
        <div>
          <p class="page-eyebrow">Налаштування системи</p>
          <h1>Налаштування та розрахунок</h1>
        </div>
        <ui-card padding="md"><system-settings-form></system-settings-form></ui-card>
        <ui-card padding="md">
          <section class="calculation-page__info">
            <h2>Що враховує калькулятор</h2>
            <div class="calculation-page__chips">
              <span>Робоча потужність</span>
              <span>Одночасність роботи</span>
              <span>Пусковий пік</span>
              <span>Добове споживання</span>
              <span>Автономність</span>
              <span>Запас АКБ</span>
            </div>
          </section>
        </ui-card>
        <system-summary></system-summary>
      </section>
    `;
  }
  afterRender() {
    const form = this.shadowRoot.querySelector('system-settings-form');
    const summary = this.shadowRoot.querySelector('system-summary');
    form.settings = this.state.systemSettings;
    summary.items = this.state.consumers;
    summary.settings = this.state.systemSettings;
    form.addEventListener('system-settings-change', this.handleChange);
  }
  handleChange = (event) => appStore.setSystemSettings(event.detail.settings);
}
customElements.define('calculation-page', CalculationPage);
