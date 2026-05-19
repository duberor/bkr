import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocaleNumber, normalizeComparableString } from '../src/utils/number.js';

test('parseLocaleNumber: числа повертаються без змін', () => {
  assert.equal(parseLocaleNumber(42), 42);
  assert.equal(parseLocaleNumber(0), 0);
  assert.equal(parseLocaleNumber(-15.7), -15.7);
});

test('parseLocaleNumber: NaN і Infinity дають fallback', () => {
  assert.equal(parseLocaleNumber(NaN, 99), 99);
  assert.equal(parseLocaleNumber(Infinity, 99), 99);
  assert.equal(parseLocaleNumber(NaN), null);
});

test('parseLocaleNumber: рядки з комою як десятковий розділювач', () => {
  assert.equal(parseLocaleNumber('1,5'), 1.5);
  assert.equal(parseLocaleNumber('0,92'), 0.92);
  assert.equal(parseLocaleNumber('-3,14'), -3.14);
});

test('parseLocaleNumber: пробіли видаляються', () => {
  assert.equal(parseLocaleNumber('1 000'), 1000);
  assert.equal(parseLocaleNumber(' 5,5 '), 5.5);
  assert.equal(parseLocaleNumber('1 000 000'), 1000000);
});

test('parseLocaleNumber: невалідний рядок → fallback', () => {
  assert.equal(parseLocaleNumber('abc', 0), 0);
  assert.equal(parseLocaleNumber('', 7), 7);
  assert.equal(parseLocaleNumber(null, 1), 1);
  assert.equal(parseLocaleNumber(undefined, 1), 1);
});

test('parseLocaleNumber: крапка теж працює', () => {
  assert.equal(parseLocaleNumber('3.14'), 3.14);
});

test('normalizeComparableString: trim + lowercase + collapse spaces', () => {
  assert.equal(normalizeComparableString(' Hello World '), 'hello world');
  assert.equal(normalizeComparableString('Hello   World'), 'hello world');
  assert.equal(normalizeComparableString('\thello\n\tworld'), 'hello world');
});

test('normalizeComparableString: кирилиця нормалізується', () => {
  assert.equal(normalizeComparableString('  Газовий КОТЕЛ  '), 'газовий котел');
});

test('normalizeComparableString: null/undefined/число', () => {
  assert.equal(normalizeComparableString(null), '');
  assert.equal(normalizeComparableString(undefined), '');
  assert.equal(normalizeComparableString(42), '42');
});
