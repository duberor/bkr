import { BaseElement } from '../../base/base-element.js';
import '../planner-summary/planner-summary.js';
import styles from './planner-shell.scss?inline';

const steps = [
  { hash: '#/dashboard', label: 'Огляд' },
  { hash: '#/consumers', label: 'Прилади' },
  { hash: '#/system', label: 'Система' },
  { hash: '#/report', label: 'Звіт' },
];

class PlannerShell extends BaseElement {
  static get observedAttributes() {
    return [
      'eyebrow',
      'title',
      'lead',
      'step',
      'next-href',
      'next-label',
      'prev-href',
      'prev-label',
    ];
  }

  styles() {
    return styles;
  }

  get eyebrow() {
    return this.getAttribute('eyebrow') || '';
  }
  get title() {
    return this.getAttribute('title') || '';
  }
  get lead() {
    return this.getAttribute('lead') || '';
  }
  get step() {
    return Number(this.getAttribute('step') || 1);
  }
  get nextHref() {
    return this.getAttribute('next-href') || '';
  }
  get nextLabel() {
    return this.getAttribute('next-label') || '';
  }
  get prevHref() {
    return this.getAttribute('prev-href') || '';
  }
  get prevLabel() {
    return this.getAttribute('prev-label') || '';
  }

  renderSteps() {
    return steps
      .map(
        (item, index) => `
      <a class="planner-shell__step ${index + 1 === this.step ? 'is-active' : ''}" href="${item.hash}">
        <span class="planner-shell__step-index">${index + 1}</span>
        <span>${item.label}</span>
      </a>
    `,
      )
      .join('');
  }

  renderActions() {
    if (!this.prevHref && !this.nextHref) return '';

    return `
      <footer class="planner-shell__actions">
        ${this.prevHref ? `<a class="planner-shell__action" href="${this.prevHref}">${this.prevLabel || 'Назад'}</a>` : '<span></span>'}
        ${this.nextHref ? `<a class="planner-shell__action planner-shell__action--primary" href="${this.nextHref}">${this.nextLabel || 'Далі'}</a>` : ''}
      </footer>
    `;
  }

  render() {
    return `
      <section class="planner-shell">
        <header class="planner-shell__head">
          <div class="planner-shell__copy">
            ${this.eyebrow ? `<p class="planner-shell__eyebrow">${this.eyebrow}</p>` : ''}
            ${this.title ? `<h1 class="planner-shell__title">${this.title}</h1>` : ''}
            ${this.lead ? `<p class="planner-shell__lead">${this.lead}</p>` : ''}
          </div>
          <nav class="planner-shell__steps" aria-label="Кроки підбору">
            ${this.renderSteps()}
          </nav>
        </header>

        <div class="planner-shell__body">
          <div class="planner-shell__content">
            <div class="planner-shell__slot">
              <slot></slot>
            </div>
            ${this.renderActions()}
          </div>
          <aside class="planner-shell__aside" ${this.step === '1' ? 'style="display:none"' : ''}>
            <planner-summary></planner-summary>
          </aside>
        </div>
      </section>
    `;
  }
}

customElements.define('planner-shell', PlannerShell);
