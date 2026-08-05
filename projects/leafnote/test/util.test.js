import test from 'node:test';
import assert from 'node:assert/strict';
import { uid, escapeHtml, normalizeTitle, debounce, titleFromBody } from '../src/util.js';

test('uid returns a non-empty string', () => {
  assert.equal(typeof uid(), 'string');
  assert.notEqual(uid(), uid());
});

test('escapeHtml escapes the dangerous chars', () => {
  assert.equal(escapeHtml('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
});

test('normalizeTitle lowercases and collapses spaces', () => {
  assert.equal(normalizeTitle('  Hello   World '), 'hello world');
});

test('titleFromBody derives a title from the first heading', () => {
  assert.equal(titleFromBody('# My Note\nbody'), 'My Note');
  assert.equal(titleFromBody('just text'), 'just text');
  assert.equal(titleFromBody(''), 'Untitled');
});

test('debounce collapses rapid calls', async () => {
  let count = 0;
  const fn = debounce(() => { count += 1; }, 20);
  fn(); fn(); fn();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(count, 1);
});
