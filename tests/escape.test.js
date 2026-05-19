import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, escapeAttr } from '../src/utils/escape.js';

test('escapeHtml: чистий текст лишається незмінним', () => {
  assert.equal(escapeHtml('Hello world'), 'Hello world');
  assert.equal(escapeHtml('Привіт світ'), 'Привіт світ');
});

test('escapeHtml: екранує всі небезпечні символи', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml('"quote"'), '&quot;quote&quot;');
  assert.equal(escapeHtml("it's"), 'it&#39;s');
});

test('escapeHtml: уникає подвійного екранування для &amp;', () => {
  // & екранується першим — це навмисно, повторні &amp; стають &amp;amp;
  assert.equal(escapeHtml('&amp;'), '&amp;amp;');
});

test('escapeHtml: null/undefined/число → рядок', () => {
  assert.equal(escapeHtml(null), 'null');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42');
});

test('escapeAttr: екранує бек-тіки додатково', () => {
  assert.equal(escapeAttr('`code`'), '&#96;code&#96;');
  assert.equal(escapeAttr('<a href="`bad`">'), '&lt;a href=&quot;&#96;bad&#96;&quot;&gt;');
});

test('escapeHtml: ін\'єкція XSS через onclick знешкоджена', () => {
  const malicious = `" onclick="alert('xss')"`;
  const safe = escapeHtml(malicious);
  assert.equal(safe.includes('onclick="'), false);
  assert.equal(safe.includes('&quot;'), true);
});
