function getWebCrypto() {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.crypto || globalThis.webcrypto || null;
}

export function generateId() {
  const webCrypto = getWebCrypto();
  if (webCrypto?.randomUUID) return webCrypto.randomUUID();
  // Fallback для оточень без webcrypto (старі Node для тестів, рідкісні браузери).
  // Не криптографічно стійкий, але для DOM/storage id достатньо.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
