import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, CronError } from '../src/core/parse.js';

test('parses a basic 5-field expression', () => {
  const c = parse('0 9 * * 1-5');
  assert.ok(c.minute.has(0));
  assert.ok(c.hour.has(9));
  assert.equal(c.domStar, true);
  assert.deepEqual([...c.dow].sort(), [1, 2, 3, 4, 5]);
  assert.equal(c.dowStar, false);
});

test('expands steps', () => {
  assert.deepEqual([...parse('*/15 * * * *').minute].sort((a, b) => a - b), [0, 15, 30, 45]);
});

test('expands range with step', () => {
  assert.deepEqual([...parse('0 9-17/2 * * *').hour].sort((a, b) => a - b), [9, 11, 13, 15, 17]);
});

test('resolves month names', () => {
  const c = parse('0 9 1 jan-mar *');
  assert.deepEqual([...c.month].sort((a, b) => a - b), [1, 2, 3]);
});

test('resolves weekday names and ranges', () => {
  assert.deepEqual([...parse('0 9 * * mon-fri').dow].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test('treats 7 as Sunday (0)', () => {
  assert.deepEqual([...parse('0 9 * * 0,7').dow].sort(), [0]);
});

test('marks star fields', () => {
  const c = parse('* * * * *');
  assert.equal(c.domStar, true);
  assert.equal(c.dowStar, true);
});

test('supports 6-field seconds expressions', () => {
  const c = parse('*/20 0 0 * * *', { seconds: true });
  assert.equal(c.hasSeconds, true);
  assert.deepEqual([...c.seconds].sort((a, b) => a - b), [0, 20, 40]);
});

test('rejects too few fields', () => {
  assert.throws(() => parse('0 9 * *'), CronError);
});

test('rejects out-of-range values', () => {
  assert.throws(() => parse('70 0 0 * * *', { seconds: true }), CronError);
});

test('rejects invalid names', () => {
  assert.throws(() => parse('0 0 0 * foo'), CronError);
});

test('rejects an invalid step', () => {
  assert.throws(() => parse('*/x * * * *'), CronError);
});
