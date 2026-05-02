import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-button/ui-button.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import '../../ui/ui-confirm-dialog/ui-confirm-dialog.js';
import '../../features/consumers/consumer-library-picker/consumer-library-picker.js';
import '../../features/consumers/consumer-form/consumer-form.js';
import '../../features/consumers/consumers-list/consumers-list.js';
import '../../features/consumers/consumers-summary/consumers-summary.js';
import '../../features/consumers/consumer-modal/consumer-modal.js';
import '../../features/zones/zone-modal/zone-modal.js';
import '../../features/scenario-presets/scenario-presets.js';
import { appStore } from '../../../store/app-store.js';
import { escapeHtml } from '../../../utils/escape.js';
import { normalizeComparableString } from '../../../utils/number.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatPower, formatEnergyWh } from '../../../utils/format.js';
import { CONSUMER_CATEGORIES } from '../../../data/consumer-categories.js';
import { SCENARIO_PRESETS } from '../../../data/scenario-presets.js';
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
    this.pendingTemplate = null;
    this.confirmDialog = this.getDefaultConfirmDialog();
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

  get filteredItems() {
    if (this.filter === 'all') return this.state.consumers;
    return this.state.consumers.filter((item) => item.priority === this.filter);
  }

  get hasFilteredConsumers() {
    return this.filteredItems.length > 0;
  }

  getDefaultConfirmDialog() {
    return {
      open: false,
      action: '',
      payload: null,
      title: '',
      message: '',
      confirmLabel: 'Підтвердити',
      cancelLabel: 'Скасувати',
    };
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
            ${
              this.state.zones.length
                ? this.state.zones
                    .map((zone) => {
                      const linkedConsumers = this.state.consumers.filter(
                        (consumer) => consumer.zoneId === zone.id,
                      ).length;
                      return `
                <div class="zone-pill">
                  <div class="zone-pill__meta">
                    <span>${escapeHtml(zone.name)}</span>
                    <small>${linkedConsumers} приладів</small>
                  </div>
                  <div class="zone-pill__actions">
                    <button
                      type="button"
                      class="zone-pill__action-btn"
                      data-zone-edit="${zone.id}"
                      aria-label="Редагувати ${escapeHtml(zone.name)}"
                      title="Редагувати"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M10.9 2.1a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1l-7.3 7.3-2.9.8.8-2.9 7.4-7.2z"></path>
                        <path d="M9.8 3.2l3 3"></path>
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="zone-pill__action-btn zone-pill__action-btn--danger"
                      data-zone-remove="${zone.id}"
                      aria-label="Видалити ${escapeHtml(zone.name)}"
                      title="Видалити"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M2.5 4.5h11"></path>
                        <path d="M6.5 1.5h3"></path>
                        <path d="M5 4.5v8"></path>
                        <path d="M8 4.5v8"></path>
                        <path d="M11 4.5v8"></path>
                        <path d="M3.5 4.5l.5 9a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l.5-9"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              `;
                    })
                    .join('')
                : '<p class="zones-card__empty">Зон поки немає.</p>'
            }
          </div>
        </section>
      </ui-card>
    `;
  }

  renderListTools() {
    return `
      <div class="consumers-page__list-tools">
        ${
          this.state.consumers.length
            ? `
          <div class="consumers-page__filters">
            <span class="consumers-page__filters-label">Фільтр списку</span>
            <div class="chips chips--compact">
              <button data-filter="all" class="chip ${this.filter === 'all' ? 'is-active' : ''}">Усі</button>
              <button data-filter="high" class="chip ${this.filter === 'high' ? 'is-active' : ''}">Критично</button>
              <button data-filter="medium" class="chip ${this.filter === 'medium' ? 'is-active' : ''}">Бажано</button>
              <button data-filter="low" class="chip ${this.filter === 'low' ? 'is-active' : ''}">Необов’язково</button>
            </div>
          </div>
        `
            : ''
        }
        <div class="consumers-page__cta-row">
          <button
            type="button"
            class="consumers-page__icon-btn"
            data-list-action="expand-all"
            aria-label="Розгорнути всі зони"
            title="Розгорнути всі зони"
            ${this.state.consumers.length ? '' : 'disabled'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 6l5 5 5-5" />
              <path d="M7 13l5 5 5-5" />
            </svg>
          </button>
          <button
            type="button"
            class="consumers-page__icon-btn"
            data-list-action="collapse-all"
            aria-label="Згорнути всі зони"
            title="Згорнути всі зони"
            ${this.state.consumers.length ? '' : 'disabled'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 11l5-5 5 5" />
              <path d="M7 18l5-5 5 5" />
            </svg>
          </button>
          <ui-button class="clear-btn" variant="secondary" size="sm" ${this.state.consumers.length ? '' : 'disabled'}>Видалити всі прилади</ui-button>
        </div>
      </div>
    `;
  }

  renderProjectActions() {
    return `
      <ui-card padding="md">
        <section class="consumers-page__project-actions">
          <div class="consumers-page__project-actions-head">
            <div>
              <p class="page-eyebrow">Проєкт</p>
              <h2>Керування проєктом</h2>
            </div>
          </div>
          <ui-disclosure label="Небезпечні дії">
            <div class="consumers-page__project-actions-body">
              <ui-button class="clear-all-btn" variant="secondary" size="sm">Скинути весь проєкт</ui-button>
            </div>
          </ui-disclosure>
        </section>
      </ui-card>
    `;
  }

  /* ── Steps topbar ── */
  renderSteps() {
    const steps = [
      { hash: '#/dashboard', label: 'Огляд',   n: 1 },
      { hash: '#/consumers', label: 'Прилади', n: 2 },
      { hash: '#/system',    label: 'Система', n: 3 },
      { hash: '#/report',    label: 'Звіт',    n: 4 },
    ];
    return steps.map(({ hash, label, n }) => `
      <a class="cp-step ${location.hash === hash ? 'is-active' : ''}" href="${hash}">
        <span class="cp-step__num">${n}</span>
        <span>${label}</span>
      </a>`).join('');
  }

  /* ── Sidebar ── */
  renderSidebar() {
    const categories = CONSUMER_CATEGORIES;
    const consumers  = this.state.consumers;
    const allCount   = consumers.length;

    // Категорії з підрахунком
    const catRows = categories
      .filter((c) => consumers.some((i) => i.category === c.value))
      .map((c) => {
        const cnt = consumers.filter((i) => i.category === c.value).length;
        return `<div class="cp-sb-item" data-cat-filter="${c.value}">
          ${escapeHtml(c.label)} <span class="cp-sb-count">${cnt}</span>
        </div>`;
      }).join('');

    // Зони
    const zoneRows = this.state.zones.map((z) => {
      const cnt = consumers.filter((i) => i.zoneId === z.id).length;
      return `<div class="cp-sb-item cp-sb-item--zone">
        <span>${escapeHtml(z.name)}</span>
        <span class="cp-sb-count">${cnt}</span>
        <div class="cp-sb-zone-btns">
          <button class="cp-sb-icon-btn" data-zone-edit="${z.id}" title="Редагувати">✏</button>
          <button class="cp-sb-icon-btn cp-sb-icon-btn--del" data-zone-remove="${z.id}" title="Видалити">✕</button>
        </div>
      </div>`;
    }).join('');

    // Пресети
    const presetRows = SCENARIO_PRESETS.map((p) =>
      `<div class="cp-sb-item" data-preset-id="${p.id}">${escapeHtml(p.title)}</div>`
    ).join('');

    return `
      <aside class="cp-sidebar">
        <div class="cp-sb-section">Категорії</div>
        <div class="cp-sb-item ${this.filter === 'all' ? 'is-active' : ''}" data-filter="all">
          Усі прилади <span class="cp-sb-count">${allCount}</span>
        </div>
        <div class="cp-sb-item ${this.filter === 'high' ? 'is-active' : ''}" data-filter="high">
          Критичні <span class="cp-sb-count">${consumers.filter(c=>c.priority==='high').length}</span>
        </div>
        <div class="cp-sb-item ${this.filter === 'medium' ? 'is-active' : ''}" data-filter="medium">
          Бажані <span class="cp-sb-count">${consumers.filter(c=>c.priority==='medium').length}</span>
        </div>
        <div class="cp-sb-item ${this.filter === 'low' ? 'is-active' : ''}" data-filter="low">
          Необов'язкові <span class="cp-sb-count">${consumers.filter(c=>c.priority==='low').length}</span>
        </div>
        ${catRows}
        <button class="cp-sb-add" data-open-zone-modal>+ Нова категорія</button>

        <div class="cp-sb-divider"></div>
        <div class="cp-sb-section">Пресети</div>
        ${presetRows}
        <button class="cp-sb-add">+ Зберегти свій</button>

        <div class="cp-sb-divider"></div>
        <div class="cp-sb-section">Зони</div>
        ${zoneRows || '<div class="cp-sb-empty">Зон ще немає</div>'}
        <button class="cp-sb-add" data-open-zone-modal>+ Додати зону</button>
      </aside>
    `;
  }

  /* ── Persistent surge alert ── */
  renderSurgeAlert() {
    const highSurge = this.state.consumers.find(
      (c) => c.surgePower && c.surgePower > c.power * 3,
    );
    if (!highSurge) return '';
    return `
      <div class="cp-alert cp-alert--warn">
        <span>⚠</span>
        <span>${escapeHtml(highSurge.name)}: номінал ${highSurge.power} Вт, пусковий струм ${highSurge.surgePower} Вт.
        Переконайтесь що інвертор витримає пуск.</span>
      </div>
    `;
  }

  /* ── Footer summary ── */
  renderFooter() {
    const calc = getSystemCalculation(this.state.consumers, this.state.systemSettings);
    const surgeTotal = this.state.consumers.reduce(
      (s, c) => s + Number(c.surgePower || c.power || 0) * Number(c.quantity || 1), 0,
    );
    const dailyWh = this.state.consumers.reduce(
      (s, c) => s + Number(c.power || 0) * Number(c.quantity || 1) * Number(c.hoursPerDay || 0), 0,
    );
    return `
      <div class="cp-footer">
        <div class="cp-footer__stats">
          <div class="cp-footer__stat">
            Разом: <strong>${formatPower(calc.totalPower)}</strong>
          </div>
          <div class="cp-footer__stat ${surgeTotal > 1000 ? 'cp-footer__stat--warn' : ''}">
            Пуск: <strong>${formatPower(surgeTotal)}</strong>
          </div>
          <div class="cp-footer__stat">
            Добова: <strong>${formatEnergyWh(dailyWh)}</strong>
          </div>
        </div>
        <a href="#/system" class="cp-footer__btn">Система →</a>
      </div>
    `;
  }

  render() {
    return `
      <div class="cp-page">

        <!-- topbar -->
        <div class="cp-topbar">
          <nav class="cp-steps">${this.renderSteps()}</nav>
          <div class="cp-topbar__actions">
            <button class="cp-btn cp-btn--ghost" data-project-import>Імпорт</button>
            <input class="cp-file-input" type="file" accept="application/json,.json" data-project-file />
          </div>
        </div>

        <!-- layout -->
        <div class="cp-layout">
          ${this.renderSidebar()}

          <div class="cp-content">
            ${this.renderFeedback()}
            ${this.renderSurgeAlert()}

            <div class="cp-content__head">
              <span class="cp-label">СПОЖИВАЧІ</span>
              <button class="cp-btn cp-btn--secondary" data-open-consumer-library>Вибір зі списку</button>
            </div>

            <consumers-list></consumers-list>

            <button class="cp-add-btn" data-open-add-form>+ Додати прилад</button>

            ${this.renderFooter()}
          </div>
        </div>

        <!-- modals -->
        <consumer-library-picker></consumer-library-picker>
        <consumer-modal></consumer-modal>
        <zone-modal></zone-modal>
        <ui-confirm-dialog></ui-confirm-dialog>

      </div>
    `;
  }

  afterRender() {
    const list         = this.shadowRoot.querySelector('consumers-list');
    const picker       = this.shadowRoot.querySelector('consumer-library-picker');
    const zoneModal    = this.shadowRoot.querySelector('zone-modal');
    const consumerModal= this.shadowRoot.querySelector('consumer-modal');
    const confirmDialog= this.shadowRoot.querySelector('ui-confirm-dialog');

    if (list) {
      list.items = this.filteredItems;
      list.zones = this.state.zones;
      list.emptyMessage = this.state.consumers.length
        ? 'Для вибраного фільтру приладів немає.'
        : 'Додайте перший прилад, щоб побачити список.';
      list.addEventListener('consumer-remove', this.handleRemove);
      list.addEventListener('consumer-edit', this.handleOpenConsumerModal);
    }

    if (picker) {
      picker.addEventListener('consumer-library-select', this.handleLibrarySelect);
    }

    if (zoneModal) {
      zoneModal.zones = this.state.zones;
      zoneModal.zone  = this.zoneDraft;
      zoneModal.open  = this.isZoneModalOpen;
      zoneModal.addEventListener('zone-save', this.handleZoneSave);
      zoneModal.addEventListener('zone-modal-close', this.handleCloseZoneModal);
      zoneModal.addEventListener('zone-modal-invalid', this.handleInvalid);
    }

    if (consumerModal) {
      consumerModal.zones    = this.state.zones;
      consumerModal.consumer = this.consumerDraft;
      consumerModal.open     = this.isConsumerModalOpen;
      consumerModal.addEventListener('consumer-save', this.handleConsumerSave);
      consumerModal.addEventListener('consumer-modal-close', this.handleCloseConsumerModal);
      consumerModal.addEventListener('consumer-modal-invalid', this.handleInvalid);
    }

    if (confirmDialog) {
      confirmDialog.title        = this.confirmDialog.title;
      confirmDialog.message      = this.confirmDialog.message;
      confirmDialog.confirmLabel = this.confirmDialog.confirmLabel;
      confirmDialog.cancelLabel  = this.confirmDialog.cancelLabel;
      confirmDialog.open         = this.confirmDialog.open;
      confirmDialog.addEventListener('confirm-dialog-close', this.handleCloseConfirmDialog);
      confirmDialog.addEventListener('confirm-dialog-confirm', this.handleConfirmDialogConfirm);
    }

    // Sidebar: фільтр по пріоритету / категорії
    this.shadowRoot.querySelectorAll('[data-filter]').forEach((btn) =>
      btn.addEventListener('click', this.handleFilter),
    );

    // Sidebar: preset click
    this.shadowRoot.querySelectorAll('[data-preset-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = SCENARIO_PRESETS.find((p) => p.id === btn.dataset.presetId);
        if (!preset) return;
        appStore.replaceProject({
          consumers: preset.consumers || [],
          zones: preset.zones || [],
          systemSettings: preset.systemSettings || {},
          scenario: preset.scenario || {},
        });
      });
    });

    // Sidebar: zone edit/remove
    this.shadowRoot.querySelectorAll('[data-zone-edit]').forEach((btn) =>
      btn.addEventListener('click', this.handleZoneEdit),
    );
    this.shadowRoot.querySelectorAll('[data-zone-remove]').forEach((btn) =>
      btn.addEventListener('click', this.handleZoneRemove),
    );

    // Open zone modal
    this.shadowRoot.querySelectorAll('[data-open-zone-modal]').forEach((btn) =>
      btn.addEventListener('click', this.handleOpenZoneModal),
    );

    // Open consumer modal (add)
    this.shadowRoot.querySelector('[data-open-add-form]')?.addEventListener('click', () => {
      this.consumerDraft = null;
      this.isConsumerModalOpen = true;
      this.update();
    });

    // Open consumer library picker
    this.shadowRoot.querySelector('[data-open-consumer-library]')?.addEventListener('click', () => {
      picker?.open?.();
    });

    // Import
    this.shadowRoot.querySelector('[data-project-import]')?.addEventListener('click', () => {
      this.shadowRoot.querySelector('[data-project-file]')?.click();
    });
    this.shadowRoot.querySelector('[data-project-file]')?.addEventListener('change', async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        const raw = await file.text();
        const payload = JSON.parse(raw);
        const project = payload?.project && typeof payload.project === 'object' ? payload.project : payload;
        appStore.replaceProject(project);
        this.setFeedback('Проєкт успішно імпортовано.', 'success');
      } catch {
        this.setFeedback('Не вдалося імпортувати файл.', 'error');
      }
      e.target.value = '';
      this.update();
    });

    // Legacy: clear buttons still in page
    this.shadowRoot.querySelector('.clear-btn')?.addEventListener('ui-click', this.handleClear);
    this.shadowRoot.querySelector('.clear-all-btn')?.addEventListener('ui-click', this.handleClearAll);
    this.shadowRoot.querySelectorAll('[data-list-action]').forEach((btn) =>
      btn.addEventListener('click', this.handleListAction),
    );
  }

  setFeedback(message, type = 'info') {
    this.feedback = message ? { message, type } : null;
  }

  handleLibrarySelect = (event) => {
    const template = event.detail?.template;
    if (!template) return;
    this.pendingTemplate = {
      ...template,
      quantity: 1,
    };
    this.setFeedback(`Шаблон «${template.name}» підставлено в форму.`, 'success');
    this.update();
  };

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
    const consumerId = event.detail?.id;
    if (!consumerId) return;

    this.openConfirmDialog({
      action: 'remove-consumer',
      payload: { consumerId },
      title: 'Видалити прилад?',
      message:
        'Прилад буде видалено з проєкту. Цю дію можна буде компенсувати лише повторним додаванням.',
      confirmLabel: 'Видалити',
    });
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

    this.openConfirmDialog({
      action: 'clear-consumers',
      title: 'Видалити всі прилади?',
      message: 'Буде видалено всі прилади. Зони та налаштування проєкту залишаться без змін.',
      confirmLabel: 'Видалити все',
    });
  };

  handleClearAll = () => {
    this.openConfirmDialog({
      action: 'clear-project',
      title: 'Скинути весь проєкт?',
      message:
        'Буде видалено всі прилади, зони та налаштування. Після цього проєкт повернеться до початкового стану.',
      confirmLabel: 'Скинути проєкт',
    });
  };

  handleInvalid = (event) => {
    const errors = event.detail?.errors || [];
    this.setFeedback(errors[0] || 'Перевірте заповнення форми.', 'error');
    this.update();
  };

  handleFilter = (event) => {
    this.filter = event.currentTarget.dataset.filter;
    this.setFeedback(
      this.hasFilteredConsumers ? '' : 'Для вибраної важливості приладів поки немає.',
      'info',
    );
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
    const exists = this.state.zones.some(
      (item) =>
        item.id !== zone.id &&
        normalizeComparableString(item.name) === normalizeComparableString(zone.name),
    );
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
      this.handleInvalid({
        detail: {
          errors: [`Зону «${zone?.name || 'Без назви'}» не можна видалити, поки в ній є прилади.`],
        },
      });
      return;
    }

    this.openConfirmDialog({
      action: 'remove-zone',
      payload: { zoneId },
      title: `Видалити зону «${zone?.name || 'Без назви'}»?`,
      message:
        'Зона буде видалена з проєкту. Якщо вона знадобиться знову, її доведеться створити повторно.',
      confirmLabel: 'Видалити',
    });
  };

  handleListAction = (event) => {
    const action = event.currentTarget.dataset.listAction;
    const list = this.shadowRoot.querySelector('consumers-list');
    if (!list) return;

    if (action === 'expand-all') {
      list.expandAll();
      return;
    }

    if (action === 'collapse-all') {
      list.collapseAll();
    }
  };

  openConfirmDialog({
    action,
    payload = null,
    title = 'Підтвердьте дію',
    message = '',
    confirmLabel = 'Підтвердити',
    cancelLabel = 'Скасувати',
  }) {
    this.confirmDialog = {
      open: true,
      action,
      payload,
      title,
      message,
      confirmLabel,
      cancelLabel,
    };
    this.update();
  }

  handleCloseConfirmDialog = () => {
    this.confirmDialog = this.getDefaultConfirmDialog();
    this.update();
  };

  handleConfirmDialogConfirm = () => {
    const { action, payload } = this.confirmDialog;

    if (action === 'remove-consumer' && payload?.consumerId) {
      this.setFeedback('Прилад видалено.', 'info');
      appStore.removeConsumer(payload.consumerId);
    }

    if (action === 'clear-consumers') {
      this.setFeedback('Усі прилади видалено. Зони та налаштування залишилися без змін.', 'info');
      appStore.clearConsumers();
    }

    if (action === 'clear-project') {
      this.setFeedback('Проєкт скинуто до початкового стану.', 'info');
      appStore.clearAll();
    }

    if (action === 'remove-zone' && payload?.zoneId) {
      appStore.removeZone(payload.zoneId);
      this.setFeedback('Зону видалено.', 'info');
    }

    this.confirmDialog = this.getDefaultConfirmDialog();
    this.update();
  };
}

customElements.define('consumers-page', ConsumersPage);
