import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-input/ui-input.js';
import '../../ui/ui-select/ui-select.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import '../../ui/ui-tooltip/ui-tooltip.js';
import { parseLocaleNumber } from '../../../utils/number.js';
import {
  getRecommendedBatteryType,
  getRecommendedBatteryVoltage,
} from '../../../utils/consumer-utils.js';
import styles from './system-settings-form.scss?inline';

class SystemSettingsForm extends BaseElement {
  constructor() {
    super();
    this._items = [];
    this._settings = {
      batteryVoltage: 24,
      batteryVoltageMode: 'auto',
      batteryType: 'lifepo4',
      batteryTypeMode: 'auto',
      targetAutonomyHours: 24,
      autonomyInputUnit: 'days',
      inverterEfficiency: 0.92,
      topology: 'line-interactive',
      hasGenerator: false,
      reserveRatio: 1.2,
      batteryReserveRatio: 1.15,
    };
    this.draft = this.buildDraftFromSettings(this._settings);
    this.errors = {};
  }

  styles() {
    return styles;
  }
  get settings() {
    return this._settings;
  }

  get items() {
    return this._items;
  }

  set items(value) {
    this._items = Array.isArray(value) ? value : [];
    if (this.isConnected) this.update();
  }

  set settings(value) {
    this._settings = { ...this._settings, ...(value || {}) };
    this.draft = this.buildDraftFromSettings(this._settings);
    if (this.isConnected) this.update();
  }

  formatAutonomyDraftValue(targetAutonomyHours, autonomyInputUnit = 'hours') {
    const hours = Number(targetAutonomyHours || 24);
    if (autonomyInputUnit === 'days') {
      return String(Number((hours / 24).toFixed(hours % 24 ? 2 : 0)));
    }

    return String(Number(hours.toFixed(hours % 1 ? 2 : 0)));
  }

  parseAutonomyDraftValue(
    value,
    autonomyInputUnit = 'hours',
    fallback = this._settings.targetAutonomyHours || 24,
  ) {
    const parsed = parseLocaleNumber(value);
    if (!Number.isFinite(parsed)) return fallback;

    const hours = autonomyInputUnit === 'days' ? parsed * 24 : parsed;
    return Number(hours.toFixed(2));
  }

  buildDraftFromSettings(settings = this._settings) {
    const autonomyInputUnit = settings.autonomyInputUnit || 'days';
    return {
      targetAutonomyValue: this.formatAutonomyDraftValue(
        settings.targetAutonomyHours,
        autonomyInputUnit,
      ),
      autonomyInputUnit,
      inverterEfficiency: String(settings.inverterEfficiency ?? ''),
      topology: settings.topology || 'line-interactive',
      hasGenerator: !!settings.hasGenerator,
      reserveRatio: String(settings.reserveRatio ?? ''),
      batteryReserveRatio: String(settings.batteryReserveRatio ?? ''),
    };
  }

  validateField(name, value, draft = this.draft) {
    if (name === 'targetAutonomyValue') {
      const hours = this.parseAutonomyDraftValue(value, draft.autonomyInputUnit, NaN);
      if (!Number.isFinite(hours)) return 'Вкажіть бажаний час роботи числом.';
      if (hours < 1 || hours > 720)
        return 'Бажаний час роботи має бути в межах від 1 години до 30 діб.';
    }

    if (name === 'inverterEfficiency') {
      const parsed = parseLocaleNumber(value);
      if (!Number.isFinite(parsed)) return 'Вкажіть ККД числом.';
      if (parsed < 0.7 || parsed > 0.99) return 'ККД має бути в межах від 0.7 до 0.99.';
    }

    if (name === 'reserveRatio') {
      const parsed = parseLocaleNumber(value);
      if (!Number.isFinite(parsed)) return 'Вкажіть запас по інвертору числом.';
      if (parsed < 1 || parsed > 2) return 'Запас по інвертору має бути в межах від 1 до 2.';
    }

    if (name === 'batteryReserveRatio') {
      const parsed = parseLocaleNumber(value);
      if (!Number.isFinite(parsed)) return 'Вкажіть запас по АКБ числом.';
      if (parsed < 1 || parsed > 1.8) return 'Запас по АКБ має бути в межах від 1 до 1.8.';
    }

    return '';
  }

  get isVoltageAuto() {
    return this.settings.batteryVoltageMode !== 'manual';
  }

  get isBatteryTypeAuto() {
    return this.settings.batteryTypeMode !== 'manual';
  }

