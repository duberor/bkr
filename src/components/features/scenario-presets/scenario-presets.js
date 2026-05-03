import { BaseElement } from '../../base/base-element.js';
import { SCENARIO_PRESETS } from '../../../data/scenario-presets.js';
import { formatAutonomy } from '../../../utils/format.js';
import { getObjectTypeLabel } from '../../../utils/consumer-utils.js';
import { appStore } from '../../../store/app-store.js';
import styles from './scenario-presets.scss?inline';

class ScenarioPresets extends BaseElement {
  constructor() {
    super();
    this._presets = SCENARIO_PRESETS;
  }

  styles() {
    return styles;
  }

  set presets(value) {
    this._presets = Array.isArray(value) ? value : SCENARIO_PRESETS;
    if (this.isConnected) this.update();
  }

  get presets() {
    return this._presets;
  }

  render() {
    return `
      <section class="scenario-presets">
        <div class="scenario-presets__head">
          <p class="scenario-presets__eyebrow">Швидкий старт</p>
          <h2>Готові сценарії</h2>
          <p class="scenario-presets__hint">Клік замінить поточний список приладів</p>
        </div>

        <div class="scenario-presets__grid">
          ${this.presets
            .map((preset) => {
              const count = preset.consumers?.length || 0;
              return `
            <button type="button" class="scenario-presets__card" data-preset-id="${preset.id}">
              <strong>${preset.title}</strong>
              <div class="scenario-presets__meta">
                <span>${getObjectTypeLabel(preset.scenario?.objectType)}</span>
                <span>${formatAutonomy(preset.systemSettings?.targetAutonomyHours || 0, { preferDays: false })}</span>
              </div>
              <div class="scenario-presets__count">${count} приладів</div>
            </button>
          `;
            })
            .join('')}
        </div>
      </section>
    `;
  }

  afterRender() {
    this.shadowRoot.querySelectorAll('[data-preset-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const presetId = button.getAttribute('data-preset-id');
        const preset = this.presets.find((item) => item.id === presetId);
        if (!preset) return;

        // BUG-11: підтвердження якщо є незбережені дані
        const currentConsumers = appStore.getState().consumers || [];
        if (currentConsumers.length > 0) {
          const ok = window.confirm(
            `Завантажити сценарій «${preset.title}»?\n\nПоточний список з ${currentConsumers.length} приладів буде замінено.`,
          );
          if (!ok) return;
        }

        this.dispatchEvent(
          new CustomEvent('scenario-preset-select', {
            detail: { preset },
            bubbles: true,
            composed: true,
          }),
        );
      });
    });
  }
}

customElements.define('scenario-presets', ScenarioPresets);
