import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, computeStats, reconstructLines } from '../src/core/diff.js';

test('identical text has no changes', () => {
  const r = diff('hello world', 'hello world');
  assert.equal(r.stats.added, 0);
  assert.equal(r.stats.removed, 0);
  assert.equal(r.stats.similarity, 1);
});

test('a single word change is one add + one remove', () => {
  const r = diff('the cat sat', 'the dog sat');
  assert.equal(r.stats.removed, 1);
  assert.equal(r.stats.added, 1);
  assert.ok(r.stats.similarity < 1);
});

test('CJK diff is character-level', () => {
  const r = diff('今天天气好', '今天天气很好');
  // inserted one ideograph "很"
  assert.equal(r.stats.added, 1);
  assert.equal(r.stats.removed, 0);
});

test('CJK substitution counts as remove + add', () => {
  const r = diff('我们去公园', '我们去公圆');
  assert.equal(r.stats.removed, 1); // 园
  assert.equal(r.stats.added, 1); // 圆
});

test('reconstructLines restores the original text for both sides', () => {
  const a = 'line one\nline two\nline three';
  const b = 'line one\nline 2\nline three';
  const r = diff(a, b);
  assert.equal(reconstructLines(r.ops, 'a').join('\n'), a);
  assert.equal(reconstructLines(r.ops, 'b').join('\n'), b);
});

test('computeStats works on a bare op list', () => {
  const s = computeStats([
    { type: 'equal', tokens: [1, 2, 3] },
    { type: 'insert', tokens: [4] },
    { type: 'delete', tokens: [5] },
  ]);
  assert.equal(s.unchanged, 3);
  assert.equal(s.added, 1);
  assert.equal(s.removed, 1);
  assert.equal(s.total, 5);
});

test('empty inputs diff cleanly', () => {
  const r = diff('', '');
  assert.equal(r.stats.total, 0);
  assert.equal(r.stats.similarity, 1);
});
