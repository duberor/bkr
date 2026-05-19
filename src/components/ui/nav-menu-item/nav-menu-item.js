import { BaseElement } from '../../base/base-element.js';
import styles from './nav-menu-item.scss?inline';

class NavMenuItem extends BaseElement {
  static get observedAttributes() {
    return ['class'];
  }

  attributeChangedCallback() {
    if (this.isConnected) this.update();
  }

  get class() {
    return this.getAttribute('class');
  }

  styles() {
    return styles;
  }

  render() {
    return `
      <li class="${this.class}">
        <slot><slot/>
      </li>
    `;
  }
}

customElements.define('nav-menu-item', NavMenuItem);
