import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCue,
  normalizeLines,
  cueText,
  cueDuration,
  overlapMs,
  overlapRatio,
  normalizeCues,
  reindex,
  trackSpan,
  cloneCues,
} from '../src/core/cue.js';

test('createCue rounds times and accepts string or array lines', () => {
  const cue = createCue({ start: 1.5, end: 2.5, lines: 'single' });
  assert.equal(cue.start, 2);
  assert.equal(cue.end, 3);
  assert.deepEqual(cue.lines, ['single']);
});

test('normalizeLines splits on newlines, CRLF and ASS \\N, keeps trailing space', () => {
  assert.deepEqual(normalizeLines('a\nb'), ['a', 'b']);
  assert.deepEqual(normalizeLines('a\r\nb'), ['a', 'b']);
  assert.deepEqual(normalizeLines('a\\Nb'), ['a', 'b']);
  const kept = normalizeLines(['trailing ']);
  assert.equal(kept[0], 'trailing ');
});

test('cueText and cueDuration', () => {
  const cue = createCue({ start: 1000, end: 2500, lines: ['a', 'b'] });
  assert.equal(cueText(cue), 'a\nb');
  assert.equal(cueText(cue, ' '), 'a b');
  assert.equal(cueDuration(cue), 1500);
});

test('overlapMs / overlapRatio', () => {
  const a = createCue({ start: 0, end: 1000, lines: ['a'] });
  const b = createCue({ start: 500, end: 1500, lines: ['b'] });
  assert.equal(overlapMs(a, b), 500);
  assert.equal(overlapMs(a, createCue({ start: 2000, end: 3000, lines: ['x'] })), 0);
  assert.equal(overlapRatio(a, a), 1);
});

test('normalizeCues sorts by start and reindexes', () => {
  const cues = [
    createCue({ start: 3000, end: 4000, lines: ['late'] }),
    createCue({ start: 1000, end: 2000, lines: ['early'] }),
  ];
  const out = normalizeCues(cues);
  assert.deepEqual(out.map((c) => c.start), [1000, 3000]);
  assert.deepEqual(out.map((c) => c.index), [1, 2]);
  assert.notEqual(out[0], cues[1]); // returns a new array
});

test('reindex rewrites 1..n', () => {
  const cues = [createCue({ start: 0, end: 1, lines: ['a'] }), createCue({ start: 2, end: 3, lines: ['b'] })];
  cues[0].index = 9;
  assert.deepEqual(reindex(cues).map((c) => c.index), [1, 2]);
});

test('trackSpan measures the whole track', () => {
  const span = trackSpan([
    createCue({ start: 1000, end: 2000, lines: ['a'] }),
    createCue({ start: 3000, end: 5000, lines: ['b'] }),
  ]);
  assert.deepEqual(span, { start: 1000, end: 5000, duration: 4000 });
  assert.deepEqual(trackSpan([]), { start: 0, end: 0, duration: 0 });
});

test('cloneCues deep-copies lines', () => {
  const cues = [createCue({ start: 0, end: 1, lines: ['a'] })];
  const cloned = cloneCues(cues);
  cloned[0].lines[0] = 'mutated';
  assert.equal(cues[0].lines[0], 'a');
});