  renderAutoBadge() {
    return `
      <span class="settings-form__auto-badge">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1.5l1.45 3.05L12.5 6 9.45 7.45 8 10.5 6.55 7.45 3.5 6l3.05-1.45L8 1.5z"></path>
          <path d="M12.5 10.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8.8-1.7z"></path>
        </svg>
        Авто
      </span>
    `;
  }

  renderModeAction({ isAuto, toggleField, autoText, manualText }) {
    return `
      <button
        type="button"
        class="settings-form__mode-icon"
        data-selection-mode-field="${toggleField}"
        data-next-mode="${isAuto ? 'manual' : 'auto'}"
        aria-label="${isAuto ? autoText : manualText}"
        title="${isAuto ? autoText : manualText}"
      >
        ${
          isAuto
            ? `
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10.9 2.1a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1l-7.3 7.3-2.9.8.8-2.9 7.4-7.2z"></path>
            <path d="M9.8 3.2l3 3"></path>
          </svg>
        `
            : `
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.5l1.45 3.05L12.5 6 9.45 7.45 8 10.5 6.55 7.45 3.5 6l3.05-1.45L8 1.5z"></path>
            <path d="M12.5 10.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8.8-1.7z"></path>
          </svg>
        `
        }
      </button>
    `;
  }

  renderModeHint({ isAuto, toggleField, autoText, manualText, autoHint, manualHint }) {
    return `
      <div class="settings-form__mode-row">
        <span class="settings-form__mode-hint">${isAuto ? autoHint : manualHint}</span>
      </div>
    `;
  }

  syncAutoSelections() {
    const nextSettings = { ...this._settings };
    let hasChanges = false;

    if (this.isVoltageAuto) {
      const recommendedVoltage = getRecommendedBatteryVoltage(this.items, nextSettings);
      if (recommendedVoltage !== nextSettings.batteryVoltage) {
        nextSettings.batteryVoltage = recommendedVoltage;
        hasChanges = true;
      }
    }

    if (this.isBatteryTypeAuto) {
      const recommendedBatteryType = getRecommendedBatteryType(this.items, nextSettings);
      if (recommendedBatteryType !== nextSettings.batteryType) {
        nextSettings.batteryType = recommendedBatteryType;
        hasChanges = true;
      }
    }

    if (!hasChanges) return;

    this._settings = nextSettings;
    this.emitSettingsChange();

    if (this.isConnected) {
      this.update();
    }
  }

  render() {
    return `
      <section class="settings-form">
        <div class="settings-form__head">
          <p class="settings-form__eyebrow">Налаштування</p>
          <div class="settings-form__title-row">
            <h2>Що потрібно від системи</h2>
            <ui-tooltip label="Пояснення" text="Спочатку задайте базові параметри. Додаткові налаштування змінюйте лише тоді, коли точно розумієте їхній вплив."></ui-tooltip>
          </div>
        </div>
        <div class="settings-form__grid settings-form__grid--primary">
          <div class="settings-form__smart-field">
            <div class="settings-form__field-head">
              <div class="settings-form__field-label-row">
                <span class="settings-form__field-label">Напруга системи</span>
                ${this.isVoltageAuto ? this.renderAutoBadge() : '<span class="settings-form__manual-badge">Вручну</span>'}
              </div>
              ${this.renderModeAction({
                isAuto: this.isVoltageAuto,
                toggleField: 'batteryVoltage',
                autoText: 'Змінити вручну',
                manualText: 'Повернути авто',
              })}
            </div>
            <ui-select
              name="batteryVoltage"
              label=""
              ${this.isVoltageAuto ? 'disabled' : ''}
            ></ui-select>
            ${this.renderModeHint({
              isAuto: this.isVoltageAuto,
              autoHint: 'Підібрано автоматично під систему',
              manualHint: 'Значення вибрано вручну',
            })}
          </div>
          <div class="settings-form__smart-field">
            <div class="settings-form__field-head">
              <div class="settings-form__field-label-row">
                <span class="settings-form__field-label">Тип акумуляторів</span>
                ${this.isBatteryTypeAuto ? this.renderAutoBadge() : '<span class="settings-form__manual-badge">Вручну</span>'}
              </div>
              ${this.renderModeAction({
                isAuto: this.isBatteryTypeAuto,
                toggleField: 'batteryType',
                autoText: 'Змінити вручну',
                manualText: 'Повернути авто',
              })}
            </div>
            <ui-select
              name="batteryType"
              label=""
              ${this.isBatteryTypeAuto ? 'disabled' : ''}
            ></ui-select>
            ${this.renderModeHint({
              isAuto: this.isBatteryTypeAuto,
              autoHint: 'Рекомендовано для резервного живлення',
              manualHint: 'Тип вибрано вручну',
            })}
          </div>
          <ui-input type="text" name="targetAutonomyValue" label="Бажаний час роботи" placeholder="Наприклад, 6 або 2" value="${this.draft.targetAutonomyValue}" error="${this.errors.targetAutonomyValue || ''}"></ui-input>
          <ui-select name="autonomyInputUnit" label="Одиниця часу"></ui-select>
        </div>
        <div class="settings-form__grid">
            <ui-select name="topology" label="Тип системи"></ui-select>
            <label class="settings-form__checkbox">
              <input type="checkbox" name="hasGenerator" ${this.settings.hasGenerator ? 'checked' : ''} />
              <span>Є генератор як резервне джерело</span>
            </label>
          </div>
        <ui-disclosure label="Додаткові налаштування для точнішого підбору">
          <div class="settings-form__advanced">
            <div class="settings-form__grid settings-form__grid--advanced">
              <ui-input type="text" name="inverterEfficiency" label="ККД інвертора" placeholder="Наприклад, 0,92" value="${this.draft.inverterEfficiency}" error="${this.errors.inverterEfficiency || ''}"></ui-input>
              <ui-input type="text" name="reserveRatio" label="Запас по інвертору" placeholder="Наприклад, 1,2" value="${this.draft.reserveRatio}" error="${this.errors.reserveRatio || ''}"></ui-input>
              <ui-input type="text" name="batteryReserveRatio" label="Запас по АКБ" placeholder="Наприклад, 1,15" value="${this.draft.batteryReserveRatio}" error="${this.errors.batteryReserveRatio || ''}"></ui-input>
            </div>
          </div>
        </ui-disclosure>
      </section>
    `;
  }

