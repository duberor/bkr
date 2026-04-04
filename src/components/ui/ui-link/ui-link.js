import { BaseElement } from "../../base/base-element.js";
import styles from './ui-link.scss?inline';

class UiLink extends BaseElement {
  static get observedAttributes() {
    return ['href', 'target', 'active', 'icon'];
  }

  attributeChangedCallback() {
    if (this.isConnected) this.update();
  }

  styles() {
    return styles;
  }

  get icon() {
    return this.getAttribute('icon');
  }

  get href() {
    return this.getAttribute('href');
  }

  get target() {
    return this.getAttribute('target');
  }

  get active() {
    return this.hasAttribute('active');
  }

  get classes() {
    return this.getAttribute('class');
  }

  renderIcon() {
    if (!this.icon) return '';
    return `<ui-icon name="${this.icon}"></ui-icon>`;
  }

  render() {
    return `
      <a href="${this.href}"
        class="${this.classes}"
        active="${this.active}"
        target="${this.target}">

        ${this.renderIcon()}
        <slot></slot>
      </a >
  `;
  }
}

customElements.define('ui-link', UiLink);
