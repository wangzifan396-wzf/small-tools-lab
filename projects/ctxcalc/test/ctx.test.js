import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELS, modelById, analyze, estimateTokens, fitContext, estimateCost, preview,
} from '../src/core/ctx.js';
import { run } from '../src/cli.js';

test('estimateTokens returns 0 for empty input', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(undefined), 0);
});

test('CJK text counts ~1 token per character', () => {
  const t = estimateTokens('你好世界');
  assert.equal(t, 4); // 4 CJK chars → 4 tokens
});

test('latin words approximate ~1.3 tokens each', () => {
  const t = estimateTokens('hello world');
  // 2 words * 1.3 + 1 space * 0.3 = 2.9 → ceil 3
  assert.equal(t, 3);
});

test('analyze separates character classes', () => {
  const a = analyze('你好abc 12');
  assert.equal(a.cjk, 2);
  assert.equal(a.words, 2); // abc, 12
  assert.equal(a.other, 1); // the space
  assert.ok(a.tokens > 0);
  assert.equal(a.chars, '你好abc 12'.length);
});

test('fitContext reports fit, pct and copies', () => {
  const f = fitContext(1000, 10000);
  assert.equal(f.fits, true);
  assert.equal(f.pct, 10);
  assert.equal(f.remaining, 9000);
  assert.equal(f.fitCopies, 10);
});

test('fitContext flags overflow', () => {
  const f = fitContext(5000, 1000);
  assert.equal(f.fits, false);
  assert.equal(f.pct, 100); // capped
  assert.equal(f.remaining, 0);
  assert.equal(f.ratio, 5);
});

test('estimateCost scales by per-1K price', () => {
  const m = modelById('gpt-4o'); // in 0.005, out 0.015
  const c = estimateCost(1000, 2000, m);
  assert.equal(c.costIn, 0.005);
  assert.equal(c.costOut, 0.03);
  assert.ok(Math.abs(c.cost - 0.035) < 1e-9, 'cost = ' + c.cost);
});

test('preview combines tokens, context and cost', () => {
  const r = preview('你好 world', 'claude-3.7-sonnet', 500);
  assert.equal(r.model.id, 'claude-3.7-sonnet');
  assert.ok(r.tokens >= 3);
  assert.equal(r.ctx, 200000);
  assert.equal(r.fits, true);
  assert.ok(r.cost > 0);
});

test('preview falls back to first model for unknown id', () => {
  const r = preview('hi', 'does-not-exist');
  assert.equal(r.model.id, MODELS[0].id);
});

test('MODELS catalog is well-formed', () => {
  assert.ok(MODELS.length >= 10);
  const ids = new Set(MODELS.map((m) => m.id));
  assert.equal(ids.size, MODELS.length, 'duplicate model ids');
  for (const m of MODELS) {
    assert.ok(m.ctx > 0, m.id + ' missing ctx');
    assert.ok(typeof m.inPer1k === 'number', m.id + ' missing inPer1k');
  }
});

test('CLI --list prints models', () => {
  const r = run(['--list']);
  assert.equal(r.code, 0);
  assert.match(r.out, /gpt-4o/);
});

test('CLI estimates for a sample string', () => {
  const r = run(['你好 world', 'gpt-4o']);
  assert.equal(r.code, 0);
  assert.match(r.out, /估算 token/);
  assert.match(r.out, /可放下|超出/);
});

test('CLI rejects unknown model', () => {
  const r = run(['hi', 'nope']);
  assert.equal(r.code, 1);
  assert.match(r.out, /未知模型/);
});

test('CLI shows usage when empty', () => {
  const r = run([]);
  assert.equal(r.code, 1);
  assert.match(r.out, /用法/);
});
