import { BaseElement } from '../../base/base-element.js';
import styles from './ui-disclosure.scss?inline';

class UiDisclosure extends BaseElement {
  static get observedAttributes() {
    return ['label', 'open'];
  }

  attributeChangedCallback() {
    if (this.isConnected) this.update();
  }

  styles() {
    return styles;
  }

  get label() {
    return this.getAttribute('label') || 'Показати деталі';
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
}

customElements.define('ui-disclosure', UiDisclosure);
