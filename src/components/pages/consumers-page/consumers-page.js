import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-button/ui-button.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import '../../ui/ui-confirm-dialog/ui-confirm-dialog.js';
import '../../features/consumers/consumer-library-picker/consumer-library-picker.js';
import '../../features/consumers/consumers-list/consumers-list.js';
import '../../features/consumers/consumer-modal/consumer-modal.js';
import '../../features/zones/zone-modal/zone-modal.js';
import '../../features/scenario-presets/scenario-presets.js';
import { appStore } from '../../../store/app-store.js';
import { escapeHtml } from '../../../utils/escape.js';
import { normalizeComparableString } from '../../../utils/number.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatPower, formatEnergyWh } from '../../../utils/format.js';
import { CONSUMER_CATEGORIES } from '../../../data/consumer-categories.js';
import { CONSUMER_LIBRARY } from '../../../data/consumer-library.js';
import { SCENARIO_PRESETS } from '../../../data/scenario-presets.js';
import styles from './consumers-page.scss?inline';

const CUSTOM_PRESETS_KEY = 'ups.customPresets.v1';
const CUSTOM_LIBRARY_KEY = 'ups.customLibrary.v1';

class ConsumersPage extends BaseElement {
  constructor() {
    super();
    this.state = appStore.getState();
    this.filter = 'all';      // priority filter
    this.catFilter = null;    // category filter
    this.isZoneModalOpen = false;
    this.zoneDraft = null;
    this.isConsumerModalOpen = false;
    this.consumerDraft = null;
    this.feedback = null;
    this.pendingTemplate = null;
    this.customPresets = this.loadCustomPresets();
    this.customLibrary = this.loadCustomLibrary();
    this.isLibraryPickerOpen = false;
    this.confirmDialog = this.getDefaultConfirmDialog();
  }

  connectedCallback() {
    this.unsubscribe = appStore.subscribe((state) => {
      this.state = state;
      if (this.isAnyModalOpen()) {
        this._pendingUpdate = true;
        return;
      }
      this.update();
    });
    super.connectedCallback();
  }

  isAnyModalOpen() {
    return (
      this.isConsumerModalOpen ||
      this.isZoneModalOpen ||
      this.isLibraryPickerOpen ||
      this.confirmDialog?.open
    );
  }

  safeUpdate() {
    if (this.isAnyModalOpen()) {
      this._pendingUpdate = true;
      return;
    }
    this.update();
  }

  flushPendingUpdate() {
    if (this._pendingUpdate) {
      this._pendingUpdate = false;
      this.update();
    }
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }
  styles() {
    return styles;
  }

  get filteredItems() {
    let items = this.state.consumers;
    if (this.filter !== 'all') {
      items = items.filter((item) => item.priority === this.filter);
    }
    if (this.catFilter) {
      items = items.filter((item) => item.category === this.catFilter);
    }
    return items;
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
    const has = Boolean(this.feedback?.message);
    const type = this.feedback?.type || 'info';
    const msg = this.feedback?.message || '';
    return `<div class="consumers-page__feedback consumers-page__feedback--${type}" role="status" aria-live="polite" data-feedback ${has ? '' : 'hidden'}>${has ? escapeHtml(msg) : ''}</div>`;
  }

  syncFeedbackDom() {
    const el = this.shadowRoot.querySelector('[data-feedback]');
    if (!el) return;
    const has = Boolean(this.feedback?.message);
    const type = this.feedback?.type || 'info';
    el.className = `consumers-page__feedback consumers-page__feedback--${type}`;
    el.textContent = has ? this.feedback.message : '';
    if (has) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }

  renderSteps() {
    const steps = [
      { hash: '#/dashboard', label: 'Огляд',   n: 1 },
      { hash: '#/consumers', label: 'Прилади', n: 2 },
      { hash: '#/system',    label: 'Система', n: 3 },
      { hash: '#/report',    label: 'Звіт',    n: 4 },
    ];
    return steps.map(({ hash, label, n }) => `
      <a class="cp-step ${location.hash === hash ? 'is-active' : ''}" href="${hash}">
        <span class="cp-step__num">${n}</span><span>${label}</span>
      </a>`).join('');
  }

