import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseTimecode,
  parseDuration,
  formatTimecode,
  formatSrtTime,
  formatVttTime,
  formatAssTime,
  formatLrcTime,
  formatHuman,
  resolveFrameRate,
  FRAME_RATES,
  MS_PER_SECOND,
} from '../src/core/timecode.js';

test('parseTimecode handles SRT (comma) and VTT (dot) shapes', () => {
  assert.equal(parseTimecode('01:02:03,456'), 1 * 3600000 + 2 * 60000 + 3 * 1000 + 456);
  assert.equal(parseTimecode('1:02:03.45'), 1 * 3600000 + 2 * 60000 + 3 * 1000 + 450);
});

test('parseTimecode parses mm:ss and bare ss', () => {
  assert.equal(parseTimecode('02:03'), 2 * 60000 + 3 * 1000);
  assert.equal(parseTimecode('03'), 3 * 1000);
  assert.equal(parseTimecode('00:00:00'), 0);
});

test('parseTimecode returns NaN for noise', () => {
  assert.ok(Number.isNaN(parseTimecode('not a time')));
  assert.ok(Number.isNaN(parseTimecode('')));
  assert.ok(Number.isNaN(parseTimecode('abc')));
});

test('parseTimecode tolerates overflowing seconds (00:00:75,000)', () => {
  // 75 seconds rolls into 1 minute 15 seconds.
  assert.equal(parseTimecode('00:00:75,000'), 75000);
});

test('parseDuration accepts units and bare numbers', () => {
  assert.equal(parseDuration('2.5s'), 2500);
  assert.equal(parseDuration('250ms'), 250);
  assert.equal(parseDuration('1m'), 60000);
  assert.equal(parseDuration('1h'), 3600000);
  assert.equal(parseDuration('2s'), 2000);
  assert.equal(parseDuration('-3s'), -3000);
});

test('formatSrtTime / formatVttTime / formatAssTime / formatLrcTime', () => {
  assert.equal(formatSrtTime(3723456), '01:02:03,456');
  assert.equal(formatVttTime(3723456), '01:02:03.456');
  assert.equal(formatAssTime(3723456), '1:02:03.46');
  assert.equal(formatLrcTime(1000), '[00:01.00]');
  assert.equal(formatLrcTime(0), '[00:00.00]');
});

test('formatTimecode honours separator and fraction digits', () => {
  assert.equal(formatTimecode(1234, { separator: '.', fractionDigits: 2 }), '00:00:01.23');
  assert.equal(formatTimecode(65000, { hourDigits: 2 }), '00:01:05,000');
});

test('formatHuman produces compact durations', () => {
  assert.equal(formatHuman(500), '500ms');
  assert.equal(formatHuman(2500), '2.5s');
  assert.equal(formatHuman(65000), '1m05s');
  assert.equal(formatHuman(3661000), '1h01m01s');
});

test('resolveFrameRate maps named presets and common shorthands', () => {
  assert.equal(resolveFrameRate('film'), 24);
  assert.equal(resolveFrameRate('pal'), 25);
  assert.equal(resolveFrameRate('web'), 30);
  assert.ok(Math.abs(resolveFrameRate('23.976') - 24000 / 1001) < 1e-9);
  assert.ok(Math.abs(resolveFrameRate('29.97') - 30000 / 1001) < 1e-9);
  assert.ok(Number.isNaN(resolveFrameRate('bananas')));
});

test('FRAME_RATES exposes ntsc fractional rates', () => {
  assert.ok(Math.abs(FRAME_RATES.ntsc - 30000 / 1001) < 1e-9);
  assert.equal(MS_PER_SECOND, 1000);
});
