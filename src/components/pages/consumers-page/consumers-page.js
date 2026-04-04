import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-button/ui-button.js';
import '../../features/consumers/consumer-form/consumer-form.js';
import '../../features/consumers/consumers-list/consumers-list.js';
import '../../features/consumers/consumers-summary/consumers-summary.js';
import '../../features/consumers/consumer-modal/consumer-modal.js';
import '../../features/zones/zone-modal/zone-modal.js';
import { appStore } from '../../../store/app-store.js';
import { escapeHtml } from '../../../utils/escape.js';
import { normalizeComparableString } from '../../../utils/number.js';
import styles from './consumers-page.scss?inline';

class ConsumersPage extends BaseElement {
  constructor() {
    super();
    this.state = appStore.getState();
    this.filter = 'all';
    this.isZoneModalOpen = false;
    this.zoneDraft = null;
    this.isConsumerModalOpen = false;
    this.consumerDraft = null;
    this.feedback = null;
  }

  connectedCallback() {
    this.unsubscribe = appStore.subscribe((state) => {
      this.state = state;
      this.update();
    });
    super.connectedCallback();
  }

  disconnectedCallback() { this.unsubscribe?.(); }
  styles() { return styles; }

  get filteredItems() {
    if (this.filter === 'all') return this.state.consumers;
    return this.state.consumers.filter((item) => item.priority === this.filter);
  }

  get hasFilteredConsumers() {
    return this.filteredItems.length > 0;
  }

  renderFeedback() {
    if (!this.feedback?.message) return '';
    return `<div class="consumers-page__feedback consumers-page__feedback--${this.feedback.type || 'info'}" role="status" aria-live="polite">${escapeHtml(this.feedback.message)}</div>`;
  }

  renderZonesCard() {
    return `
      <ui-card padding="md">
        <section class="zones-card">
          <div class="zones-card__head">
          <div>
            <p class="page-eyebrow">Зони</p>
            <h2>Зони проєкту</h2>
          </div>
            <ui-button class="zone-add-btn" variant="secondary" size="sm">+ Додати зону</ui-button>
          </div>
          <div class="zones-card__list">
            ${this.state.zones.length ? this.state.zones.map((zone) => {
              const linkedConsumers = this.state.consumers.filter((consumer) => consumer.zoneId === zone.id).length;
              return `
                <div class="zone-pill">
                  <div class="zone-pill__meta">
                    <span>${escapeHtml(zone.name)}</span>
                    <small>${linkedConsumers} приладів</small>
                  </div>
                  <div class="zone-pill__actions">
                    <button type="button" class="zone-pill__edit" data-zone-edit="${zone.id}">Редагувати</button>
                    <button type="button" class="zone-pill__remove" data-zone-remove="${zone.id}" aria-label="Видалити ${escapeHtml(zone.name)}">×</button>
                  </div>
                </div>
              `;
            }).join('') : '<p class="zones-card__empty">Зон поки немає.</p>'}
          </div>
        </section>
      </ui-card>
    `;
  }

  render() {
    return `
      <section class="consumers-page">
        <div class="consumers-page__hero">
          <div>
            <p class="page-eyebrow">Прилади</p>
            <h1>Що має працювати під час відключення</h1>
            <p>Додавайте тільки ті прилади, які справді мають залишатися в роботі без мережі. Зони допоможуть згрупувати їх по кімнатах, контурах або сценаріях у звіті.</p>
          </div>
          <ui-card padding="md">
            <div class="consumers-page__controls">
              <span>Швидкий перегляд приладів за пріоритетом</span>
              <div class="chips">
                <button data-filter="all" class="chip ${this.filter === 'all' ? 'is-active' : ''}">Усі</button>
                <button data-filter="high" class="chip ${this.filter === 'high' ? 'is-active' : ''}">Високий</button>
                <button data-filter="medium" class="chip ${this.filter === 'medium' ? 'is-active' : ''}">Середній</button>
                <button data-filter="low" class="chip ${this.filter === 'low' ? 'is-active' : ''}">Низький</button>
              </div>
              <div class="consumers-page__cta-row">
                <ui-button class="clear-btn" variant="secondary" size="sm" ${this.state.consumers.length ? '' : 'disabled'}>Видалити всі прилади</ui-button>
                <ui-button class="clear-all-btn" variant="secondary" size="sm">Скинути весь проєкт</ui-button>
              </div>
            </div>
          </ui-card>
        </div>

        ${this.renderFeedback()}
        <consumers-summary></consumers-summary>

        <div class="consumers-page__layout">
          <div class="consumers-page__stack">
            ${this.renderZonesCard()}
            <ui-card padding="md"><consumer-form></consumer-form></ui-card>
          </div>
          <div class="consumers-page__list-wrap"><consumers-list></consumers-list></div>
        </div>

        <zone-modal></zone-modal>
        <consumer-modal></consumer-modal>
      </section>
    `;
  }