  afterRender() {
    const voltage = this.shadowRoot.querySelector('ui-select[name="batteryVoltage"]');
    const batteryType = this.shadowRoot.querySelector('ui-select[name="batteryType"]');
    const autonomyInputUnit = this.shadowRoot.querySelector('ui-select[name="autonomyInputUnit"]');

    if (voltage) {
      voltage.options = [
        { value: '12', label: '12 V · малі системи' },
        { value: '24', label: '24 V · базовий вибір' },
        { value: '48', label: '48 V · потужні системи' },
      ];
      voltage.value = String(this.settings.batteryVoltage);
    }

    if (batteryType) {
      batteryType.options = [
        { value: 'lifepo4', label: 'LiFePO4 · рекомендовано' },
        { value: 'agm', label: 'AGM · бюджетніше' },
        { value: 'gel', label: 'GEL · альтернатива' },
      ];
      batteryType.value = this.settings.batteryType;
    }

    if (autonomyInputUnit) {
      autonomyInputUnit.options = [
        { value: 'hours', label: 'Години' },
        { value: 'days', label: 'Доби' },
      ];
      autonomyInputUnit.value = this.draft.autonomyInputUnit;
    }

    this.shadowRoot.removeEventListener('ui-input', this.handleField);
    this.shadowRoot.removeEventListener('ui-change', this.handleField);
    this.shadowRoot.addEventListener('ui-input', this.handleField);
    this.shadowRoot.addEventListener('ui-change', this.handleField);
    this.shadowRoot
      .querySelectorAll('[data-selection-mode-field]')
      .forEach((button) => button.addEventListener('click', this.handleSelectionModeToggle));
  }

  setFieldError(name, error = '') {
    const nextError = String(error || '');
    if (this.errors[name] === nextError) return;

    this.errors = { ...this.errors, [name]: nextError };
    const field = this.shadowRoot?.querySelector(`[name="${name}"]`);
    if (!field) return;

    if (nextError) field.setAttribute('error', nextError);
    else field.removeAttribute('error');
  }

  setInputValue(name, value) {
    const field = this.shadowRoot?.querySelector(`ui-input[name="${name}"]`);
    if (field && field.value !== String(value ?? '')) {
      field.value = String(value ?? '');
    }
  }

  emitSettingsChange() {
    this.dispatchEvent(
      new CustomEvent('system-settings-change', {
        detail: { settings: { ...this._settings } },
        bubbles: true,
        composed: true,
      }),
    );
  }

