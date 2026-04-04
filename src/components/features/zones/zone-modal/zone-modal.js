import { BaseElement } from '../../../base/base-element.js';
import '../../../ui/ui-input/ui-input.js';
import '../../../ui/ui-button/ui-button.js';
import { normalizeComparableString } from '../../../../utils/number.js';
import styles from './zone-modal.scss?inline';

class ZoneModal extends BaseElement {
  constructor() {
    super();
    this._open = false;
    this._zones = [];
    this._zone = null;
    this.formData = { name: '' };
    this.errors = {};
  }

  styles() { return styles; }

  get open() { return this._open; }
  set open(value) {
    this._open = Boolean(value);
    if (!this._open) this.errors = {};
    if (this.isConnected) this.update();
  }

  get zones() { return this._zones; }
  set zones(value) { this._zones = Array.isArray(value) ? value : []; }

  get zone() { return this._zone; }
  set zone(value) {
    this._zone = value || null;
    this.formData = { name: value?.name || '' };
    this.errors = {};
    if (this.isConnected) this.update();
  }

  get mode() { return this._zone?.id ? 'edit' : 'create'; }

  render() {
    if (!this.open) return '';
    const title = this.mode === 'edit' ? 'Редагувати зону' : 'Нова зона';
    return `
      <div class="zone-modal__backdrop">
        <div class="zone-modal__dialog" role="dialog" aria-modal="true" aria-label="${title}">
          <div class="zone-modal__head">
            <div>
              <p class="zone-modal__eyebrow">Зона</p>
              <h2>${title}</h2>
            </div>
            <button class="zone-modal__close" type="button" aria-label="Закрити">×</button>
          </div>
          <div class="zone-modal__body">
            <ui-input name="name" label="Назва зони" placeholder="Наприклад, Кухня або Котельня" value="${this.formData.name}" error="${this.errors.name || ''}"></ui-input>
          </div>
          <div class="zone-modal__actions">
            <ui-button class="cancel-btn" variant="secondary">Скасувати</ui-button>
            <ui-button class="save-btn">${this.mode === 'edit' ? 'Зберегти зміни' : 'Зберегти зону'}</ui-button>
          </div>
        </div>
      </div>
    `;
  }

  afterRender() {
    this.shadowRoot.querySelector('.zone-modal__close')?.addEventListener('click', this.handleClose);
    this.shadowRoot.querySelector('.cancel-btn')?.addEventListener('ui-click', this.handleClose);
    this.shadowRoot.querySelector('.save-btn')?.addEventListener('ui-click', this.handleSave);
    this.shadowRoot.removeEventListener('ui-input', this.handleField);
    this.shadowRoot.addEventListener('ui-input', this.handleField);
    this.shadowRoot.querySelector('.zone-modal__backdrop')?.addEventListener('click', this.handleBackdropClick);
    document.addEventListener('keydown', this.handleEscape);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleEscape);
  }

  handleEscape = (event) => {
    if (event.key === 'Escape' && this.open) this.handleClose();
  };

  handleBackdropClick = (event) => {
    if (event.target.classList.contains('zone-modal__backdrop')) this.handleClose();
  };

  setFieldError(name, error = '') {
    const nextError = String(error || '');
    if (this.errors[name] === nextError) return;

    this.errors = { ...this.errors, [name]: nextError };
    const field = this.shadowRoot?.querySelector(`[name="${name}"]`);
    if (!field) return;

    if (nextError) field.setAttribute('error', nextError);
    else field.removeAttribute('error');
  }

  handleField = (event) => {
    const { name, value } = event.detail || {};
    if (!name) return;
    this.formData = { ...this.formData, [name]: value };
    this.setFieldError(name, '');
  };

  handleClose = () => {
    this.formData = { name: this._zone?.name || '' };
    this.errors = {};
    this.dispatchEvent(new CustomEvent('zone-modal-close', { bubbles: true, composed: true }));
  };

  handleSave = () => {
    const name = String(this.formData.name || '').trim();
    const comparable = normalizeComparableString(name);
    const errors = {};

    if (!name) errors.name = 'Вкажіть назву зони.';
    else if (name.length > 40) errors.name = 'Назва зони має бути коротшою за 40 символів.';
    else if (this._zones.some((zone) => zone.id !== this._zone?.id && normalizeComparableString(zone.name) === comparable)) errors.name = 'Зона з такою назвою вже існує.';

    if (Object.keys(errors).length) {
      this.errors = errors;
      this.dispatchEvent(new CustomEvent('zone-modal-invalid', {
        detail: { errors: Object.values(errors) }, bubbles: true, composed: true,
      }));
      this.update();
      return;
    }

    const zone = this.mode === 'edit'
      ? { ...this._zone, name }
      : { id: `zone-${crypto.randomUUID()}`, name };

    this.dispatchEvent(new CustomEvent('zone-save', {
      detail: { zone, mode: this.mode },
      bubbles: true,
      composed: true,
    }));
    this.formData = { name: '' };
    this.errors = {};
  };
}

customElements.define('zone-modal', ZoneModal);
