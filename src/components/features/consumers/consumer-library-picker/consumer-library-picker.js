import { BaseElement } from '../../../base/base-element.js';
import '../../../ui/ui-card/ui-card.js';
import '../../../ui/ui-input/ui-input.js';
import '../../../ui/ui-disclosure/ui-disclosure.js';
import { CONSUMER_LIBRARY } from '../../../../data/consumer-library.js';
import { CATEGORY_LABELS } from '../../../../data/consumer-categories.js';
import { formatPower } from '../../../../utils/format.js';
import styles from './consumer-library-picker.scss?inline';

class ConsumerLibraryPicker extends BaseElement {
  constructor() {
    super();
    this.search = '';
  }

  styles() {
    return styles;
  }

  get filteredItems() {
    const query = String(this.search || '')
      .trim()
      .toLowerCase();
    if (!query) return CONSUMER_LIBRARY;

    return CONSUMER_LIBRARY.filter((item) => {
      const haystack = [
        item.name,
        item.notes,
        CATEGORY_LABELS[item.category] || item.category,
        ...(item.tags || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  render() {
    return `
      <ui-card padding="md">
        <section class="consumer-library">
          <div class="consumer-library__head">
            <p class="consumer-library__eyebrow">Швидке додавання</p>
            <h2>Типові прилади</h2>
          </div>

          <ui-disclosure label="Підібрати з бібліотеки приладів">
            <div class="consumer-library__body">
              <ui-input
                name="search"
                label="Пошук по бібліотеці"
                placeholder="Наприклад, котел, роутер, холодильник"
                value="${this.search}"
              ></ui-input>

              <div class="consumer-library__grid">
                ${
                  this.filteredItems
                    .map(
                      (item) => `
                  <button type="button" class="consumer-library__card" data-library-id="${item.id}">
                    <strong>${item.name}</strong>
                    <span>${CATEGORY_LABELS[item.category] || item.category}</span>
                    <div class="consumer-library__meta">
                      <span>${formatPower(item.power)}</span>
                      <span>${item.hoursPerDay} год/добу</span>
                    </div>
                  </button>
                `,
                    )
                    .join('') ||
                  '<div class="consumer-library__empty">За цим запитом нічого не знайшлося.</div>'
                }
              </div>
            </div>
          </ui-disclosure>
        </section>
      </ui-card>
    `;
  }

  afterRender() {
    this.shadowRoot.removeEventListener('ui-input', this.handleInput);
    this.shadowRoot.addEventListener('ui-input', this.handleInput);

    this.shadowRoot.querySelectorAll('[data-library-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const template = CONSUMER_LIBRARY.find(
          (item) => item.id === button.getAttribute('data-library-id'),
        );
        if (!template) return;

        this.dispatchEvent(
          new CustomEvent('consumer-library-select', {
            detail: { template },
            bubbles: true,
            composed: true,
          }),
        );
      });
    });
  }

  handleInput = (event) => {
    if (event.detail?.name !== 'search') return;
    this.search = event.detail.value || '';
    this.update();
  };
}

customElements.define('consumer-library-picker', ConsumerLibraryPicker);
