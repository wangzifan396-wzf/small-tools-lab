import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCue } from '../src/core/cue.js';
import { lint } from '../src/core/lint.js';
import { computeStats } from '../src/core/stats.js';
import { formatText, formatCompact, formatJson, formatGitHub, formatStats } from '../src/core/report.js';

const messy = [createCue({ start: 0, end: 1100, lines: ['大家好，欢迎收看这期video'] })];

function fileReport(color) {
  const result = lint(messy, { preset: 'cjk' });
  return [{ file: 'examples/messy.zh.srt', result, parseWarnings: [] }].map((r) => ({ ...r }));
}

test('formatText renders a summary line', () => {
  const text = formatText(fileReport(), { color: false });
  assert.ok(/problem/.test(text));
  assert.ok(text.includes('messy.zh.srt'));
  assert.ok(text.includes('cjk-latin-spacing'));
});

test('formatCompact is grep-friendly', () => {
  const text = formatCompact(fileReport());
  assert.ok(text.includes('messy.zh.srt'));
  assert.ok(text.includes('cjk-latin-spacing'));
});

test('formatJson produces parseable JSON with summary', () => {
  const text = formatJson(fileReport());
  const data = JSON.parse(text);
  assert.equal(data.tool, 'subzen');
  assert.equal(data.files.length, 1);
  assert.ok(data.summary.errorCount >= 0);
});

test('formatGitHub emits workflow commands', () => {
  const text = formatGitHub(fileReport());
  assert.ok(text.startsWith('::warning') || text.startsWith('::error') || text.startsWith('::notice'));
});

test('formatStats and computeStats work on real cues', () => {
  const cues = [
    createCue({ start: 1000, end: 3000, lines: ['你好，世界'] }),
    createCue({ start: 3500, end: 5000, lines: ['今天天气不错'] }),
  ];
  const stats = computeStats(cues);
  assert.equal(stats.cueCount, 2);
  assert.equal(stats.dominant, 'cjk');
  assert.ok(stats.chars.cjk > 0);
  const out = formatStats(stats, { color: false });
  assert.ok(out.includes('cues'));
});

test('formatText shows "no problems found" for a clean result', () => {
  const result = lint([createCue({ start: 1000, end: 3000, lines: ['Hello world'] })], { preset: 'recommended' });
  const text = formatText([{ file: 'clean.srt', result, parseWarnings: [] }], { color: false });
  assert.ok(text.includes('no problems found'));
});
