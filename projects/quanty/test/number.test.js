import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, formatCompact } from '../src/core/number.js';

test('formatNumber: thousands separators', () => {
  assert.equal(formatNumber(1234567), '1,234,567');
  assert.equal(formatNumber(1000), '1,000');
});

test('formatNumber: decimals', () => {
  assert.equal(formatNumber(1234.5, { decimals: 2 }), '1,234.50');
  assert.equal(formatNumber(1234.5, { decimals: 2, thousands: false }), '1234.50');
});

test('formatNumber: negative', () => {
  assert.equal(formatNumber(-1234), '-1,234');
});

test('formatNumber: locale', () => {
  assert.equal(formatNumber(1234567, { locale: 'en-US' }), '1,234,567');
  assert.equal(formatNumber(1234567.5, { decimals: 1, locale: 'de-DE' }), '1.234.567,5');
});

test('formatNumber: rejects non-finite', () => {
  assert.throws(() => formatNumber('x'), TypeError);
});

test('formatCompact: SI', () => {
  assert.equal(formatCompact(999), '999');
  assert.equal(formatCompact(1234), '1.2K');
  assert.equal(formatCompact(1500000), '1.5M');
  assert.equal(formatCompact(1.5e12), '1.5T');
});

test('formatCompact: Chinese thresholds', () => {
  assert.equal(formatCompact(1500000, { style: 'zh' }), '150万');
  assert.equal(formatCompact(123456789, { style: 'zh' }), '1.2亿');
});

test('formatCompact: zero and rejects non-finite', () => {
  assert.equal(formatCompact(0), '0');
  assert.throws(() => formatCompact(Infinity), TypeError);
});
