const API_KEY = import.meta.env.VITE_GOOGLE_CSE_API_KEY;
const SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_CSE_CX;

const DEFAULT_DOMAINS = ['rozetka.com.ua', 'epicentrk.ua', 'prom.ua', 'allo.ua'];

function hasApiConfig() {
  return Boolean(API_KEY && SEARCH_ENGINE_ID);
}

function buildQuery(rawQuery, domains = DEFAULT_DOMAINS) {
  const clean = String(rawQuery || '').trim();
  if (!clean) return '';

  const domainPart = domains
    .filter(Boolean)
    .map((domain) => `site:${domain}`)
    .join(' OR ');

  return domainPart ? `(${domainPart}) ${clean}` : clean;
}

function extractImage(item) {
  const pagemap = item?.pagemap || {};
  const thumb = pagemap?.cse_thumbnail?.[0]?.src;
  const image = pagemap?.cse_image?.[0]?.src;
  const metatagImage = pagemap?.metatags?.[0]?.['og:image'];
  return thumb || image || metatagImage || '';
}

function detectSource(url = '') {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname;
  } catch {
    return '';
  }
}

export function canUseLiveProductSearch() {
  return hasApiConfig();
}

export async function searchProductsLive(query, options = {}) {
  const { num = 5, domains = DEFAULT_DOMAINS, signal } = options;

  if (!hasApiConfig()) return [];

  const q = buildQuery(query, domains);
  if (!q) return [];

  const params = new URLSearchParams({
    key: API_KEY,
    cx: SEARCH_ENGINE_ID,
    q,
    num: String(Math.min(10, Math.max(1, num))),
    hl: 'uk',
    gl: 'ua',
    safe: 'off',
  });

  const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`, {
    signal,
  });
  if (!response.ok) return [];

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return items
    .map((item) => ({
      title: String(item?.title || ''),
      url: String(item?.link || ''),
      imageUrl: extractImage(item),
      source: detectSource(item?.link || ''),
      snippet: String(item?.snippet || ''),
    }))
    .filter((item) => item.url);
}
