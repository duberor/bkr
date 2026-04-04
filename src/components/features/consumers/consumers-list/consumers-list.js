import { BaseElement } from '../../../base/base-element.js';
import '../consumer-card/consumer-card.js';
import { formatEnergyWh, formatPower } from '../../../../utils/format.js';
import styles from './consumers-list.scss?inline';

class ConsumersList extends BaseElement {
  constructor() {
    super();
    this._items = [];
    this._zones = [];
    this._openZoneId = null;
  }

  styles() {
    return styles;
  }

  get items() {
    return this._items;
  }

  set items(value) {
    this._items = Array.isArray(value) ? value : [];
    this.ensureOpenZone();
    if (this.isConnected) this.update();
  }

  get zones() {
    return this._zones;
  }

  set zones(value) {
    this._zones = Array.isArray(value) ? value : [];
    this.ensureOpenZone();
    if (this.isConnected) this.update();
  }

  get zoneMap() {
    return new Map(this.zones.map((zone) => [zone.id, zone.name]));
  }

  get groupedItems() {
    const groups = new Map();

    this.zones.forEach((zone) => {
      groups.set(zone.id, {
        zoneId: zone.id,
        zoneName: zone.name,
        items: [],
      });
    });

    groups.set('', {
      zoneId: '',
      zoneName: 'Без зони',
      items: [],
    });

    this.items.forEach((item) => {
      const zoneId = String(item.zoneId || '').trim();

      if (!groups.has(zoneId)) {
        groups.set(zoneId, {
          zoneId,
          zoneName: this.zoneMap.get(zoneId) || 'Без зони',
          items: [],
        });
      }

      groups.get(zoneId).items.push(item);
    });

    return [...groups.values()].filter((group) => group.items.length);
  }

  ensureOpenZone() {
    const groups = this.groupedItems;

    if (!groups.length) {
      this._openZoneId = null;
      return;
    }

    if (this._openZoneId === '__all__') {
      return;
    }

    const hasCurrent = groups.some((group) => group.zoneId === this._openZoneId);

    if (!hasCurrent) {
      this._openZoneId = groups[0].zoneId;
    }
  }

  renderGroup(group) {
    const totalPower = group.items.reduce((sum, item) => {
      return sum + Number(item.power || 0) * Number(item.quantity || 0);
    }, 0);

    const dailyEnergy = group.items.reduce((sum, item) => {
      return sum + Number(item.power || 0) * Number(item.quantity || 0) * Number(item.hoursPerDay || 0);
    }, 0);

    const isOpen = this._openZoneId === '__all__' || group.zoneId === this._openZoneId;

    return `
      <section class="zone-group ${isOpen ? 'is-open' : ''}" data-zone-id="${group.zoneId}">
        <button class="zone-group__summary" type="button" aria-expanded="${isOpen ? 'true' : 'false'}">
          <div class="zone-group__main">
            <div>
              <strong>${group.zoneName}</strong>
              <span>${group.items.length} прилад(ів)</span>
            </div>

            <div class="zone-group__stats">
              <span>${formatPower(totalPower)}</span>
              <span>${formatEnergyWh(dailyEnergy)}</span>
            </div>
          </div>

          <span class="zone-group__chevron" aria-hidden="true"></span>
        </button>

        ${isOpen ? `
          <div class="zone-group__content">
            ${group.items.map((item) => `
              <consumer-card
                consumer-id="${item.id}"
                name="${item.name}"
                category="${item.category}"
                zone-name="${group.zoneName}"
                zone-id="${group.zoneId}"
                power="${item.power}"
                quantity="${item.quantity}"
                hours-per-day="${item.hoursPerDay}"
                surge-power="${item.surgePower}"
                priority="${item.priority}"
                usage-profile="${item.usageProfile}"
                notes="${item.notes || ''}"
              ></consumer-card>`).join('')}
          </div>
        ` : ''}
      </section>
    `;
  }

  render() {
    if (!this.items.length) {
      return '<div class="consumers-list__empty">Додай перший прилад, щоб побачити список, групування по зонах та підсумки.</div>';
    }

    return `
      <section class="consumers-list">
        <div class="consumers-list__toolbar">
          <button class="consumers-list__toolbar-btn" type="button" data-action="expand-all">Розгорнути все</button>
          <button class="consumers-list__toolbar-btn" type="button" data-action="collapse-all">Згорнути все</button>
        </div>

        ${this.groupedItems.map((group) => this.renderGroup(group)).join('')}
      </section>
    `;
  }

  afterRender() {
    this.shadowRoot.querySelectorAll('consumer-card').forEach((card) => {
      card.addEventListener('consumer-remove', (event) => {
        this.dispatchEvent(new CustomEvent('consumer-remove', { detail: event.detail, bubbles: true, composed: true }));
      });
      card.addEventListener('consumer-edit', (event) => {
        this.dispatchEvent(new CustomEvent('consumer-edit', { detail: event.detail, bubbles: true, composed: true }));
      });
    });

    this.shadowRoot.querySelectorAll('.zone-group__summary').forEach((button) => {
      button.addEventListener('click', () => {
        const zoneId = button.closest('.zone-group')?.dataset.zoneId ?? null;
        this._openZoneId = this._openZoneId === zoneId ? null : zoneId;
        this.update();
      });
    });

    this.shadowRoot.querySelector('[data-action="expand-all"]')?.addEventListener('click', () => {
      this._openZoneId = '__all__';
      this.update();
    });

    this.shadowRoot.querySelector('[data-action="collapse-all"]')?.addEventListener('click', () => {
      this._openZoneId = null;
      this.update();
    });
  }
}

customElements.define('consumers-list', ConsumersList);
