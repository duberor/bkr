import { BaseElement } from '../../base/base-element.js';
import '../../features/planner-shell/planner-shell.js';
import '../../ui/ui-card/ui-card.js';
import '../../features/system-settings-form/system-settings-form.js';
import '../../features/system-summary/system-summary.js';
import { appStore } from '../../../store/app-store.js';
import styles from './calculation-page.scss?inline';

class CalculationPage extends BaseElement {
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
    return `
      <planner-shell
        step="3"
        eyebrow="Параметри"
        title="Параметри системи"
        prev-href="#/consumers"
        prev-label="Повернутися до приладів"
        next-href="#/system"
        next-label="Перейти до рішення"
      >
        <ui-card padding="md"><system-settings-form></system-settings-form></ui-card>

        <system-summary></system-summary>
      </planner-shell>
    `;
  }

  afterRender() {
    const form = this.shadowRoot.querySelector('system-settings-form');
    const summary = this.shadowRoot.querySelector('system-summary');
    form.addEventListener('system-settings-change', this.handleChange);
    form.items = this.state.consumers;
    form.settings = this.state.systemSettings;
    form.syncAutoSelections();
    summary.items = this.state.consumers;
    summary.settings = this.state.systemSettings;
  }

  handleChange = (event) => appStore.setSystemSettings(event.detail.settings);
}

customElements.define('calculation-page', CalculationPage);
