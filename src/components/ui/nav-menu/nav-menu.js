import { BaseElement } from "../../base/base-element.js";
import styles from './nav-menu.scss?inline';
import '../ui-button/ui-button.js';

class NavMenu extends BaseElement {
  styles() {
    return styles;
  }

  render() {
    return `
      <nav class="navigation">
        <ul class="menu">
          <slot></slot>
        </ul>
      </nav>
    `;
  }
}

customElements.define('nav-menu', NavMenu);
