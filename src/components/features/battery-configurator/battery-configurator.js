import { BaseElement } from '../../base/base-element.js';
import '../../ui/ui-card/ui-card.js';
import '../../ui/ui-disclosure/ui-disclosure.js';
import { getSystemCalculation } from '../../../utils/consumer-utils.js';
import { formatAutonomy, formatBattery, formatEnergyWh } from '../../../utils/format.js';
import styles from './battery-configurator.scss?inline';

function pluralizeBatteries(n) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'акумуляторів';
  if (last === 1) return 'акумулятор';
  if (last >= 2 && last <= 4) return 'акумулятори';
  return 'акумуляторів';
}

function describeRuntime(hours) {
  if (!hours || hours <= 0) return 'недостатньо для оцінки';
  if (hours < 4) return 'короткі відключення (до пів дня)';
  if (hours < 10) return 'до пів доби без світла';
  if (hours < 20) return 'майже повна доба автономії';
  if (hours < 36) return 'доба з запасом';
  if (hours < 60) return 'дві доби автономії';
  return `${Math.round(hours / 24)} доби автономії і більше`;
}

function describeCostTier(index, total) {
  if (total <= 1) return null;
  if (index === 0) return { label: 'Бюджет', tone: 'budget' };
  if (index === total - 1) return { label: 'Преміум', tone: 'premium' };
  return { label: 'Золота середина', tone: 'mid' };
}

class BatteryConfigurator extends BaseElement {
  constructor() {
    super();
    this._items = [];
    this._settings = {};
  }
  styles() {
    return styles;
  }
  set items(value) {
    this._items = Array.isArray(value) ? value : [];
    if (this.isConnected) this.update();
  }
  set settings(value) {
    this._settings = value || {};
    if (this.isConnected) this.update();
  }
  get items() {
    return this._items;
  }
  get settings() {
    return this._settings;
  }

  get selectedIndex() {
    return Math.max(0, Math.floor(Number(this.settings?.selectedBatteryConfigIndex || 0)));
  }

  renderConfigCard(config, index, total, isSelected) {
    if (!config) return '';
    const isPrimary = index === 0;
    const tier = describeCostTier(index, total);
    const moduleCount = Number(config.totalBatteries || 0);
    const runtime = Number(config.autonomyHours || 0);
    const runtimeWords = describeRuntime(runtime);
    const continuousHours = Number(config.continuousAutonomyHours || 0);

    return `
      <div class="battery-option ${isPrimary ? 'is-primary' : ''} ${isSelected ? 'is-selected' : ''}" data-battery-config-index="${index}">
        <div class="battery-option__top">
          ${tier ? `<span class="battery-option__tier battery-option__tier--${tier.tone}">${tier.label}</span>` : ''}
          ${isPrimary ? '<span class="battery-option__rec">Радимо</span>' : ''}
          ${isSelected ? '<span class="battery-option__selected">Обрано</span>' : ''}
        </div>

        <div class="battery-option__hero">
          <div class="battery-option__count">
            <strong>${moduleCount}</strong>
            <span>${pluralizeBatteries(moduleCount)} ${config.moduleCapacityAh} Ah</span>
          </div>
          <div class="battery-option__runtime">
            <strong>~${formatAutonomy(runtime)}</strong>
            <span>${runtimeWords}</span>
          </div>
        </div>

        <ul class="battery-option__bullets">
          <li>Витягне навантаження ${formatAutonomy(continuousHours, { preferDays: false })} на повну</li>
          <li>Сумарно ${formatBattery(config.bankCapacityAh)} при ${config.bankVoltage} V</li>
        </ul>

        <details class="battery-option__details">
          <summary>Технічні деталі</summary>
          <dl>
            <dt>Запасена енергія</dt><dd>${formatEnergyWh(config.totalStoredWh)}</dd>
            <dt>Корисна (з урахуванням DOD і ККД)</dt><dd>${formatEnergyWh(config.usableStoredWh)}</dd>
            <dt>Топологія</dt><dd>${config.seriesCount} послідовно × ${config.parallelCount} паралельно</dd>
          </dl>
        </details>
      </div>
    `;
  }

  renderConfigs(configs = []) {
    if (!configs.length)
      return '<div class="battery-configurator__empty">Додайте прилади, щоб побачити варіанти АКБ.</div>';
    const selectedIndex = Math.min(this.selectedIndex, configs.length - 1);
    return `
      <div class="battery-configurator__options-row">
        ${configs
          .map((config, index) =>
            this.renderConfigCard(config, index, configs.length, selectedIndex === index),
          )
          .join('')}
      </div>
    `;
  }

  render() {
    const calc = getSystemCalculation(this.items, this.settings);
    return `
      <ui-card padding="md">
        <section class="battery-configurator">
          <div class="battery-configurator__head">
            <p class="battery-configurator__eyebrow">АКБ</p>
            <h2>Який комплект акумуляторів купити</h2>
            <p class="battery-configurator__lead">Розрахували три варіанти. Виберіть під свій бюджет — клік по картці фіксує вибір для звіту і списку покупок.</p>
          </div>

          <ui-disclosure label="Що під капотом (для інженерів)">
            <div class="battery-configurator__summary battery-configurator__summary--secondary">
              <div><span>Потрібна ємність</span><strong>${formatBattery(calc.recommendedBatteryCapacityAh)}</strong></div>
              <div><span>Енергія без запасу</span><strong>${formatEnergyWh(calc.requiredEnergyWh)}</strong></div>
              <div><span>Час при макс. навантаженні</span><strong>${formatAutonomy(calc.continuousAutonomyHours, { preferDays: false })}</strong></div>
              <div><span>Напруга системи</span><strong>${this.settings.batteryVoltage || 24} V</strong></div>
            </div>
          </ui-disclosure>

          <div class="battery-configurator__list">${this.renderConfigs(calc.recommendedBatteryConfigs)}</div>
        </section>
      </ui-card>
    `;
  }

  afterRender() {
    this.shadowRoot.querySelectorAll('[data-battery-config-index]').forEach((card) => {
      card.addEventListener('click', (e) => {
        // не реагуємо на клік всередині details (розкриття технічних деталей)
        if (e.target.closest('.battery-option__details')) return;
        const index = Number(card.getAttribute('data-battery-config-index'));
        if (!Number.isFinite(index)) return;
        this.dispatchEvent(
          new CustomEvent('battery-config-select', {
            detail: { index },
            bubbles: true,
            composed: true,
          }),
        );
      });
    });
  }
}
customElements.define('battery-configurator', BatteryConfigurator);
