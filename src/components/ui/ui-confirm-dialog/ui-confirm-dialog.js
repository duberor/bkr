import { BaseElement } from '../../base/base-element.js';
import '../ui-button/ui-button.js';
import { escapeHtml } from '../../../utils/escape.js';
import styles from './ui-confirm-dialog.scss?inline';

class UiConfirmDialog extends BaseElement {
  constructor() {
    super();
    this._open = false;
    this._title = 'Підтвердьте дію';
    this._message = '';
    this._confirmLabel = 'Підтвердити';
    this._cancelLabel = 'Скасувати';
  }

  styles() {
    return styles;
  }

  get open() {
    return this._open;
  }

  set open(value) {
    this._open = Boolean(value);
    if (this.isConnected) this.update();
  }

  get title() {
    return this._title;
  }

  set title(value) {
    this._title = String(value || '').trim() || 'Підтвердьте дію';
    if (this.isConnected) this.update();
  }

  get message() {
    return this._message;
  }

  set message(value) {
    this._message = String(value || '').trim();
    if (this.isConnected) this.update();
  }

  get confirmLabel() {
    return this._confirmLabel;
  }

  set confirmLabel(value) {
    this._confirmLabel = String(value || '').trim() || 'Підтвердити';
    if (this.isConnected) this.update();
  }

  get cancelLabel() {
    return this._cancelLabel;
  }

  set cancelLabel(value) {
    this._cancelLabel = String(value || '').trim() || 'Скасувати';
    if (this.isConnected) this.update();
  }

  render() {
    if (!this.open) return '';

    return `
      <div class="ui-confirm-dialog__backdrop">
        <div
          class="ui-confirm-dialog__dialog"
          role="dialog"
          aria-modal="true"
          aria-label="${escapeHtml(this.title)}"
        >
          <div class="ui-confirm-dialog__head">
            <div>
              <p class="ui-confirm-dialog__eyebrow">Підтвердження</p>
              <h2>${escapeHtml(this.title)}</h2>
            </div>
            <button class="ui-confirm-dialog__close" type="button" aria-label="Закрити">×</button>
          </div>

          ${
            this.message
              ? `<p class="ui-confirm-dialog__message">${escapeHtml(this.message)}</p>`
              : ''
          }

          <div class="ui-confirm-dialog__actions">
            <ui-button class="ui-confirm-dialog__cancel" variant="secondary">${escapeHtml(this.cancelLabel)}</ui-button>
            <ui-button class="ui-confirm-dialog__confirm">${escapeHtml(this.confirmLabel)}</ui-button>
          </div>
        </div>
      </div>
    `;
  }

  afterRender() {
    if (!this.open) return;

    this.shadowRoot
      .querySelector('.ui-confirm-dialog__close')
      ?.addEventListener('click', this.handleClose);
    this.shadowRoot
      .querySelector('.ui-confirm-dialog__cancel')
      ?.addEventListener('ui-click', this.handleClose);
    this.shadowRoot
      .querySelector('.ui-confirm-dialog__confirm')
      ?.addEventListener('ui-click', this.handleConfirm);
    this.shadowRoot
      .querySelector('.ui-confirm-dialog__backdrop')
      ?.addEventListener('click', this.handleBackdropClick);
    document.removeEventListener('keydown', this.handleEscape);
    document.addEventListener('keydown', this.handleEscape);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleEscape);
  }

  handleEscape = (event) => {
    if (event.key === 'Escape' && this.open) this.handleClose();
  };

  handleBackdropClick = (event) => {
    if (event.target.classList.contains('ui-confirm-dialog__backdrop')) this.handleClose();
  };

  handleClose = () => {
    this.dispatchEvent(
      new CustomEvent('confirm-dialog-close', {
        bubbles: true,
        composed: true,
      }),
    );
  };

  handleConfirm = () => {
    this.dispatchEvent(
      new CustomEvent('confirm-dialog-confirm', {
        bubbles: true,
        composed: true,
      }),
    );
  };
}

customElements.define('ui-confirm-dialog', UiConfirmDialog);
