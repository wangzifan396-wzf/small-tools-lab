import { test } from 'node:test';
import assert from 'node:assert/strict';

import { displayWidth, stripTags } from '../src/core/text.js';
import { wrapText, rewrapLines, joinLines, greedyWrap, tokenize } from '../src/core/wrap.js';

test('joinLines never injects a space between CJK characters', () => {
  assert.equal(joinLines(['你好', '世界']), '你好世界');
  assert.equal(joinLines(['hello', 'world']), 'hello world');
  assert.equal(joinLines(['你好', 'world']), '你好 world'); // 盘古之白
  assert.equal(joinLines(['world', '你好']), 'world 你好');
});

test('joinLines skips blank lines', () => {
  assert.equal(joinLines(['你好', '', '世界']), '你好世界');
});

test('wrapText fits within the display width and round-trips', () => {
  const text = '这是一段用于测试自动换行功能是否正常工作的一段较长的中文句子';
  const lines = wrapText(text, { width: 8 });
  assert.ok(lines.length >= 1);
  for (const line of lines) {
    assert.ok(displayWidth(stripTags(line)) <= 8, `line "${line}" exceeds width`);
  }
  assert.equal(joinLines(lines), text);
});

test('wrapText returns a single line when it already fits', () => {
  const lines = wrapText('短短一句', { width: 40 });
  assert.equal(lines.length, 1);
  assert.equal(lines[0], '短短一句');
});

test('rewrapLines discards manual breaks and re-wraps', () => {
  const out = rewrapLines(['第一行比较长的文字', '第二行也比较长'], { width: 8 });
  assert.ok(Array.isArray(out));
  for (const line of out) assert.ok(displayWidth(stripTags(line)) <= 8);
});

test('tokenize breaks text into break-aware units', () => {
  const units = tokenize('hello world');
  assert.ok(units.length >= 2);
  const words = units.map((u) => u.text);
  assert.ok(words.includes('hello'));
  assert.ok(words.includes('world'));
});

test('greedyWrap respects kinsoku (no line may start with 。)', () => {
  const units = tokenize('这是一句话。这是第二句');
  const lines = greedyWrap(units, 6);
  for (let i = 1; i < lines.length; i += 1) {
    const first = lines[i].trimStart()[0];
    assert.notEqual(first, '。');
  }
});
