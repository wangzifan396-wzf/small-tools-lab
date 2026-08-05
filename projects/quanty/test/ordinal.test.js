import test from 'node:test';
import assert from 'node:assert/strict';
import { ordinal } from '../src/core/ordinal.js';

test('ordinal: English', () => {
  assert.equal(ordinal(1), '1st');
  assert.equal(ordinal(2), '2nd');
  assert.equal(ordinal(3), '3rd');
  assert.equal(ordinal(4), '4th');
  assert.equal(ordinal(11), '11th');
  assert.equal(ordinal(12), '12th');
  assert.equal(ordinal(13), '13th');
  assert.equal(ordinal(21), '21st');
  assert.equal(ordinal(22), '22nd');
  assert.equal(ordinal(100), '100th');
});

test('ordinal: Chinese', () => {
  assert.equal(ordinal(1, { lang: 'zh' }), '第1');
  assert.equal(ordinal(22, { lang: 'zh' }), '第22');
  assert.equal(ordinal(100, { lang: 'zh' }), '第100');
});

test('ordinal: rejects non-finite', () => {
  assert.throws(() => ordinal('x'), TypeError);
});