  renderSidebar() {
    const consumers  = this.state.consumers;
    const allCount   = consumers.length;
    const isFiltered = this.filter !== 'all' || this.catFilter !== null;

    // Категорії з підрахунком (тільки ті що є в поточних приладах)
    const catRows = CONSUMER_CATEGORIES
      .filter((c) => consumers.some((i) => i.category === c.value))
      .map((c) => {
        const cnt = consumers.filter((i) => i.category === c.value).length;
        const isActive = this.catFilter === c.value;
        return `<div class="cp-sb-item ${isActive ? 'is-active' : ''}" data-cat-filter="${c.value}">
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

    const customPresetRows = this.customPresets.map((p) =>
      `<div class="cp-sb-item cp-sb-item--zone">
        <span data-custom-preset-id="${p.id}">${escapeHtml(p.title)}</span>
        <div class="cp-sb-zone-btns">
          <button class="cp-sb-icon-btn cp-sb-icon-btn--del" data-custom-preset-remove="${p.id}" title="Видалити">✕</button>
        </div>
      </div>`
    ).join('');

    return `
      <aside class="cp-sidebar">
        <div class="cp-sb-section">
          Фільтр
          ${isFiltered ? `<button class="cp-sb-reset" data-reset-filters>× Скинути</button>` : ''}
        </div>
        <div class="cp-sb-item ${this.filter === 'all' && !this.catFilter ? 'is-active' : ''}" data-filter="all">
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
        <button class="cp-sb-add" data-open-zone-modal>+ Нова зона</button>

        <div class="cp-sb-divider"></div>
        <div class="cp-sb-section">Пресети</div>
        ${presetRows}
        <button class="cp-sb-add" data-save-preset>+ Зберегти свій</button>
        ${customPresetRows || '<div class="cp-sb-empty">Власних пресетів ще немає</div>'}

        <div class="cp-sb-divider"></div>
        <div class="cp-sb-section">Зони</div>
        ${zoneRows || '<div class="cp-sb-empty">Зон ще немає</div>'}
        <button class="cp-sb-add" data-open-zone-modal>+ Додати зону</button>
      </aside>
    `;
  }

  renderSurgeAlert() {
    // Показуємо всіх з пусковим струмом — незалежно від співвідношення
    const surgeConsumers = this.state.consumers.filter(
      (c) => c.surgePower && Number(c.surgePower) > 0,
    );
    if (!surgeConsumers.length) return '';

    const items = surgeConsumers
      .map((c) => `${escapeHtml(c.name)}: ${c.power} Вт → ${c.surgePower} Вт пуск`)
      .join('; ');

    return `
      <div class="cp-alert cp-alert--warn">
        <span>⚠</span>
        <span>Пусковий струм: ${items}. Переконайтесь що інвертор витримає пуск.</span>
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
            <button class="cp-btn cp-btn--ghost" data-project-export ${this.state.consumers.length ? '' : 'disabled'}>Експорт</button>
            <button class="cp-btn cp-btn--ghost cp-btn--danger" data-project-clear ${this.state.consumers.length || this.state.zones.length ? '' : 'disabled'}>Очистити</button>
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
              <div class="cp-content__head-actions">
                <button class="cp-btn cp-btn--secondary" data-open-consumer-library>Вибір зі списку</button>
                <button class="cp-btn cp-btn--secondary" data-open-add-form>+ Додати прилад</button>
              </div>
            </div>

            <consumers-list></consumers-list>

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
      list.addEventListener('consumer-save-to-library', this.handleSaveToLibrary);
    }

    if (picker) {
      picker.customLibrary = this.customLibrary;
      picker.open = this.isLibraryPickerOpen;
      picker.addEventListener('consumer-library-select', this.handleLibrarySelect);
      picker.addEventListener('consumer-library-close', this.handleCloseLibraryPicker);
      picker.addEventListener('consumer-library-remove', this.handleCustomLibraryRemove);
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
      consumerModal.addEventListener('consumer-save-to-library', this.handleSaveToLibrary);
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

    this.shadowRoot.querySelectorAll('[data-custom-preset-id]').forEach((label) => {
      label.addEventListener('click', () => {
        const preset = this.customPresets.find((item) => item.id === label.dataset.customPresetId);
        if (!preset) return;
        appStore.replaceProject({
          consumers: preset.consumers || [],
          zones: preset.zones || [],
          systemSettings: preset.systemSettings || {},
          scenario: preset.scenario || {},
        });
        this.setFeedback(`Пресет «${preset.title}» застосовано.`, 'success');
      });
    });

    this.shadowRoot.querySelectorAll('[data-custom-preset-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.customPresetRemove;
        if (!id) return;
        this.customPresets = this.customPresets.filter((preset) => preset.id !== id);
        this.persistCustomPresets();
        this.setFeedback('Власний пресет видалено.', 'success');
        this.update();
      });
    });

