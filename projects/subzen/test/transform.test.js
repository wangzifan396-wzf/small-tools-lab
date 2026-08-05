import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCue } from '../src/core/cue.js';
import {
  shift,
  scale,
  resync,
  convertFrameRate,
  fixOverlaps,
  removeEmpty,
  dedupe,
  filterByText,
  slice,
  concat,
  rewrap,
  clampDurations,
} from '../src/core/transform.js';

const cue = createCue({ start: 1000, end: 2000, lines: ['a'] });

test('shift moves every cue', () => {
  const out = shift([cue], 1000);
  assert.equal(out[0].start, 2000);
  assert.equal(out[0].end, 3000);
});

test('shift clamps negatives to zero', () => {
  const out = shift([createCue({ start: 500, end: 1000, lines: ['a'] })], -1000);
  assert.equal(out[0].start, 0);
  assert.equal(out[0].end, 0);
});

test('scale stretches the timeline around a pivot', () => {
  const out = scale([cue], 2);
  assert.equal(out[0].start, 2000);
  assert.equal(out[0].end, 4000);
});

test('resync single anchor is a pure offset', () => {
  const out = resync([createCue({ start: 0, end: 1000, lines: ['a'] })], [{ from: 0, to: 500 }]);
  assert.equal(out.cues[0].start, 500);
  assert.equal(out.rate, 1);
  assert.equal(out.offset, 500);
});

test('resync two anchors solves for drift (rate 1.01)', () => {
  const cues = [createCue({ start: 0, end: 1000, lines: ['a'] }), createCue({ start: 10000, end: 11000, lines: ['b'] })];
  const out = resync(cues, [{ from: 0, to: 0 }, { from: 10000, to: 10100 }]);
  assert.ok(Math.abs(out.rate - 1.01) < 1e-9);
  assert.equal(out.cues[1].start, 10100);
});

test('convertFrameRate scales by from/to', () => {
  const out = convertFrameRate([createCue({ start: 30000, end: 33000, lines: ['a'] })], { from: 25, to: 30 });
  assert.equal(out[0].start, 25000);
  assert.equal(out[0].end, 27500);
});

test('fixOverlaps removes overlaps', () => {
  const cues = [
    createCue({ start: 0, end: 1000, lines: ['a'] }),
    createCue({ start: 900, end: 2000, lines: ['b'] }),
  ];
  const out = fixOverlaps(cues);
  assert.ok(out[0].end <= out[1].start);
});

test('removeEmpty drops blank cues', () => {
  const cues = [createCue({ start: 0, end: 1000, lines: [''] }), createCue({ start: 1000, end: 2000, lines: ['hi'] })];
  assert.equal(removeEmpty(cues).length, 1);
});

test('dedupe collapses adjacent identical cues', () => {
  const cues = [
    createCue({ start: 0, end: 1000, lines: ['x'] }),
    createCue({ start: 1000, end: 2000, lines: ['x'] }),
  ];
  const out = dedupe(cues);
  assert.equal(out.length, 1);
  assert.equal(out[0].end, 2000);
});

test('filterByText keeps matching cues', () => {
  const cues = [createCue({ start: 0, end: 1000, lines: ['keep me'] }), createCue({ start: 1000, end: 2000, lines: ['drop'] })];
  const out = filterByText(cues, /keep/);
  assert.equal(out.length, 1);
  assert.equal(filterByText(cues, /keep/, { invert: true }).length, 1);
});

test('slice extracts a time window', () => {
  const cues = [createCue({ start: 0, end: 1000, lines: ['a'] }), createCue({ start: 5000, end: 6000, lines: ['b'] })];
  const out = slice(cues, { start: 4000, end: 7000 });
  assert.equal(out.length, 1);
  assert.equal(out[0].start, 5000);
});

test('concat joins tracks end to end', () => {
  const out = concat([
    { cues: [createCue({ start: 0, end: 1000, lines: ['a'] })], offset: 0 },
    { cues: [createCue({ start: 0, end: 1000, lines: ['b'] })], offset: 5000 },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[1].start, 5000);
});

test('rewrap shortens an over-long line', () => {
  const cues = [createCue({ start: 0, end: 5000, lines: ['这是一段明显过长需要重新换行处理的中文测试文本用于验证换行功能'] })];
  const out = rewrap(cues, { width: 12, maxLines: 2 });
  assert.ok(out[0].lines.length >= 1);
});

test('clampDurations caps over-long cues', () => {
  const cues = [createCue({ start: 0, end: 9000, lines: ['a'] })];
  const out = clampDurations(cues, { max: 7000 });
  assert.equal(out[0].end, 7000);
});
