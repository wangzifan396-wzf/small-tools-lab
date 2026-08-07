import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferEpochUnit,
  epochToDate,
  parseDateTime,
  formatLocal,
  formatUtc,
  formatRelative,
} from '../src/index.js';

test('inferEpochUnit distinguishes seconds and milliseconds by integer digits', () => {
  assert.equal(inferEpochUnit('1717000000'), 's');
  assert.equal(inferEpochUnit('1717000000000'), 'ms');
  assert.equal(inferEpochUnit('-001717000000000'), 'ms');
});

test('inferEpochUnit rejects non-numeric input', () => {
  assert.throws(() => inferEpochUnit('tomorrow'), /finite number/);
});

test('epochToDate converts seconds and milliseconds to the same instant', () => {
  const seconds = epochToDate(1717000000, 's');
  const milliseconds = epochToDate(1717000000000, 'ms');
  assert.equal(seconds.date.toISOString(), milliseconds.date.toISOString());
  assert.equal(seconds.milliseconds, 1717000000000);
  assert.equal(milliseconds.seconds, 1717000000);
});

test('epochToDate auto-detects units and validates explicit units', () => {
  assert.equal(epochToDate('1717000000000').unit, 'ms');
  assert.throws(() => epochToDate(1, 'minutes'), /Unit must/);
  assert.throws(() => epochToDate(Number.POSITIVE_INFINITY), /finite number/);
});

test('parseDateTime accepts local date-time with optional seconds and milliseconds', () => {
  const date = parseDateTime('2024-05-30 12:34:56.7');
  assert.equal(date.getFullYear(), 2024);
  assert.equal(date.getMonth(), 4);
  assert.equal(date.getDate(), 30);
  assert.equal(date.getMilliseconds(), 700);
  assert.equal(parseDateTime('2024-05-30 12:34').getSeconds(), 0);
  assert.equal(formatLocal(parseDateTime('2024-05-30')), '2024-05-30 00:00:00');
});

test('parseDateTime rejects calendar overflow and empty values', () => {
  assert.throws(() => parseDateTime('2024-02-30 12:00:00'), /out of range/);
  assert.throws(() => parseDateTime('2024-02-30'), /out of range/);
  assert.throws(() => parseDateTime(''), /non-empty/);
  assert.throws(() => parseDateTime('not-a-date'), /Invalid date/);
});

test('parseDateTime clones Date inputs', () => {
  const original = new Date('2024-01-02T03:04:05.000Z');
  const parsed = parseDateTime(original);
  assert.notEqual(parsed, original);
  assert.equal(parsed.getTime(), original.getTime());
});

test('formatUtc produces a stable UTC representation', () => {
  assert.equal(formatUtc(new Date('2024-01-02T03:04:05.000Z')), '2024-01-02 03:04:05 UTC');
});

test('formatLocal preserves local date components', () => {
  const local = new Date(2024, 0, 2, 3, 4, 5);
  assert.equal(formatLocal(local), '2024-01-02 03:04:05');
});

test('formatRelative handles past, future, and current instants', () => {
  const now = Date.UTC(2024, 0, 1);
  assert.equal(formatRelative(now, now), '现在');
  assert.equal(formatRelative(now - 90_000, now), '1 分钟前');
  assert.equal(formatRelative(now + 3 * 86_400_000, now), '3 天后');
});