  handleField = (event) => {
    const { name, value } = event.detail || {};
    if (!name) return;
    const isCommit = event.type === 'ui-change';

    if (name === 'batteryVoltage') {
      if (!isCommit) return;
      this._settings = {
        ...this._settings,
        batteryVoltage: parseLocaleNumber(value, this._settings.batteryVoltage || 24),
      };
      this.emitSettingsChange();
      return;
    }

    if (name === 'batteryType') {
      if (!isCommit) return;
      this._settings = { ...this._settings, batteryType: String(value || 'lifepo4') };
      this.emitSettingsChange();
      return;
    }

    if (name === 'autonomyInputUnit') {
      if (!isCommit) return;
      const nextUnit = value === 'days' ? 'days' : 'hours';
      const autonomyHours = this.parseAutonomyDraftValue(
        this.draft.targetAutonomyValue,
        this.draft.autonomyInputUnit,
        this._settings.targetAutonomyHours,
      );

      this.draft = {
        ...this.draft,
        autonomyInputUnit: nextUnit,
        targetAutonomyValue: this.formatAutonomyDraftValue(autonomyHours, nextUnit),
      };
      this._settings = {
        ...this._settings,
        autonomyInputUnit: nextUnit,
        targetAutonomyHours: autonomyHours,
      };
      this.setInputValue('targetAutonomyValue', this.draft.targetAutonomyValue);
      this.setFieldError(
        'targetAutonomyValue',
        this.validateField('targetAutonomyValue', this.draft.targetAutonomyValue, this.draft),
      );
      this.emitSettingsChange();
      this.update();
      return;
    }

    if (
      ![
        'targetAutonomyValue',
        'inverterEfficiency',
        'reserveRatio',
        'batteryReserveRatio',
      ].includes(name)
    )
      return;

    this.draft = { ...this.draft, [name]: String(value ?? '') };
    const nextError = this.validateField(name, this.draft[name], this.draft);
    this.setFieldError(name, nextError);

    if (!isCommit || nextError) return;

    let normalized = parseLocaleNumber(this.draft[name], this._settings[name]);

    if (name === 'targetAutonomyValue') {
      normalized = this.parseAutonomyDraftValue(
        this.draft[name],
        this.draft.autonomyInputUnit,
        this._settings.targetAutonomyHours,
      );
      normalized = Math.min(720, Math.max(1, Number(normalized.toFixed(2))));
    }

    if (name === 'inverterEfficiency') {
      normalized = Math.min(0.99, Math.max(0.7, Number(normalized.toFixed(2))));
    }

    if (name === 'reserveRatio') {
      normalized = Math.min(2, Math.max(1, Number(normalized.toFixed(2))));
    }

    if (name === 'batteryReserveRatio') {
      normalized = Math.min(1.8, Math.max(1, Number(normalized.toFixed(2))));
    }

    if (name === 'targetAutonomyValue') {
      this._settings = {
        ...this._settings,
        targetAutonomyHours: normalized,
        autonomyInputUnit: this.draft.autonomyInputUnit,
      };
      this.draft = {
        ...this.draft,
        targetAutonomyValue: this.formatAutonomyDraftValue(
          normalized,
          this.draft.autonomyInputUnit,
        ),
      };
      this.setInputValue(name, this.draft.targetAutonomyValue);
      this.emitSettingsChange();
      return;
    }

    this.draft = { ...this.draft, [name]: String(normalized) };
    this.setInputValue(name, this.draft[name]);
    this._settings = {
      ...this._settings,
      [name]: normalized,
    };
    this.emitSettingsChange();
  };

  handleSelectionModeToggle = (event) => {
    const field = event.currentTarget.dataset.selectionModeField;
    const nextMode = event.currentTarget.dataset.nextMode === 'manual' ? 'manual' : 'auto';
    if (!field) return;

    if (field === 'batteryVoltage') {
      const nextSettings = {
        ...this._settings,
        batteryVoltageMode: nextMode,
      };

      if (nextMode === 'auto') {
        nextSettings.batteryVoltage = getRecommendedBatteryVoltage(this.items, nextSettings);
      }

      this._settings = nextSettings;
      this.emitSettingsChange();
      this.update();
      return;
    }

    if (field === 'batteryType') {
      const nextSettings = {
        ...this._settings,
        batteryTypeMode: nextMode,
      };

      if (nextMode === 'auto') {
        nextSettings.batteryType = getRecommendedBatteryType(this.items, nextSettings);
      }

      this._settings = nextSettings;
      this.emitSettingsChange();
      this.update();
    }
  };
}

customElements.define('system-settings-form', SystemSettingsForm);
