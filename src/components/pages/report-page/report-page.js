import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-button/ui-button.js';
import '../../ui/ui-card/ui-card.js';
import '../../features/report-sheet/report-sheet.js';
import { appStore } from '../../../store/app-store.js';
import styles from './report-page.scss?inline';
import reportSheetStyles from '../../features/report-sheet/report-sheet.scss?inline';

class ReportPage extends BaseElement {
  constructor() {
    super();
    this.state = appStore.getState();
  }

  connectedCallback() {
    this.unsubscribe = appStore.subscribe((state) => {
      this.state = state;
      this.update();
    });
    super.connectedCallback();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  styles() {
    return styles;
  }

  render() {
    const hasConsumers = this.state.consumers.length > 0;
    const steps = [
      { hash: '#/dashboard', label: 'Огляд',   n: 1 },
      { hash: '#/consumers', label: 'Прилади', n: 2 },
      { hash: '#/system',    label: 'Система', n: 3 },
      { hash: '#/report',    label: 'Звіт',    n: 4 },
    ];
    const topbar = `
      <div class="page-topbar">
        <nav class="page-steps">
          ${steps.map(({ hash, label, n }) => `
            <a class="page-step ${location.hash === hash ? 'is-active' : ''}" href="${hash}">
              <span class="page-step__n">${n}</span><span>${label}</span>
            </a>`).join('')}
        </nav>
        <div class="page-topbar__end">
          <a href="#/system" class="page-btn">← Система</a>
          <ui-button class="print-btn" ${hasConsumers ? '' : 'disabled'}>Друк / PDF</ui-button>
        </div>
      </div>`;

    return `
      <div class="page-wrap">
        ${topbar}
        <div class="page-body">
          ${!hasConsumers ? `
            <div class="report-page__notice">
              <span>Щоб сформувати звіт, спочатку додайте прилади до проєкту.</span>
              <a class="report-page__notice-link" href="#/consumers">Перейти до приладів</a>
            </div>
          ` : ''}
          <report-sheet></report-sheet>
        </div>
      </div>
    `;
  }

  afterRender() {
    const reportSheet = this.shadowRoot.querySelector('report-sheet');
    if (reportSheet) reportSheet.state = this.state;
    this.shadowRoot.querySelector('.print-btn')?.addEventListener('ui-click', this.handlePrint);
  }

  handlePrint = () => {
    if (!this.state.consumers.length) return;
    const printableSheet = document.createElement('report-sheet');
    printableSheet.style.position = 'fixed';
    printableSheet.style.left = '-99999px';
    printableSheet.style.top = '0';
    printableSheet.style.width = '1200px';
    printableSheet.style.pointerEvents = 'none';
    printableSheet.style.opacity = '0';
    document.body.appendChild(printableSheet);

    printableSheet.state = this.state;
    printableSheet.viewMode = 'focus';

    const article = printableSheet.shadowRoot?.querySelector('article.report-sheet');
    if (!article) {
      printableSheet.remove();
      window.print();
      return;
    }

    const articleClone = article.cloneNode(true);
    articleClone.classList.add('report-sheet--print-compact');

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      printableSheet.remove();
      window.print();
      return;
    }

    const printableHtml = `
      <!doctype html>
      <html lang="uk">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>UPS Planner Pro — Звіт</title>
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 16px;
              font-family: "FixelText", sans-serif;
              color: #111;
              background: #fff;
            }
            .print-shell {
              max-width: 980px;
              margin: 0 auto;
            }
            ${reportSheetStyles}
          </style>
        </head>
        <body class="print-body">
          <main class="print-shell">${articleClone.outerHTML}</main>
        </body>
      </html>
    `;

    printableSheet.remove();

    printWindow.document.open();
    printWindow.document.write(printableHtml);
    printWindow.document.close();

    const runPrint = () => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
      }, 250);
    };

    if (printWindow.document.readyState === 'complete') {
      setTimeout(runPrint, 50);
      return;
    }

    printWindow.addEventListener('load', () => setTimeout(runPrint, 50), { once: true });
  };
}

customElements.define('report-page', ReportPage);
