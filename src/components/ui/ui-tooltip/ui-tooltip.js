import { BaseElement } from '../../base/base-element.js';
import styles from './ui-tooltip.scss?inline';

class UiTooltip extends BaseElement {
  static get observedAttributes() {
    return ['label', 'text'];
  }

  constructor() {
    super();
    this._open = false;
  }

  attributeChangedCallback() {
    if (this.isConnected) this.update();
  }

  connectedCallback() {
    this._onDocClick = (event) => {
      const path = event.composedPath?.() || [];
      if (!path.includes(this)) {
        this._open = false;
        this.update();
      }
    };
    this._onKeyDown = (event) => {
      if (event.key === 'Escape' && this._open) {
        this._open = false;
        this.update();
      }
    };
    document.addEventListener('click', this._onDocClick);
    document.addEventListener('keydown', this._onKeyDown);
    super.connectedCallback();
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onKeyDown);
  }

  styles() { return styles; }
  get label() { return this.getAttribute('label') || 'Підказка'; }
  get text() { return this.getAttribute('text') || ''; }

  render() {
    return `
      <span class="tooltip ${this._open ? 'is-open' : ''}">
        <button class="tooltip__trigger" type="button" aria-label="${this.label}" aria-expanded="${this._open}">?</button>
        <span class="tooltip__bubble" role="tooltip">${this.text}</span>
      </span>
    `;
  }

  afterRender() {
    this.shadowRoot.querySelector('.tooltip__trigger')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this._open = !this._open;
      this.update();
    });
  }
}

customElements.define('ui-tooltip', UiTooltip);
