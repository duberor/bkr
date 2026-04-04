import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-input/ui-input.js';
import '../../ui/ui-select/ui-select.js';
import '../../ui/ui-tooltip/ui-tooltip.js';
import { parseLocaleNumber } from '../../../utils/number.js';
import styles from './system-settings-form.scss?inline';

class SystemSettingsForm extends BaseElement {
  constructor() {
    super();
    this._settings = {
      batteryVoltage: 24,
      batteryType: 'lifepo4',
      autonomyDays: 1,
      inverterEfficiency: 0.92,
      reserveRatio: 1.2,
      simultaneityFactor: 0.85,
      batteryReserveRatio: 1.15,
    };
    this.draft = this.buildDraftFromSettings(this._settings);
    this.errors = {};
  }

  styles() { return styles; }
  get settings() { return this._settings; }
  set settings(value) {
    this._settings = { ...this._settings, ...(value || {}) };
    this.draft = this.buildDraftFromSettings(this._settings);
    if (this.isConnected) this.update();
  }

  buildDraftFromSettings(settings = this._settings) {
    return {
      autonomyDays: String(settings.autonomyDays ?? ''),
      inverterEfficiency: String(settings.inverterEfficiency ?? ''),
      reserveRatio: String(settings.reserveRatio ?? ''),
      simultaneityFactor: String(settings.simultaneityFactor ?? ''),
      batteryReserveRatio: String(settings.batteryReserveRatio ?? ''),
    };
  }

  validateField(name, value) {
    if (name === 'autonomyDays') {
      const parsed = parseLocaleNumber(value);
      if (!Number.isFinite(parsed)) return 'Вкажіть автономність числом.';
      if (parsed < 1 || parsed > 30) return 'Автономність має бути від 1 до 30 діб.';
    }

    if (name === 'inverterEfficiency') {
      const parsed = parseLocaleNumber(value);
      if (!Number.isFinite(parsed)) return 'Вкажіть ККД числом.';
      if (parsed < 0.7 || parsed > 0.99) return 'ККД має бути в межах від 0.7 до 0.99.';
    }

    if (name === 'reserveRatio') {
      const parsed = parseLocaleNumber(value);
      if (!Number.isFinite(parsed)) return 'Вкажіть запас числом.';
      if (parsed < 1 || parsed > 2) return 'Запас має бути в межах від 1 до 2.';
    }

    if (name === 'simultaneityFactor') {
      const parsed = parseLocaleNumber(value);
      if (!Number.isFinite(parsed)) return 'Вкажіть коефіцієнт числом.';
      if (parsed < 0.4 || parsed > 1) return 'Коефіцієнт одночасності має бути в межах від 0.4 до 1.';
    }

    if (name === 'batteryReserveRatio') {
      const parsed = parseLocaleNumber(value);
      if (!Number.isFinite(parsed)) return 'Вкажіть резерв числом.';
      if (parsed < 1 || parsed > 1.8) return 'Запас АКБ має бути в межах від 1 до 1.8.';
    }

    return '';
  }

  render() {
    return `
      <section class="settings-form">
        <div class="settings-form__head">
          <p class="settings-form__eyebrow">Налаштування</p>
          <div class="settings-form__title-row">
            <h2>Параметри системи</h2>
            <ui-tooltip label="Пояснення" text="Тут задаються напруга системи, тип АКБ, бажаний час роботи, запас інвертора та запас АКБ."></ui-tooltip>
          </div>
        </div>
        <div class="settings-form__grid">
          <ui-select name="batteryVoltage" label="Напруга системи"></ui-select>
          <ui-select name="batteryType" label="Тип АКБ"></ui-select>
          <ui-input type="text" name="autonomyDays" label="Бажаний час роботи, діб" placeholder="Наприклад, 1 або 2" value="${this.draft.autonomyDays}" error="${this.errors.autonomyDays || ''}"></ui-input>
          <ui-input type="text" name="inverterEfficiency" label="ККД інвертора" placeholder="Наприклад, 0,92" value="${this.draft.inverterEfficiency}" error="${this.errors.inverterEfficiency || ''}"></ui-input>
          <ui-input type="text" name="reserveRatio" label="Запас інвертора" placeholder="Наприклад, 1,2" value="${this.draft.reserveRatio}" error="${this.errors.reserveRatio || ''}"></ui-input>
          <ui-input type="text" name="simultaneityFactor" label="Одночасність роботи" placeholder="Наприклад, 0,85" value="${this.draft.simultaneityFactor}" error="${this.errors.simultaneityFactor || ''}"></ui-input>
          <ui-input type="text" name="batteryReserveRatio" label="Запас АКБ" placeholder="Наприклад, 1,15" value="${this.draft.batteryReserveRatio}" error="${this.errors.batteryReserveRatio || ''}"></ui-input>
        </div>
      </section>
    `;
  }

  afterRender() {
    const voltage = this.shadowRoot.querySelector('ui-select[name="batteryVoltage"]');
    const batteryType = this.shadowRoot.querySelector('ui-select[name="batteryType"]');

    if (voltage) {
      voltage.options = [{ value: '12', label: '12 V' }, { value: '24', label: '24 V' }, { value: '48', label: '48 V' }];
      voltage.value = String(this.settings.batteryVoltage);
    }

    if (batteryType) {
      batteryType.options = [{ value: 'agm', label: 'AGM' }, { value: 'gel', label: 'GEL' }, { value: 'lifepo4', label: 'LiFePO4' }];
      batteryType.value = this.settings.batteryType;
    }

    this.shadowRoot.removeEventListener('ui-input', this.handleField);
    this.shadowRoot.removeEventListener('ui-change', this.handleField);
    this.shadowRoot.addEventListener('ui-input', this.handleField);
    this.shadowRoot.addEventListener('ui-change', this.handleField);
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
    this.dispatchEvent(new CustomEvent('system-settings-change', {
      detail: { settings: { ...this._settings } },
      bubbles: true,
      composed: true,
    }));
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

    if (!['autonomyDays', 'inverterEfficiency', 'reserveRatio', 'simultaneityFactor', 'batteryReserveRatio'].includes(name)) return;

    this.draft = { ...this.draft, [name]: String(value ?? '') };
    const nextError = this.validateField(name, this.draft[name]);
    this.setFieldError(name, nextError);

    if (!isCommit || nextError) return;

    let normalized = parseLocaleNumber(this.draft[name], this._settings[name]);

    if (name === 'autonomyDays') {
      normalized = Math.min(30, Math.max(1, Math.round(normalized)));
    }

    if (name === 'inverterEfficiency') {
      normalized = Math.min(0.99, Math.max(0.7, Number(normalized.toFixed(2))));
    }

    if (name === 'reserveRatio') {
      normalized = Math.min(2, Math.max(1, Number(normalized.toFixed(2))));
    }

    if (name === 'simultaneityFactor') {
      normalized = Math.min(1, Math.max(0.4, Number(normalized.toFixed(2))));
    }

    if (name === 'batteryReserveRatio') {
      normalized = Math.min(1.8, Math.max(1, Number(normalized.toFixed(2))));
    }

    this.draft = { ...this.draft, [name]: String(normalized) };
    this.setInputValue(name, this.draft[name]);
    this._settings = {
      ...this._settings,
      [name]: normalized,
    };
    this.emitSettingsChange();
  };
}

customElements.define('system-settings-form', SystemSettingsForm);
