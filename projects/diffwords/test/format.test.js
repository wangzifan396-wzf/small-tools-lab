import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff } from '../src/core/diff.js';
import {
  formatInline,
  formatUnified,
  formatHtml,
  formatJson,
  stripAnsi,
} from '../src/core/format.js';

const A = 'the quick brown fox';
const B = 'the slow brown fox';

test('formatInline marks changed words (no color)', () => {
  const r = diff(A, B);
  const out = formatInline(r, { color: false });
  // "quick" removed, "slow" added; the rest unchanged and present.
  assert.ok(out.includes('brown'));
  assert.ok(out.includes('quick'));
  assert.ok(out.includes('slow'));
  assert.equal(stripAnsi(out), out);
});

test('formatInline emits ANSI when color is on', () => {
  const r = diff(A, B);
  const out = formatInline(r, { color: true });
  assert.notEqual(stripAnsi(out), out);
});

test('formatUnified emits hunks for changed lines', () => {
  const a = 'one\ntwo\nthree';
  const b = 'one\nTWO\nthree';
  const r = diff(a, b);
  const out = formatUnified(r, { aLabel: 'a', bLabel: 'b' });
  assert.ok(out.startsWith('--- a'));
  assert.ok(out.includes('@@'));
  assert.ok(out.includes('-two'));
  assert.ok(out.includes('+TWO'));
});

test('formatUnified is empty for identical text', () => {
  const r = diff('same\ntext', 'same\ntext');
  assert.equal(formatUnified(r), '');
});

test('formatJson is parseable with stats and ops', () => {
  const r = diff(A, B);
  const data = JSON.parse(formatJson(r));
  assert.equal(data.tool, 'diffwords');
  assert.ok(data.stats.added > 0);
  assert.ok(Array.isArray(data.ops));
  assert.ok(data.ops.some((o) => o.type === 'insert'));
});

test('formatHtml inline contains del/ins', () => {
  const r = diff(A, B);
  const html = formatHtml(r, { mode: 'inline' });
  assert.ok(html.includes('<del>'));
  assert.ok(html.includes('<ins>'));
  assert.ok(html.startsWith('<!doctype html>'));
});

test('formatHtml side-by-side contains a table', () => {
  const a = 'one\ntwo';
  const b = 'one\nTWO';
  const r = diff(a, b);
  const html = formatHtml(r, { mode: 'side' });
  assert.ok(html.includes('<table>'));
});

test('stripAnsi removes colour codes', () => {
  assert.equal(stripAnsi('\x1b[31mred\x1b[0m'), 'red');
});
