import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCue } from '../src/core/cue.js';
import {
  mergeBilingual,
  splitBilingual,
  analyzeAlignment,
} from '../src/core/bilingual.js';

const zh = [
  createCue({ start: 1000, end: 3000, lines: ['你好，世界'] }),
  createCue({ start: 3500, end: 5000, lines: ['今天天气不错'] }),
];

const en = [
  createCue({ start: 1000, end: 3000, lines: ['Hello, world'] }),
  createCue({ start: 3500, end: 5000, lines: ['Nice weather today'] }),
];

test('mergeBilingual joins languages by time overlap', () => {
  const { cues, matched, unmatched } = mergeBilingual(zh, en);
  assert.equal(matched, 2);
  assert.equal(unmatched, 0);
  assert.equal(cues[0].lines.length, 2);
  assert.equal(cues[0].lines[0], '你好，世界');
  assert.equal(cues[0].lines[1], 'Hello, world');
});

test('mergeBilingual keeps unmatched secondary cues when asked', () => {
  const extra = [...en, createCue({ start: 90000, end: 91000, lines: ['orphan'] })];
  const out = mergeBilingual(zh, extra, { keepUnmatched: true });
  assert.equal(out.unmatched, 1);
  assert.ok(out.cues.some((c) => c.lines[0] === 'orphan'));
});

test('splitBilingual separates by script', () => {
  const merged = mergeBilingual(zh, en).cues;
  const { first, second } = splitBilingual(merged, { strategy: 'script', first: 'cjk' });
  assert.equal(first.length, 2);
  assert.equal(first[0].lines[0], '你好，世界');
  assert.equal(second[0].lines[0], 'Hello, world');
});

test('splitBilingual line strategy takes line 1 vs the rest', () => {
  const merged = mergeBilingual(zh, en).cues;
  const { first, second } = splitBilingual(merged, { strategy: 'line', first: 'cjk' });
  assert.equal(first[0].lines[0], '你好，世界');
});

test('analyzeAlignment reports match rate and drift', () => {
  const stats = analyzeAlignment(zh, en);
  assert.equal(stats.matched, 2);
  assert.equal(stats.secondaryCues, 2);
  assert.equal(stats.matchRate, 1);
  assert.equal(stats.averageDrift, 0);
});
