import styles from './ui-icon.scss?inline';

class UiIcon extends HTMLElement {
  static get observedAttributes() {
    return ['name'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  styles() {
    return styles;
  }

  render() {
    const name = this.getAttribute('name');

    if (!name) {
      this.innerHTML = '';
      return;
    }

    const symbol = document.querySelector(`#icon-${name}`);

    if (!symbol) {
      this.innerHTML = '';
      return;
    }

    const viewBox = symbol.getAttribute('viewBox') || '0 0 24 24';

    this.innerHTML = `
      <svg
        class="icon"
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="${viewBox}"
        fill="none"
        stroke="#fff"
      >
        ${symbol.innerHTML}
      </svg>
    `;
  }
}

customElements.define('ui-icon', UiIcon);