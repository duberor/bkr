import { BaseElement } from '../../base/base-element.js';
import logo from '../../../assets/images/logo.svg';
import { appStore } from '../../../store/app-store.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatEnergyWh, formatPower } from '../../../utils/format.js';
import { FEATURES } from '../../../config/features.js';

import '../../ui/ui-button/ui-button.js';
import styles from './app-header.scss?inline';

const navItems = [
  { hash: '#/dashboard', label: 'Огляд' },
  { hash: '#/consumers', label: 'Прилади' },
  { hash: '#/calculation', label: 'Параметри' },
  { hash: '#/system', label: 'Рішення' },
  ...(FEATURES.productsPage ? [{ hash: '#/products', label: 'Обладнання' }] : []),
  { hash: '#/report', label: 'Звіт' },
];

class AppHeader extends BaseElement {
  constructor() {
    super();
    this.state = appStore.getState();
    this.isAboutOpen = false;
  }

  connectedCallback() {
    this.unsubscribe = appStore.subscribe((state) => {
      this.state = state;
      this.update();
    });
    super.connectedCallback();
    window.addEventListener('hashchange', this.handleHashChange);
    document.addEventListener('keydown', this.handleDocumentKeydown);
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    window.removeEventListener('hashchange', this.handleHashChange);
    document.removeEventListener('keydown', this.handleDocumentKeydown);
  }

  styles() {
    return styles;
  }

  get currentHash() {
    return location.hash || '#/dashboard';
  }

  renderNav() {
    return navItems.map((item) => `
      <a class="header__nav-link ${this.currentHash === item.hash ? 'is-active' : ''}" href="${item.hash}">${item.label}</a>
    `).join('');
  }

  renderAboutModal() {
    if (!this.isAboutOpen) return '';

    return `
      <div class="header__modal-backdrop" data-close-about>
        <div class="header__modal" role="dialog" aria-modal="true" aria-labelledby="about-title">
          <div class="header__modal-head">
            <div>
              <p class="header__modal-eyebrow">Про застосунок</p>
              <h2 id="about-title">UPS Planner Pro</h2>
            </div>
            <button type="button" class="header__modal-close" data-close-about aria-label="Закрити вікно">×</button>
          </div>

          <div class="header__modal-body">
            <div class="header__modal-section">
              <h3>Авторка проєкту</h3>
              <p><strong>Павлюк Світлана Романівна</strong></p>
              <p>Спеціальність 121 — Інженерія програмного забезпечення.</p>
            </div>
          </div>

          <div class="header__modal-actions">
            <ui-button class="header__modal-ok" variant="primary" size="md">Зрозуміло</ui-button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const calc = getSystemCalculation(this.state.consumers, this.state.systemSettings);

    return `
      <header class="header">
        <div class="header__brand">
          <a class="header__logo" href="#/dashboard" aria-label="На головну">
            <img class="header__logo-image" src="${logo}" alt="UPS Planner" />
          </a>
          <div class="header__brand-copy">
            <strong>UPS Planner Pro</strong>
            <span>Підбір систем резервного живлення</span>
          </div>
        </div>

        <nav class="header__nav">${this.renderNav()}</nav>

        <div class="header__meta">
          <div class="header__stat">
            <span>Потужність приладів</span>
            <strong>${formatPower(calc.totalPower)}</strong>
          </div>
          <div class="header__stat">
            <span>Споживання за добу</span>
            <strong>${formatEnergyWh(calc.dailyConsumptionWh)}</strong>
          </div>
        </div>
      </header>

      ${this.renderAboutModal()}
    `;
  }

  afterRender() {
    this.shadowRoot.querySelector('.header__about')?.addEventListener('ui-click', this.openAbout);
    this.shadowRoot.querySelectorAll('[data-close-about]').forEach((node) => {
      node.addEventListener('click', this.handleMaybeCloseAbout);
    });
    this.shadowRoot.querySelector('.header__modal-ok')?.addEventListener('ui-click', this.closeAbout);
    this.shadowRoot.querySelector('.header__modal')?.addEventListener('click', (event) => event.stopPropagation());
  }

  handleMaybeCloseAbout = (event) => {
    const isBackdrop = event.target.hasAttribute('data-close-about');
    const isCloseButton = event.target.closest('[data-close-about]') && event.target.closest('.header__modal-close');
    if (isBackdrop || isCloseButton) {
      this.closeAbout();
    }
  };

  openAbout = () => {
    this.isAboutOpen = true;
    this.update();
  };

  closeAbout = () => {
    this.isAboutOpen = false;
    this.update();
  };

  handleHashChange = () => this.update();

  handleDocumentKeydown = (event) => {
    if (event.key === 'Escape' && this.isAboutOpen) {
      this.closeAbout();
    }
  };
}

customElements.define('app-header', AppHeader);