  afterRender() {
    const summary = this.shadowRoot.querySelector('consumers-summary');
    const form = this.shadowRoot.querySelector('consumer-form');
    const list = this.shadowRoot.querySelector('consumers-list');
    const zoneModal = this.shadowRoot.querySelector('zone-modal');
    const consumerModal = this.shadowRoot.querySelector('consumer-modal');

    summary.items = this.state.consumers;
    summary.settings = this.state.systemSettings;

    form.zones = this.state.zones;
    list.items = this.filteredItems;
    list.zones = this.state.zones;

    zoneModal.zones = this.state.zones;
    zoneModal.zone = this.zoneDraft;
    zoneModal.open = this.isZoneModalOpen;

    consumerModal.zones = this.state.zones;
    consumerModal.consumer = this.consumerDraft;
    consumerModal.open = this.isConsumerModalOpen;

    form.addEventListener('consumer-add', this.handleAdd);
    form.addEventListener('consumer-invalid', this.handleInvalid);
    form.addEventListener('open-zone-modal', this.handleOpenZoneModal);
    list.addEventListener('consumer-remove', this.handleRemove);
    list.addEventListener('consumer-edit', this.handleOpenConsumerModal);
    this.shadowRoot.querySelector('.clear-btn')?.addEventListener('ui-click', this.handleClear);
    this.shadowRoot.querySelector('.clear-all-btn')?.addEventListener('ui-click', this.handleClearAll);
    this.shadowRoot.querySelector('.zone-add-btn')?.addEventListener('ui-click', this.handleOpenZoneModal);
    this.shadowRoot.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', this.handleFilter));
    this.shadowRoot.querySelectorAll('[data-zone-remove]').forEach((button) => button.addEventListener('click', this.handleZoneRemove));
    this.shadowRoot.querySelectorAll('[data-zone-edit]').forEach((button) => button.addEventListener('click', this.handleZoneEdit));
    zoneModal.addEventListener('zone-save', this.handleZoneSave);
    zoneModal.addEventListener('zone-modal-close', this.handleCloseZoneModal);
    zoneModal.addEventListener('zone-modal-invalid', this.handleInvalid);
    consumerModal.addEventListener('consumer-save', this.handleConsumerSave);
    consumerModal.addEventListener('consumer-modal-close', this.handleCloseConsumerModal);
    consumerModal.addEventListener('consumer-modal-invalid', this.handleInvalid);
  }

  setFeedback(message, type = 'info') {
    this.feedback = message ? { message, type } : null;
  }

  handleAdd = (event) => {
    this.setFeedback('Прилад успішно додано до проєкту.', 'success');
    appStore.addConsumer(event.detail.consumer);
  };

  handleConsumerSave = (event) => {
    const consumer = event.detail?.consumer;
    const mode = event.detail?.mode;
    if (!consumer) return;

    if (mode === 'edit' && consumer.id) {
      appStore.updateConsumer(consumer.id, consumer);
      this.setFeedback(`Прилад «${consumer.name}» оновлено.`, 'success');
    } else {
      appStore.addConsumer(consumer);
      this.setFeedback(`Прилад «${consumer.name}» додано до проєкту.`, 'success');
    }

    this.isConsumerModalOpen = false;
    this.consumerDraft = null;
    this.update();
  };

