import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCue } from '../src/core/cue.js';
import { lint, fix, fixAndLint, resolveConfig, severityRank } from '../src/core/lint.js';
import { presets } from '../src/rules/index.js';

const clean = [
  createCue({ start: 1000, end: 3000, lines: ['Hello world'] }),
  createCue({ start: 3500, end: 5000, lines: ['Second line'] }),
];

const messy = [createCue({ start: 0, end: 1100, lines: ['大家好，欢迎收看这期video'] })];

test('lint reports zero problems on a clean track (recommended)', () => {
  const result = lint(clean, { preset: 'recommended' });
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
  assert.equal(result.cueCount, 2);
});

test('lint detects the 盘古之白 issue with the cjk preset', () => {
  const result = lint(messy, { preset: 'cjk' });
  const hit = result.diagnostics.find((d) => d.ruleId === 'cjk-latin-spacing');
  assert.ok(hit, 'expected a cjk-latin-spacing diagnostic');
  assert.equal(hit.severity, 'warn');
  assert.equal(hit.fixable, true);
});

test('fix removes fixable problems and reduces the count', () => {
  const result = lint(messy, { preset: 'cjk' });
  assert.ok(result.diagnostics.length > 0);
  const fixed = fix(messy, { preset: 'cjk' });
  assert.ok(fixed.changed > 0);
  const after = lint(fixed.cues, { preset: 'cjk' });
  assert.ok(after.diagnostics.length < result.diagnostics.length);
});

test('fixAndLint returns before/after summaries', () => {
  const out = fixAndLint(messy, { preset: 'cjk' });
  assert.ok(out.before.diagnostics.length >= out.after.diagnostics.length);
  assert.ok(out.changed > 0);
});

test('severityRank orders off < info < warn < error', () => {
  assert.ok(severityRank('off') < severityRank('info'));
  assert.ok(severityRank('info') < severityRank('warn'));
  assert.ok(severityRank('warn') < severityRank('error'));
});

test('resolveConfig throws on an unknown preset', () => {
  assert.throws(() => resolveConfig({ preset: 'does-not-exist' }), /Unknown preset/);
});

test('every preset resolves without error', () => {
  for (const name of Object.keys(presets)) {
    const cfg = resolveConfig({ preset: name });
    assert.equal(cfg.preset, name);
    assert.ok(cfg.entries.length > 0);
  }
});

test('user overrides can turn a rule off', () => {
  const on = lint(messy, { preset: 'cjk' });
  const off = lint(messy, { preset: 'cjk', rules: { 'cjk-latin-spacing': 'off' } });
  assert.ok(on.diagnostics.length > off.diagnostics.length);
});
