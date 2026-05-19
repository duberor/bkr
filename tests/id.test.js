import test from 'node:test';
import assert from 'node:assert/strict';
import { generateId } from '../src/utils/id.js';

test('generateId: повертає непорожній рядок', () => {
  const id = generateId();
  assert.equal(typeof id, 'string');
  assert.ok(id.length > 0);
});

test('generateId: послідовні виклики дають різні значення', () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) ids.add(generateId());
  assert.equal(ids.size, 100, 'жодного дубліката серед 100 ID');
});

test('generateId: у Node 18+ використовує webcrypto.randomUUID (UUID формат) або fallback', () => {
  const id = generateId();
  // Або UUID v4 формат, або наш fallback 'id-XXX-XXX'
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const isFallback = /^id-[a-z0-9]+-[a-z0-9]+$/.test(id);
  assert.ok(isUuid || isFallback, `id має бути UUID або fallback, отримано: ${id}`);
});
