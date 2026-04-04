import styles from './ui-select.scss?inline';
import { escapeAttr, escapeHtml } from '../../../utils/escape.js';

let openedSelect = null;
let selectInstanceId = 0;

const portalStyles = `
  .ui-select-portal {
    position: fixed;
    z-index: 5000;
    overflow: auto;
    padding: 6px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: #171d2a;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.34);
  }

  .ui-select-portal__option {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 38px;
    padding: 8px 10px;
    border: 0;
    background: transparent;
    color: #ffffff;
    font: inherit;
    text-align: left;
    border-radius: 12px;
    cursor: pointer;
  }

  .ui-select-portal__option:hover,
  .ui-select-portal__option.is-selected {
    background: rgba(255, 255, 255, 0.08);
  }

  .ui-select-portal__option.is-active {
    background: rgba(100, 180, 255, 0.14);
  }

  .ui-select-portal__check {
    color: #64b4ff;
    font-weight: 700;
  }

  .ui-select-portal__empty {
    padding: 12px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }
`;

class UiSelect extends HTMLElement {
  static get observedAttributes() {
    return ['name', 'label', 'value', 'disabled', 'placeholder', 'error', 'hint'];
  }

  constructor() {
    super();
    this._options = [];
    this._isOpen = false;
    this._activeIndex = -1;
    this._focusControlAfterRender = false;
    this._dropdownPortal = null;
    this._portalClickHandler = null;
    this._listboxId = `ui-select-listbox-${++selectInstanceId}`;
    this._boundDocumentClick = this.handleDocumentClick.bind(this);
    this._boundKeydown = this.handleKeydown.bind(this);
    this._boundViewportUpdate = this.updateDropdownPosition.bind(this);
  }

  connectedCallback() {
    this.style.display = 'block';
    this.style.minWidth = '0';
    this.ensurePortalStyles();
    this.render();
    document.addEventListener('click', this._boundDocumentClick, true);
    document.addEventListener('keydown', this._boundKeydown);
  }

  disconnectedCallback() {
    this.destroyDropdownPortal();
    document.removeEventListener('click', this._boundDocumentClick, true);
    document.removeEventListener('keydown', this._boundKeydown);
    if (openedSelect === this) openedSelect = null;
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  get name() { return this.getAttribute('name') || ''; }
  get label() { return this.getAttribute('label') || ''; }
  get value() { return this.getAttribute('value') || ''; }
  set value(newValue) { this.setAttribute('value', String(newValue ?? '')); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(value) { value ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }
  get placeholder() { return this.getAttribute('placeholder') || 'Оберіть значення'; }
  get error() { return this.getAttribute('error') || ''; }
  get hint() { return this.getAttribute('hint') || ''; }

  get options() { return this._options; }
  set options(value) {
    this._options = Array.isArray(value) ? value : [];
    if (this.isConnected) this.render();
  }

  get selectedOption() {
    return this._options.find((option) => String(option?.value ?? '') === String(this.value)) || null;
  }

  get messageId() {
    return this.name ? `${this.name}-select-message` : '';
  }

  get selectedIndex() {
    return this._options.findIndex((option) => String(option?.value ?? '') === String(this.value));
  }

  open() {
    if (this.disabled || !this._options.length) return;
    if (openedSelect && openedSelect !== this) {
      openedSelect.close({ keepFocus: false });
    }
    openedSelect = this;
    this._isOpen = true;
    this._activeIndex = this.selectedIndex >= 0 ? this.selectedIndex : 0;
    this._focusControlAfterRender = true;
    this.updateHostLayer();
    this.render();
    this.mountDropdownPortal();
  }

  toggleOpen = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.disabled) return;
    if (this._isOpen) {
      this.close();
      return;
    }
    this.open();
  };

  close = ({ keepFocus = true } = {}) => {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._activeIndex = -1;
    this._focusControlAfterRender = keepFocus;
    if (openedSelect === this) openedSelect = null;
    this.destroyDropdownPortal();
    this.updateHostLayer();
    this.render();
  };

  updateHostLayer() {
    this.style.position = 'relative';
    this.style.zIndex = this._isOpen ? '900' : 'auto';
  }

  handleDocumentClick(event) {
    if (!this._isOpen) return;
    const clickedInsidePortal = this._dropdownPortal?.contains(event.target);
    if (!this.contains(event.target) && !clickedInsidePortal) {
      this.close({ keepFocus: false });
    }
  }

  selectIndex(index) {
    const option = this._options[index];
    if (!option) return;

    const nextValue = String(option?.value ?? '');
    this.value = nextValue;
    this._isOpen = false;
    this._activeIndex = index;
    this._focusControlAfterRender = true;
    if (openedSelect === this) openedSelect = null;
    this.destroyDropdownPortal();
    this.render();

    this.dispatchEvent(new CustomEvent('ui-change', {
      detail: { value: nextValue, name: this.name },
      bubbles: true,
      composed: true,
    }));
  }

  handleKeydown(event) {
    const control = this.querySelector('.field__control');
    if (!control || document.activeElement !== control) return;

    if ((event.key === 'Enter' || event.key === ' ') && !this._isOpen) {
      event.preventDefault();
      this.open();
      return;
    }

    if (event.key === 'Escape') {
      this.close({ keepFocus: true });
      return;
    }

    if (event.key === 'Tab') {
      this.close({ keepFocus: false });
      return;
    }

    if (!this._isOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this._activeIndex = Math.min(this._options.length - 1, Math.max(this._activeIndex, 0) + 1);
      this._focusControlAfterRender = true;
      this.render();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this._activeIndex = Math.max(0, (this._activeIndex < 0 ? this._options.length : this._activeIndex) - 1);
      this._focusControlAfterRender = true;
      this.render();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectIndex(this._activeIndex >= 0 ? this._activeIndex : 0);
    }
  }

  handleOptionClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const optionButton = event.target.closest('[data-index]');
    if (!optionButton) return;
    this.selectIndex(Number(optionButton.getAttribute('data-index')));
  };

  ensurePortalStyles() {
    if (document.getElementById('ui-select-portal-styles')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'ui-select-portal-styles';
    styleElement.textContent = portalStyles;
    document.head.append(styleElement);
  }

  mountDropdownPortal() {
    if (!this._isOpen) return;

    if (!this._dropdownPortal) {
      this._dropdownPortal = document.createElement('div');
      this._dropdownPortal.className = 'ui-select-portal';
      this._dropdownPortal.setAttribute('role', 'listbox');
      this._dropdownPortal.id = this._listboxId;
      this._portalClickHandler = this.handleOptionClick.bind(this);
      this._dropdownPortal.addEventListener('click', this._portalClickHandler);
      document.body.append(this._dropdownPortal);
    }

    this._dropdownPortal.innerHTML = this.renderOptions('ui-select-portal');
    this.updateDropdownPosition();

    window.addEventListener('resize', this._boundViewportUpdate);
    window.addEventListener('scroll', this._boundViewportUpdate, true);
  }

  destroyDropdownPortal() {
    window.removeEventListener('resize', this._boundViewportUpdate);
    window.removeEventListener('scroll', this._boundViewportUpdate, true);

    if (!this._dropdownPortal) return;

    if (this._portalClickHandler) {
      this._dropdownPortal.removeEventListener('click', this._portalClickHandler);
    }

    this._dropdownPortal.remove();
    this._dropdownPortal = null;
    this._portalClickHandler = null;
  }

  updateDropdownPosition() {
    if (!this._isOpen || !this._dropdownPortal) return;

    const control = this.querySelector('.field__control');
    if (!control) return;

    const rect = control.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const preferredHeight = Math.min(this._dropdownPortal.scrollHeight, 280);
    const shouldOpenUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(shouldOpenUp ? spaceAbove : spaceBelow, 280));
    const width = Math.min(rect.width, viewportWidth - 24);
    const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));

    this._dropdownPortal.style.width = `${width}px`;
    this._dropdownPortal.style.maxHeight = `${maxHeight}px`;
    this._dropdownPortal.style.left = `${left}px`;
    this._dropdownPortal.style.top = shouldOpenUp
      ? `${Math.max(12, rect.top - Math.min(preferredHeight, maxHeight) - 8)}px`
      : `${Math.min(viewportHeight - maxHeight - 12, rect.bottom + 8)}px`;
  }

  renderOptions(classPrefix = 'field') {
    if (!this._options.length) {
      return `<div class="${classPrefix}__empty">Немає доступних варіантів</div>`;
    }

    return this._options.map((option, index) => {
      const optionValue = String(option?.value ?? '');
      const optionLabel = String(option?.label ?? optionValue);
      const isSelected = optionValue === String(this.value);
      const isActive = index === this._activeIndex;

      return `
        <button
          type="button"
          class="${classPrefix}__option ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}"
          data-index="${index}"
          data-value="${escapeAttr(optionValue)}"
          role="option"
          aria-selected="${isSelected ? 'true' : 'false'}"
        >
          <span>${escapeHtml(optionLabel)}</span>
          ${isSelected ? `<span class="${classPrefix}__check">✓</span>` : ''}
        </button>
      `;
    }).join('');
  }

  render() {
    this.updateHostLayer();

    const selectedLabel = this.selectedOption?.label || this.placeholder;
    const message = this.error || this.hint;

    this.innerHTML = `
      <style>${styles}</style>
      <label class="field field--light-dom ${this._isOpen ? 'field--open' : ''} ${this.disabled ? 'is-disabled' : ''} ${this.error ? 'has-error' : ''}">
        ${this.label ? `<span class="field__label">${escapeHtml(this.label)}</span>` : ''}
        <div class="field__select-wrap ${this._isOpen ? 'is-open' : ''}">
          <button
            type="button"
            class="field__control ${this.error ? 'is-error' : ''}"
            ${this.disabled ? 'disabled' : ''}
            aria-haspopup="listbox"
            aria-expanded="${this._isOpen ? 'true' : 'false'}"
            ${this._isOpen ? `aria-controls="${escapeAttr(this._listboxId)}"` : ''}
            ${this.messageId ? `aria-describedby="${escapeAttr(this.messageId)}"` : ''}
            ${this.error ? 'aria-invalid="true"' : 'aria-invalid="false"'}
          >
            <span class="field__value ${this.selectedOption ? '' : 'is-placeholder'}">${escapeHtml(String(selectedLabel))}</span>
            <span class="field__arrow" aria-hidden="true"></span>
          </button>
        </div>
        ${message ? `<span id="${escapeAttr(this.messageId)}" class="field__message ${this.error ? 'field__message--error' : ''}">${escapeHtml(message)}</span>` : ''}
      </label>
    `;

    this.querySelector('.field__control')?.addEventListener('click', this.toggleOpen);

    if (this._focusControlAfterRender) {
      this.querySelector('.field__control')?.focus();
      this._focusControlAfterRender = false;
    }

    if (this._isOpen) {
      this.mountDropdownPortal();
    }
  }
}

customElements.define('ui-select', UiSelect);
