import { BaseElement } from '../../base/base-element.js';
import '../../pages/dashboard-page/dashboard-page.js';
import '../../pages/consumers-page/consumers-page.js';
import '../../pages/system-page/system-page.js';
import '../../pages/products-page/products-page.js';
import '../../pages/report-page/report-page.js';
import { FEATURES } from '../../../config/features.js';

import styles from './app-main.scss?inline';

const routeMap = {
  '#/dashboard': 'dashboard-page',
  '#/consumers': 'consumers-page',
  '#/calculation': 'system-page',
  '#/system': 'system-page',
  ...(FEATURES.productsPage ? { '#/products': 'products-page' } : {}),
  '#/report': 'report-page',
};

class AppMain extends BaseElement {
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this.handleHashChange);
    if (!location.hash) {
      location.hash = '#/dashboard';
    }
    this.redirectDisabledRoutes();
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.handleHashChange);
  }

  styles() {
    return styles;
  }

  render() {
    const pageTag = routeMap[location.hash || '#/dashboard'] || 'dashboard-page';

    return `
      <main class="main">
        <section class="main__content">
          <${pageTag}></${pageTag}>
        </section>
      </main>
    `;
  }

  handleHashChange = () => {
    this.redirectDisabledRoutes();
    this.update();
  };

  redirectDisabledRoutes() {
    if (!FEATURES.productsPage && location.hash === '#/products') {
      location.hash = '#/dashboard';
    }
  }
}

customElements.define('app-main', AppMain);
