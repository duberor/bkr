import { BaseElement } from '../../../base/base-element.js';
import '../../../ui/ui-card/ui-card.js';
import '../consumer-form/consumer-form.js';
import '../consumers-list/consumers-list.js';
import '../consumers-summary/consumers-summary.js';
import '../../system-summary/system-summary.js';
import '../../system-settings-form/system-settings-form.js';

import {
  loadConsumers,
  saveConsumers,
  loadSystemSettings,
  saveSystemSettings,
} from '../../../../utils/storage.js';

import styles from './consumers-page.scss?inline';

class ConsumersPage extends BaseElement {
  constructor() {
    super();

    this.consumers = loadConsumers();
    this.systemSettings = loadSystemSettings();
  }

  styles() {
    return styles;
  }

  render() {
    return `
      <section class="consumers-page">
        <section class="consumers-page__top">
          <ui-card padding="md">
            <div class="consumers-page__intro">
              <p class="consumers-page__eyebrow">Прилади</p>
              <h1 class="consumers-page__title">Керування приладами</h1>
              <p class="consumers-page__text">
                Додавайте прилади, розподіляйте їх по зонах і готуйте основу для розрахунку системи.
              </p>
            </div>
          </ui-card>

          <consumers-summary></consumers-summary>
        </section>

        <section class="consumers-page__stack">
          <ui-card padding="md">
            <system-settings-form></system-settings-form>
          </ui-card>

          <system-summary></system-summary>

          <ui-card padding="md">
            <consumer-form></consumer-form>
          </ui-card>

          <ui-card padding="md">
            <consumers-list></consumers-list>
          </ui-card>
        </section>
      </section>
    `;
  }

  afterRender() {
    const form = this.shadowRoot.querySelector('consumer-form');
    const list = this.shadowRoot.querySelector('consumers-list');
    const summary = this.shadowRoot.querySelector('consumers-summary');
    const systemSummary = this.shadowRoot.querySelector('system-summary');
    const systemSettingsForm = this.shadowRoot.querySelector('system-settings-form');

    if (list) {
      list.items = this.consumers;
    }

    if (summary) {
      summary.items = this.consumers;
    }

    if (systemSummary) {
      systemSummary.items = this.consumers;
      systemSummary.settings = this.systemSettings;
    }

    if (systemSettingsForm) {
      systemSettingsForm.settings = this.systemSettings;

      systemSettingsForm.removeEventListener(
        'system-settings-change',
        this.handleSystemSettingsChange,
      );

      systemSettingsForm.addEventListener(
        'system-settings-change',
        this.handleSystemSettingsChange,
      );
    }

    if (form) {
      form.removeEventListener('consumer-add', this.handleConsumerAdd);
      form.removeEventListener('consumer-invalid', this.handleConsumerInvalid);

      form.addEventListener('consumer-add', this.handleConsumerAdd);
      form.addEventListener('consumer-invalid', this.handleConsumerInvalid);
    }

    if (list) {
      list.removeEventListener('consumer-remove', this.handleConsumerRemove);
      list.addEventListener('consumer-remove', this.handleConsumerRemove);
    }
  }

  handleConsumerAdd = (event) => {
    const consumer = event.detail?.consumer;
    if (!consumer) return;

    this.consumers = [...this.consumers, consumer];
    saveConsumers(this.consumers);
    this.update();
  };

  handleConsumerRemove = (event) => {
    const id = event.detail?.id;
    if (!id) return;

    this.consumers = this.consumers.filter((item) => item.id !== id);
    saveConsumers(this.consumers);
    this.update();
  };

  handleConsumerInvalid = (event) => {
    console.log('consumer-invalid', event.detail?.errors || []);
  };

  handleSystemSettingsChange = (event) => {
    const settings = event.detail?.settings;
    if (!settings) return;

    this.systemSettings = {
      ...this.systemSettings,
      ...settings,
    };

    saveSystemSettings(this.systemSettings);
    this.update();
  };
}

customElements.define('consumers-page', ConsumersPage);