  handleRemove = (event) => {
    if (!event.detail?.id) return;
    if (!window.confirm('Видалити цей прилад із проєкту?')) return;
    this.setFeedback('Прилад видалено.', 'info');
    appStore.removeConsumer(event.detail.id);
  };

  handleOpenConsumerModal = (event) => {
    this.consumerDraft = event.detail?.consumer || null;
    this.isConsumerModalOpen = true;
    this.update();
  };

  handleCloseConsumerModal = () => {
    this.isConsumerModalOpen = false;
    this.consumerDraft = null;
    this.update();
  };

  handleClear = () => {
    if (!this.state.consumers.length) return;
    if (!window.confirm('Ви впевнені, що хочете видалити всі прилади? Зони залишаться без змін.')) return;
    this.setFeedback('Усі прилади видалено. Зони та налаштування залишилися без змін.', 'info');
    appStore.clearConsumers();
  };

  handleClearAll = () => {
    if (!window.confirm('Ви впевнені, що хочете скинути весь проєкт? Буде видалено всі прилади, зони та налаштування.')) return;
    this.setFeedback('Проєкт скинуто до початкового стану.', 'info');
    appStore.clearAll();
  };

  handleInvalid = (event) => {
    const errors = event.detail?.errors || [];
    this.setFeedback(errors[0] || 'Перевірте заповнення форми.', 'error');
    this.update();
  };

  handleFilter = (event) => {
    this.filter = event.currentTarget.dataset.filter;
    this.setFeedback(this.hasFilteredConsumers ? '' : 'Для вибраного пріоритету приладів поки немає.', 'info');
    this.update();
  };

  handleOpenZoneModal = () => {
    this.zoneDraft = null;
    this.isZoneModalOpen = true;
    this.update();
  };

  handleCloseZoneModal = () => {
    this.zoneDraft = null;
    this.isZoneModalOpen = false;
    this.update();
  };

  handleZoneSave = (event) => {
    const zone = event.detail?.zone;
    const mode = event.detail?.mode;
    if (!zone) return;
    const exists = this.state.zones.some((item) => item.id !== zone.id && normalizeComparableString(item.name) === normalizeComparableString(zone.name));
    if (exists) {
      this.handleInvalid({ detail: { errors: ['Зона з такою назвою вже існує.'] } });
      return;
    }

    if (mode === 'edit' && zone.id) {
      appStore.updateZone(zone.id, { name: zone.name });
      this.setFeedback(`Зону «${zone.name}» оновлено.`, 'success');
    } else {
      appStore.addZone(zone);
      this.setFeedback(`Зону «${zone.name}» додано.`, 'success');
    }
    this.zoneDraft = null;
    this.isZoneModalOpen = false;
    this.update();
  };

  handleZoneEdit = (event) => {
    const zoneId = event.currentTarget.dataset.zoneEdit;
    this.zoneDraft = this.state.zones.find((item) => item.id === zoneId) || null;
    this.isZoneModalOpen = true;
    this.update();
  };

  handleZoneRemove = (event) => {
    const zoneId = event.currentTarget.dataset.zoneRemove;
    if (!zoneId) return;
    const zone = this.state.zones.find((item) => item.id === zoneId);
    const linkedConsumers = this.state.consumers.filter((item) => item.zoneId === zoneId).length;

    if (linkedConsumers) {
      this.setFeedback(`Зону «${zone?.name || 'Без назви'}» не можна видалити, доки в ній є прилади. Спочатку перенесіть або видаліть ${linkedConsumers} приладів.`, 'error');
      this.update();
      return;
    }

    if (!window.confirm(`Видалити зону «${zone?.name || 'Без назви'}»?`)) return;

    this.setFeedback('Зону видалено.', 'info');
    appStore.removeZone(zoneId);
  };
}

customElements.define('consumers-page', ConsumersPage);
