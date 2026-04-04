import { BaseElement } from '../../base/base-element.js';
import styles from './ui-input.scss?inline';
import { escapeAttr, escapeHtml } from '../../../utils/escape.js';

class UiInput extends BaseElement {
  static get observedAttributes() {
    return [
      'type',
      'name',
      'value',
      'label',
      'placeholder',
      'min',
      'max',
      'step',
      'required',
      'disabled',
      'rows',
      'error',
      'hint',
    ];
  }

  constructor() {
    super();
    this._value = this.getAttribute('value') || '';
    this._focusControlAfterRender = false;
    this._selectionStart = null;
    this._selectionEnd = null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'value') {
      this._value = newValue || '';
      const control = this.shadowRoot?.querySelector('.field__control');
      if (control && control.value !== this._value) {
        control.value = this._value;
      }
      return;
    }

    if (this.isConnected) {
      const control = this.shadowRoot?.querySelector('.field__control');
      const isFocused = Boolean(control)
        && (this.shadowRoot?.activeElement === control || document.activeElement === this);

      if (isFocused) {
        this._focusControlAfterRender = true;
        if (typeof control.selectionStart === 'number') {
          this._selectionStart = control.selectionStart;
          this._selectionEnd = control.selectionEnd;
        }
      }

      this.update();
    }
  }

  styles() {
    return styles;
  }

  get type() { return this.getAttribute('type') || 'text'; }
  get name() { return this.getAttribute('name') || ''; }
  get value() { return this._value; }
  set value(newValue) {
    this._value = String(newValue ?? '');
    const control = this.shadowRoot?.querySelector('.field__control');
    if (control && control.value !== this._value) {
      control.value = this._value;
    }
  }
  get label() { return this.getAttribute('label') || ''; }
  get placeholder() { return this.getAttribute('placeholder') || ''; }
  get min() { return this.getAttribute('min') || ''; }
  get max() { return this.getAttribute('max') || ''; }
  get step() { return this.getAttribute('step') || ''; }
  get rows() { return Number(this.getAttribute('rows') || 4); }
  get required() { return this.hasAttribute('required'); }
  get disabled() { return this.hasAttribute('disabled'); }
  get error() { return this.getAttribute('error') || ''; }
  get hint() { return this.getAttribute('hint') || ''; }

  render() {
    const messageId = this.name ? `${this.name}-message` : '';
    const sharedAttrs = `
      name="${escapeAttr(this.name)}"
      placeholder="${escapeAttr(this.placeholder)}"
      ${this.min ? `min="${escapeAttr(this.min)}"` : ''}
      ${this.max ? `max="${escapeAttr(this.max)}"` : ''}
      ${this.step ? `step="${escapeAttr(this.step)}"` : ''}
      ${this.required ? 'required' : ''}
      ${this.disabled ? 'disabled' : ''}
      ${messageId ? `aria-describedby="${escapeAttr(messageId)}"` : ''}
      ${this.error ? 'aria-invalid="true"' : 'aria-invalid="false"'}
    `;

    const control = this.type === 'textarea'
      ? `<textarea class="field__control field__control--textarea ${this.error ? 'is-error' : ''}" rows="${this.rows}" ${sharedAttrs}>${escapeHtml(this.value)}</textarea>`
      : `<input class="field__control ${this.error ? 'is-error' : ''}" type="${escapeAttr(this.type)}" value="${escapeAttr(this.value)}" ${sharedAttrs} />`;

    const message = this.error || this.hint;

    return `
      <label class="field ${this.error ? 'has-error' : ''}">
        ${this.label ? `<span class="field__label">${escapeHtml(this.label)}</span>` : ''}
        ${control}
        ${message ? `<span id="${escapeAttr(messageId)}" class="field__message ${this.error ? 'field__message--error' : ''}">${escapeHtml(message)}</span>` : ''}
      </label>
    `;
  }

  afterRender() {
    const input = this.shadowRoot.querySelector('.field__control');
    if (!input) return;

    input.addEventListener('input', (event) => {
      this.value = event.target.value;
      this.dispatchEvent(new CustomEvent('ui-input', {
        detail: { value: event.target.value, name: this.name },
        bubbles: true,
        composed: true,
      }));
    });

    input.addEventListener('change', (event) => {
      this.value = event.target.value;
      this.dispatchEvent(new CustomEvent('ui-change', {
        detail: { value: event.target.value, name: this.name },
        bubbles: true,
        composed: true,
      }));
    });

    if (this._focusControlAfterRender) {
      input.focus();
      if (
        typeof input.setSelectionRange === 'function'
        && typeof this._selectionStart === 'number'
        && typeof this._selectionEnd === 'number'
      ) {
        input.setSelectionRange(this._selectionStart, this._selectionEnd);
      }
      this._focusControlAfterRender = false;
      this._selectionStart = null;
      this._selectionEnd = null;
    }
  }
}

customElements.define('ui-input', UiInput);
