import { BaseElement } from '../../base/base-element.js';
import styles from './ui-disclosure.scss?inline';

class UiDisclosure extends BaseElement {
  static get observedAttributes() {
    return ['label', 'open'];
  }

  attributeChangedCallback(name) {
    // Не перебудовувати DOM коли наш власний toggle handler синхронізує атрибут —
    // нативний <details> уже відображає правильний стан, повторний render
    // створює гонку і ламає закриття.
    if (this._internalToggle) return;
    if (this.isConnected) this.update();
  }

  styles() {
    return styles;
  }

  get label() {
    return this.getAttribute('label') || 'Детальніше';
  }

  render() {
    return `
      <details class="disclosure" ${this.hasAttribute('open') ? 'open' : ''}>
        <summary class="disclosure__summary">${this.label}</summary>
        <div class="disclosure__body">
          <slot></slot>
        </div>
      </details>
    `;
  }

  afterRender() {
    const details = this.shadowRoot.querySelector('.disclosure');
    if (!details) return;
    details.addEventListener('toggle', () => {
      this._internalToggle = true;
      if (details.open) this.setAttribute('open', '');
      else this.removeAttribute('open');
      this._internalToggle = false;
      this.dispatchEvent(
        new CustomEvent('ui-disclosure-toggle', {
          detail: { open: details.open },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }
}

customElements.define('ui-disclosure', UiDisclosure);
