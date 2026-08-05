import { test } from 'node:test';
import assert from 'node:assert/strict';
import { next, prev, nextRuns, partsInTz } from '../src/core/schedule.js';

const MON = new Date('2026-08-03T08:30:00Z'); // Monday

test('next weekday 9:00 is later the same morning', () => {
  const r = next('0 9 * * 1-5', MON, { timeZone: 'UTC' });
  assert.equal(r.getTime(), Date.parse('2026-08-03T09:00:00Z'));
});

test('previous run before Monday morning is the prior Friday', () => {
  const r = prev('0 9 * * 1-5', MON, { timeZone: 'UTC' });
  assert.equal(r.getTime(), Date.parse('2026-07-31T09:00:00Z'));
});

test('nextRuns skips the weekend', () => {
  const runs = nextRuns('0 9 * * 1-5', 3, MON, { timeZone: 'UTC' });
  assert.equal(runs.length, 3);
  assert.equal(runs[0].getTime(), Date.parse('2026-08-03T09:00:00Z'));
  assert.equal(runs[1].getTime(), Date.parse('2026-08-04T09:00:00Z'));
  assert.equal(runs[2].getTime(), Date.parse('2026-08-05T09:00:00Z'));
});

test('respects a timezone (America/New_York, EDT = UTC-4)', () => {
  const r = next('0 9 * * 1-5', new Date('2026-08-03T12:00:00Z'), { timeZone: 'America/New_York' });
  assert.equal(r.getTime(), Date.parse('2026-08-03T13:00:00Z'));
});

test('partsInTz returns wall-clock time in the zone', () => {
  const p = partsInTz(new Date('2026-08-03T13:00:00Z'), 'America/New_York');
  assert.equal(p.hour, 9);
  assert.equal(p.dow, 1);
});

test('handles seconds-level expressions', () => {
  const r = next('*/20 0 0 * * *', new Date('2026-08-03T00:00:00Z'), { seconds: true, timeZone: 'UTC' });
  assert.equal(r.getTime(), Date.parse('2026-08-03T00:00:20Z'));
});

test('returns null when no run exists (Feb 31)', () => {
  assert.equal(next('0 0 31 2 *', MON, { timeZone: 'UTC' }), null);
});
