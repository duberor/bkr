import { BaseElement } from '../../../base/base-element.js';
import '../../../ui/ui-input/ui-input.js';
import { CONSUMER_LIBRARY } from '../../../../data/consumer-library.js';
import { CATEGORY_LABELS } from '../../../../data/consumer-categories.js';
import { formatPower } from '../../../../utils/format.js';
import { escapeHtml } from '../../../../utils/escape.js';
import styles from './consumer-library-picker.scss?inline';

class ConsumerLibraryPicker extends BaseElement {
  constructor() {
    super();
    this._open = false;
    this._customLibrary = [];
    this.search = '';
  }

  styles() {
    return styles;
  }

  get open() {
    return this._open;
  }
  set open(value) {
    this._open = Boolean(value);
    if (this.isConnected) this.update();
  }

  get customLibrary() {
    return this._customLibrary;
  }
  set customLibrary(value) {
    this._customLibrary = Array.isArray(value) ? value : [];
    if (this.isConnected) this.update();
  }

  get allItems() {
    const custom = this._customLibrary.map((item) => ({ ...item, __custom: true }));
    return [...custom, ...CONSUMER_LIBRARY];
  }

  get filteredItems() {
    const query = String(this.search || '').trim().toLowerCase();
    if (!query) return this.allItems;
    return this.allItems.filter((item) => {
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
    if (!this._open) return '';
    const items = this.filteredItems;
    return `
      <div class="consumer-library__backdrop">
        <div class="consumer-library__dialog" role="dialog" aria-modal="true" aria-label="Вибір приладу з бібліотеки">
          <div class="consumer-library__head">
            <div>
              <p class="consumer-library__eyebrow">Швидке додавання</p>
              <h2>Виберіть прилад зі списку</h2>
            </div>
            <button class="consumer-library__close" type="button" aria-label="Закрити">×</button>
          </div>

          <ui-input
            name="search"
            label="Пошук"
            placeholder="Наприклад, котел, роутер, холодильник"
            value="${escapeHtml(this.search)}"
          ></ui-input>

          <div class="consumer-library__grid">
            ${items
              .map(
                (item) => `
              <button type="button" class="consumer-library__card ${item.__custom ? 'is-custom' : ''}" data-library-id="${escapeHtml(item.id)}" ${item.__custom ? 'data-custom="1"' : ''}>
                ${item.__custom ? '<span class="consumer-library__badge">Мій</span>' : ''}
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(CATEGORY_LABELS[item.category] || item.category || '')}</span>
                <div class="consumer-library__meta">
                  <span>${formatPower(item.power)}</span>
                  <span>${item.hoursPerDay} год/добу</span>
                </div>
                ${item.__custom ? `<button type="button" class="consumer-library__remove" data-custom-remove="${escapeHtml(item.id)}" aria-label="Видалити з типових">×</button>` : ''}
              </button>
            `,
              )
              .join('') ||
              '<div class="consumer-library__empty">За цим запитом нічого не знайшлося.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  afterRender() {
    if (!this._open) return;

    this.shadowRoot.removeEventListener('ui-input', this.handleInput);
    this.shadowRoot.addEventListener('ui-input', this.handleInput);

    this.shadowRoot
      .querySelector('.consumer-library__close')
      ?.addEventListener('click', this.handleClose);
    this.shadowRoot
      .querySelector('.consumer-library__backdrop')
      ?.addEventListener('click', this.handleBackdropClick);

    this.shadowRoot.querySelectorAll('[data-library-id]').forEach((button) => {
      button.addEventListener('click', (e) => {
        if (e.target.closest('[data-custom-remove]')) return;
        const id = button.getAttribute('data-library-id');
        const template = this.allItems.find((item) => item.id === id);
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

    this.shadowRoot.querySelectorAll('[data-custom-remove]').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = button.getAttribute('data-custom-remove');
        if (!id) return;
        this.dispatchEvent(
          new CustomEvent('consumer-library-remove', {
            detail: { id },
            bubbles: true,
            composed: true,
          }),
        );
      });
    });

    document.addEventListener('keydown', this.handleEscape);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleEscape);
  }

  handleEscape = (event) => {
    if (event.key === 'Escape' && this._open) this.handleClose();
  };

  handleBackdropClick = (event) => {
    if (event.target.classList.contains('consumer-library__backdrop')) this.handleClose();
  };

  handleClose = () => {
    this.dispatchEvent(
      new CustomEvent('consumer-library-close', { bubbles: true, composed: true }),
    );
  };

  handleInput = (event) => {
    if (event.detail?.name !== 'search') return;
    this.search = event.detail.value || '';
    this.update();
  };
}

customElements.define('consumer-library-picker', ConsumerLibraryPicker);
