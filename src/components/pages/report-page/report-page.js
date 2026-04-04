import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-button/ui-button.js';
import '../../features/report-sheet/report-sheet.js';
import { appStore } from '../../../store/app-store.js';
import styles from './report-page.scss?inline';
import reportSheetStyles from '../../features/report-sheet/report-sheet.scss?inline';

class ReportPage extends BaseElement {
  constructor() { super(); this.state = appStore.getState(); }
  connectedCallback() { this.unsubscribe = appStore.subscribe((state) => { this.state = state; this.update(); }); super.connectedCallback(); }
  disconnectedCallback() { this.unsubscribe?.(); }
  styles() { return styles; }
  render() {
    return `
      <section class="report-page">
        <div class="report-page__hero">
          <div>
            <p class="page-eyebrow">Звіт</p>
            <h1>Готовий звіт по системі</h1>
          </div>
          <ui-button class="print-btn">Друк / PDF</ui-button>
        </div>
        <report-sheet></report-sheet>
      </section>
    `;
  }
  afterRender() {
    const reportSheet = this.shadowRoot.querySelector('report-sheet');
    if (reportSheet) reportSheet.state = this.state;
    this.shadowRoot.querySelector('.print-btn')?.addEventListener('ui-click', this.handlePrint);
  }

  handlePrint = () => {
    const reportSheet = this.shadowRoot.querySelector('report-sheet');
    if (!reportSheet) {
      window.print();
      return;
    }

    reportSheet.state = this.state;
    const article = reportSheet.shadowRoot?.querySelector('article.report-sheet');
    if (!article) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
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
              padding: 24px;
              font-family: "FixelText", sans-serif;
              color: #111;
              background: #fff;
            }
            .print-shell {
              max-width: 1200px;
              margin: 0 auto;
            }
            ${reportSheetStyles}
          </style>
        </head>
        <body>
          <main class="print-shell">${article.outerHTML}</main>
        </body>
      </html>
    `;

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
