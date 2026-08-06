import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, describe, nextRuns } from '../src/core/cron.js';

// Pin a reference "now": 2026-08-06 09:30:00 (Thursday) local — deterministic.
const FROM = new Date(2026, 7, 6, 9, 30, 0, 0).getTime();

test('parses a standard 5-field expression', () => {
  const p = parse('0 0 * * 1');
  assert.equal(p.ok, true);
  assert.equal(p.hasSeconds, false);
  assert.ok(p.fields.minute.has(0));
  assert.ok(p.fields.hour.has(0));
  assert.ok(p.fields.dow.has(1));
});

test('rejects wrong field count', () => {
  assert.equal(parse('0 0 * *').ok, false);
  assert.equal(parse('* * * * * * *').ok, false);
});

test('expands macros', () => {
  assert.equal(parse('@daily').fields.hour.has(0), true);
  assert.equal(parse('@daily').fields.minute.has(0), true);
  assert.equal(parse('@hourly').fields.hour.size, 24);
});

test('supports steps and ranges and names', () => {
  const p = parse('*/15 9-17 * jan-mar mon');
  assert.equal(p.ok, true);
  assert.deepEqual([...p.fields.minute].sort((a, b) => a - b), [0, 15, 30, 45]);
  assert.deepEqual([...p.fields.hour].sort((a, b) => a - b), [9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.deepEqual([...p.fields.month].sort((a, b) => a - b), [1, 2, 3]);
  assert.ok(p.fields.dow.has(1));
});

test('rejects out-of-range values', () => {
  assert.equal(parse('60 0 * * *').ok, false);   // minute > 59
  assert.equal(parse('0 24 * * *').ok, false);   // hour > 23
  assert.equal(parse('0 0 32 * *').ok, false);   // day > 31
});

test('describes a weekly-midnight schedule in Chinese', () => {
  const p = parse('0 0 * * 1');
  const d = describe(p);
  assert.ok(d.zh.includes('周一'), d.zh);
  assert.ok(d.zh.includes('0 点 0 分') || d.zh.includes('0点0分'), d.zh);
});

test('computes next runs from a fixed reference time', () => {
  const nr = nextRuns('0 0 * * 1', 3, FROM); // next 3 Mondays at midnight
  assert.equal(nr.ok, true);
  assert.equal(nr.runs.length, 3);
  for (const d of nr.runs) {
    assert.equal(d.getDay(), 1);          // Monday
    assert.equal(d.getHours(), 0);
    assert.equal(d.getMinutes(), 0);
    assert.ok(d.getTime() > FROM);
  }
  // runs must be strictly increasing
  for (let i = 1; i < nr.runs.length; i++) {
    assert.ok(nr.runs[i].getTime() > nr.runs[i - 1].getTime());
  }
});

test('every-minute schedule returns the immediate next minutes', () => {
  const nr = nextRuns('* * * * *', 2, FROM);
  assert.equal(nr.ok, true);
  assert.equal(nr.runs.length, 2);
  // first run is the next minute (09:31), second 09:32
  assert.equal(nr.runs[0].getHours(), 9);
  assert.equal(nr.runs[0].getMinutes(), 31);
  assert.equal(nr.runs[1].getMinutes(), 32);
});

test('day-of-month + day-of-week restricts as OR', () => {
  // 1st of month OR Monday
  const nr = nextRuns('0 12 1 * 1', 2, FROM);
  assert.equal(nr.ok, true);
  for (const d of nr.runs) {
    const isFirst = d.getDate() === 1;
    const isMonday = d.getDay() === 1;
    assert.ok(isFirst || isMonday, d.toISOString());
  }
});
