import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe } from '../src/core/describe.js';

test('describes a weekday schedule in English', () => {
  const s = describe('0 9 * * 1-5', { lang: 'en' });
  assert.ok(s.includes('09:00'), s);
  assert.ok(s.includes('Monday'), s);
  assert.ok(s.includes('Friday'), s);
});

test('describes a weekday schedule in Chinese', () => {
  const s = describe('0 9 * * 1-5', { lang: 'zh' });
  assert.ok(s.includes('09:00'), s);
  assert.ok(s.includes('周一'), s);
  assert.ok(s.includes('周五'), s);
  assert.ok(s.includes('运行'), s);
});

test('describes every-minute in English', () => {
  assert.equal(describe('* * * * *', { lang: 'en' }), 'every minute');
});

test('describes every-minute in Chinese', () => {
  assert.ok(describe('* * * * *', { lang: 'zh' }).includes('每分钟'));
});

test('describes a monthly restriction', () => {
  const s = describe('0 0 1 jan-mar *', { lang: 'en' });
  assert.ok(s.includes('January'), s);
  assert.ok(s.includes('March'), s);
});
