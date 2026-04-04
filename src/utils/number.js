export function parseLocaleNumber(value, fallback = null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');

  if (!normalized) return fallback;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeComparableString(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
