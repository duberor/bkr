import styles from './base-element.scss?inline';

function escapeSelectorValue(value) {
  if (globalThis.CSS?.escape) {
    return globalThis.CSS.escape(String(value));
  }

  return String(value).replace(/["\\]/g, '\\$&');
}

function buildFocusDescriptor(element) {
  if (!element?.tagName) return null;

  const tag = element.tagName.toLowerCase();
  const id = String(element.id || '').trim();
  if (id) {
    return {
      tag,
      selector: `#${escapeSelectorValue(id)}`,
    };
  }

  const name = String(element.getAttribute?.('name') || '').trim();
  if (name) {
    return {
      tag,
      selector: `${tag}[name="${escapeSelectorValue(name)}"]`,
    };
  }

  if (element.classList?.contains('field__control')) {
    return {
      tag,
      selector: `${tag}.field__control`,
    };
  }

  const siblings = element.parentElement
    ? [...element.parentElement.children].filter((item) => item.tagName === element.tagName)
    : [];

  return {
    tag,
    index: Math.max(0, siblings.indexOf(element)),
  };
}

function findFocusTarget(context, descriptor) {
  if (!context || !descriptor) return null;

  if (descriptor.selector) {
    return context.querySelector?.(descriptor.selector) || null;
  }

  const matches = context.querySelectorAll?.(descriptor.tag) || [];
  return matches[descriptor.index || 0] || null;
}

function getNestedActiveElement(element) {
  if (!element) return null;

  if (element.shadowRoot?.activeElement) {
    return element.shadowRoot.activeElement;
  }

  return (
    element.querySelector?.(
      '.field__control:focus, input:focus, textarea:focus, button:focus, select:focus, [contenteditable="true"]:focus',
    ) || null
  );
}

function resolveFocusableElement(target) {
  if (!target) return null;

  if (
    target.matches?.(
      'input, textarea, button, select, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
    ) ||
    target.classList?.contains('field__control')
  ) {
    return target;
  }

  return (
    target.shadowRoot?.querySelector?.('.field__control') ||
    target.querySelector?.('.field__control') ||
    target
  );
}

export class BaseElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.update();
  }

  update() {
    const focusState = this.captureFocusState();

    this.shadowRoot.innerHTML = `
      <style>
        ${styles}
        ${this.styles()}
      </style>

      ${this.render()}
    `;
    this.afterRender();
    this.restoreFocusState(focusState);
  }

  styles() {
    return '';
  }

  render() {
    return '';
  }

  afterRender() {}

  captureFocusState() {
    if (!this.shadowRoot) return null;

    const chain = [];
    let activeElement = this.shadowRoot.activeElement;

    while (activeElement) {
      const descriptor = buildFocusDescriptor(activeElement);
      if (!descriptor) break;

      chain.push(descriptor);
      const nestedActiveElement = getNestedActiveElement(activeElement);

      if (!nestedActiveElement || nestedActiveElement === activeElement) {
        break;
      }

      activeElement = nestedActiveElement;
    }

    if (!chain.length) return null;

    const focusTarget = resolveFocusableElement(activeElement);
    const selection =
      typeof focusTarget?.selectionStart === 'number'
        ? {
            start: focusTarget.selectionStart,
            end: focusTarget.selectionEnd,
            direction: focusTarget.selectionDirection,
          }
        : null;

    return { chain, selection };
  }

  restoreFocusState(focusState) {
    if (!focusState?.chain?.length || !this.shadowRoot) return;

    let context = this.shadowRoot;
    let target = null;

    for (const descriptor of focusState.chain) {
      target = findFocusTarget(context, descriptor);
      if (!target) return;
      context = target.shadowRoot || target;
    }

    const focusTarget = resolveFocusableElement(target);
    if (!focusTarget || typeof focusTarget.focus !== 'function') return;

    focusTarget.focus();

    if (
      focusState.selection &&
      typeof focusTarget.setSelectionRange === 'function' &&
      typeof focusState.selection.start === 'number' &&
      typeof focusState.selection.end === 'number'
    ) {
      focusTarget.setSelectionRange(
        focusState.selection.start,
        focusState.selection.end,
        focusState.selection.direction || 'none',
      );
    }
  }
}
