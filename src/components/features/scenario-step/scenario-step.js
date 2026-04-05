import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-select/ui-select.js';
import {
  getBackupScopeLabel,
  getObjectTypeLabel,
  getScenarioTypeLabel,
} from '../../../utils/consumer-utils.js';
import styles from './scenario-step.scss?inline';

const objectOptions = [
  { value: 'apartment', label: getObjectTypeLabel('apartment') },
  { value: 'house', label: getObjectTypeLabel('house') },
  { value: 'office', label: getObjectTypeLabel('office') },
  { value: 'boiler_room', label: getObjectTypeLabel('boiler_room') },
  { value: 'other', label: getObjectTypeLabel('other') },
];

const scenarioOptions = [
  { value: 'custom', label: getScenarioTypeLabel('custom') },
  { value: 'blackout', label: getScenarioTypeLabel('blackout') },
  { value: 'heating', label: getScenarioTypeLabel('heating') },
  { value: 'home_office', label: getScenarioTypeLabel('home_office') },
  { value: 'connectivity', label: getScenarioTypeLabel('connectivity') },
];

const scopeOptions = [
  { value: 'critical', label: getBackupScopeLabel('critical') },
  { value: 'comfort', label: getBackupScopeLabel('comfort') },
  { value: 'full', label: getBackupScopeLabel('full') },
];

class ScenarioStep extends BaseElement {
  constructor() {
    super();
    this._scenario = {
      objectType: 'apartment',
      scenarioType: 'custom',
      backupScope: 'critical',
      hasBoiler: false,
      hasPump: false,
      hasFridge: true,
      presetId: '',
      userMode: 'basic',
    };
  }

  styles() {
    return styles;
  }

  set scenario(value) {
    this._scenario = {
      ...this._scenario,
      ...(value || {}),
    };
    if (this.isConnected) this.update();
  }

  get scenario() {
    return this._scenario;
  }

  render() {
    return `
      <ui-card padding="md">
        <section class="scenario-step">
          <div class="scenario-step__head">
            <p class="scenario-step__eyebrow">Крок 1</p>
            <h2>З чим саме працюємо</h2>
          </div>

          <div class="scenario-step__grid">
            <ui-select name="objectType" label="Тип об’єкта"></ui-select>
            <ui-select name="scenarioType" label="Основний сценарій"></ui-select>
            <ui-select name="backupScope" label="Що резервуємо"></ui-select>
          </div>
        </section>
      </ui-card>
    `;
  }

  afterRender() {
    const objectType = this.shadowRoot.querySelector('ui-select[name="objectType"]');
    const scenarioType = this.shadowRoot.querySelector('ui-select[name="scenarioType"]');
    const backupScope = this.shadowRoot.querySelector('ui-select[name="backupScope"]');

    if (objectType) {
      objectType.options = objectOptions;
      objectType.value = this.scenario.objectType;
    }

    if (scenarioType) {
      scenarioType.options = scenarioOptions;
      scenarioType.value = this.scenario.scenarioType;
    }

    if (backupScope) {
      backupScope.options = scopeOptions;
      backupScope.value = this.scenario.backupScope;
    }

    this.shadowRoot.removeEventListener('ui-change', this.handleChange);
    this.shadowRoot.addEventListener('ui-change', this.handleChange);
  }

  handleChange = (event) => {
    const { name, value } = event.detail || {};
    if (!name) return;

    const nextScenario = {
      ...this.scenario,
      presetId: '',
    };
    nextScenario[name] = value;

    this._scenario = nextScenario;
    this.dispatchEvent(
      new CustomEvent('scenario-change', {
        detail: { scenario: nextScenario },
        bubbles: true,
        composed: true,
      }),
    );
  };
}

customElements.define('scenario-step', ScenarioStep);
