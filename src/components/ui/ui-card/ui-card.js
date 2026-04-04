import { BaseElement } from '../../base/base-element.js';
import styles from './ui-card.scss?inline';

class UiCard extends BaseElement {
  static get observedAttributes() {
    return ['padding'];
  }

  attributeChangedCallback() {
    if (this.isConnected) this.update();
  }

  styles() {
    return styles;
  }

  get padding() {
    return this.getAttribute('padding') || 'md';
  }

  render() {
    return `
      <section class="card card--${this.padding}">
        <slot></slot>
      </section>
    `;
  }
}

customElements.define('ui-card', UiCard);