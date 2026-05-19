import { BaseElement } from '../../base/base-element.js';
import '../app-header/app-header.js';
import '../app-main/app-main.js';

import styles from './app-root.scss?inline';

class AppRoot extends BaseElement {
  styles() {
    return styles;
  }

  render() {
    return `
      <div class="app">
        <app-header class="app__header"></app-header>
        <app-main class="app__main"></app-main>
      </div>
    `;
  }
}

customElements.define('app-root', AppRoot);
