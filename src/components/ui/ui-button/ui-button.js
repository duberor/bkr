import { BaseElement } from '../../base/base-element.js';
import styles from './ui-button.scss?inline';

class UiButton extends BaseElement {
  static get observedAttributes() {
    return ['type', 'variant', 'size', 'disabled'];
  }

  attributeChangedCallback() {
    if (this.isConnected) this.update();
  }

  styles() {
    return styles;
  }

  get type() {
    return this.getAttribute('type') || 'button';
  }

  get variant() {
    return this.getAttribute('variant') || 'primary';
  }

  get size() {
    return this.getAttribute('size') || 'md';
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  render() {
    return `
      <button
        class="btn btn--${this.variant} btn--${this.size}"
        type="${this.type}"
        ${this.disabled ? 'disabled' : ''}
      ><span>
        <slot></slot></span>
      </button>
    `;
  }

  afterRender() {
    const button = this.shadowRoot.querySelector('.btn');

    button?.addEventListener('click', () => {
      if (this.disabled) return;

      this.dispatchEvent(
        new CustomEvent('ui-click', {
          bubbles: true,
          composed: true,
        }),
      );
    });
  }
}

customElements.define('ui-button', UiButton);
