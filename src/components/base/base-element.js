import styles from './base-element.scss?inline';

export class BaseElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.update();
  }

  update() {
    this.shadowRoot.innerHTML = `
      <style>
        ${styles}
        ${this.styles()}
      </style>

      ${this.render()}
    `;
    this.afterRender();
  }

  styles() {
    return '';
  }

  render() {
    return '';
  }

  afterRender() { }
}