    // Sidebar: zone edit/remove
    this.shadowRoot.querySelectorAll('[data-zone-edit]').forEach((btn) =>
      btn.addEventListener('click', this.handleZoneEdit),
    );
    this.shadowRoot.querySelectorAll('[data-zone-remove]').forEach((btn) =>
      btn.addEventListener('click', this.handleZoneRemove),
    );

    // Sidebar: категорійний фільтр
    this.shadowRoot.querySelectorAll('[data-cat-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.catFilter = btn.dataset.catFilter || null;
        this.filter = 'all'; // скидаємо пріоритетний фільтр при виборі категорії
        this.update();
      });
    });

    // Скинути всі фільтри
    this.shadowRoot.querySelector('[data-reset-filters]')?.addEventListener('click', () => {
      this.filter = 'all';
      this.catFilter = null;
      this.update();
    });

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

    this.shadowRoot.querySelector('[data-open-consumer-library]')?.addEventListener('click', () => {
      this.isLibraryPickerOpen = true;
      this.update();
    });

    // Import
    this.shadowRoot.querySelector('[data-project-import]')?.addEventListener('click', () => {
      this.shadowRoot.querySelector('[data-project-file]')?.click();
    });
    this.shadowRoot.querySelector('[data-project-export]')?.addEventListener('click', this.handleProjectExport);
    this.shadowRoot.querySelector('[data-project-clear]')?.addEventListener('click', this.handleClearAll);
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

    this.shadowRoot.querySelector('[data-save-preset]')?.addEventListener('click', () => {
      this.handleSaveCustomPreset();
      this.update();
    });
    this.shadowRoot.querySelector('.clear-btn')?.addEventListener('ui-click', this.handleClear);
    this.shadowRoot.querySelector('.clear-all-btn')?.addEventListener('ui-click', this.handleClearAll);
    this.shadowRoot.querySelectorAll('[data-list-action]').forEach((btn) =>
      btn.addEventListener('click', this.handleListAction),
    );
  }

  setFeedback(message, type = 'info') {
    this.feedback = message ? { message, type } : null;
    this.syncFeedbackDom();
    if (this._feedbackTimer) clearTimeout(this._feedbackTimer);
    if (message && type !== 'error') {
      this._feedbackTimer = setTimeout(() => {
        this.feedback = null;
        this.syncFeedbackDom();
      }, 4000);
    }
  }

  loadCustomPresets() {
    try {
      const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item === 'object' && item.id && item.title)
        .slice(0, 20);
    } catch {
      return [];
    }
  }

  persistCustomPresets() {
    try {
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(this.customPresets.slice(0, 20)));
    } catch {
      this.setFeedback('Не вдалося зберегти пресет у браузері.', 'error');
    }
  }

  handleSaveCustomPreset() {
    if (!this.state.consumers.length) {
      this.setFeedback('Немає приладів для збереження пресету.', 'error');
      return;
    }

    const defaultName = `Мій пресет ${new Date().toLocaleDateString('uk-UA')}`;
    const title = String(window.prompt('Назва вашого пресету:', defaultName) || '').trim();
    if (!title) return;

    const snapshot = {
      id: `custom-${Date.now()}`,
      title,
      consumers: structuredClone(this.state.consumers || []),
      zones: structuredClone(this.state.zones || []),
      systemSettings: structuredClone(this.state.systemSettings || {}),
      scenario: structuredClone(this.state.scenario || {}),
    };

    this.customPresets = [snapshot, ...this.customPresets].slice(0, 20);
    this.persistCustomPresets();
    this.setFeedback(`Пресет «${title}» збережено.`, 'success');
  }

  handleLibrarySelect = (event) => {
    const template = event.detail?.template;
    if (!template) return;
    const { id, __custom, ...rest } = template;
    this.consumerDraft = {
      ...rest,
      quantity: 1,
    };
    this.isLibraryPickerOpen = false;
    this.isConsumerModalOpen = true;
    this.setFeedback(`Шаблон «${template.name}» підставлено в форму.`, 'success');
    this.update();
  };

  handleCloseLibraryPicker = () => {
    this.isLibraryPickerOpen = false;
    this.update();
  };

  handleSaveToLibrary = (event) => {
    const template = event.detail?.template;
    if (!template?.name) return;
    const normalized = normalizeComparableString(template.name);
    const existsInCustom = this.customLibrary.some(
      (item) => normalizeComparableString(item.name) === normalized,
    );
    const existsInBuiltin = CONSUMER_LIBRARY.some(
      (item) => normalizeComparableString(item.name) === normalized,
    );
    if (existsInCustom) {
      this.setFeedback(`«${template.name}» уже є в типових.`, 'info');
      return;
    }
    if (existsInBuiltin) {
      this.setFeedback(`«${template.name}» уже є в стандартній бібліотеці.`, 'info');
      return;
    }
    const entry = { id: `custom-lib-${Date.now()}`, ...template };
    this.customLibrary = [entry, ...this.customLibrary].slice(0, 50);
    this.persistCustomLibrary();
    this.setFeedback(`«${template.name}» збережено в типові.`, 'success');
    // Не робимо повний this.update() — форма не повинна перерендеритися.
    // При наступному відкритті picker.customLibrary підхопиться в afterRender.
    this.safeUpdate();
  };

  handleCustomLibraryRemove = (event) => {
    const id = event.detail?.id;
    if (!id) return;
    this.customLibrary = this.customLibrary.filter((item) => item.id !== id);
    this.persistCustomLibrary();
    this.setFeedback('Прилад прибрано з типових.', 'info');
    // Patch picker напряму, щоб не втратити введений пошук
    const picker = this.shadowRoot.querySelector('consumer-library-picker');
    if (picker) {
      picker.customLibrary = this.customLibrary;
    } else {
      this.safeUpdate();
    }
  };

  loadCustomLibrary() {
    try {
      const raw = localStorage.getItem(CUSTOM_LIBRARY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && item.id && item.name).slice(0, 50);
    } catch {
      return [];
    }
  }

  persistCustomLibrary() {
    try {
      localStorage.setItem(CUSTOM_LIBRARY_KEY, JSON.stringify(this.customLibrary.slice(0, 50)));
    } catch {
      this.setFeedback('Не вдалося зберегти у браузері.', 'error');
    }
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
    this._pendingUpdate = false;
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

  handleProjectExport = () => {
    if (!this.state.consumers.length) {
      this.setFeedback('Нема що експортувати — додайте прилади.', 'error');
      return;
    }
    const project = {
      consumers: this.state.consumers,
      zones: this.state.zones,
      systemSettings: this.state.systemSettings,
      scenario: this.state.scenario,
    };
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      project,
    };

    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `ups-project-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.setFeedback('Проєкт експортовано у JSON.', 'success');
    } catch {
      this.setFeedback('Не вдалося сформувати файл експорту.', 'error');
    }
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
    this.catFilter = null; // скидаємо категорійний фільтр при виборі пріоритету
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
