import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  displayWidth,
  stripTags,
  hasMarkup,
  mapOutsideMarkup,
  analyzeScript,
  readingTime,
  readingPressure,
  charsPerSecond,
  addCjkLatinSpacing,
  normalizeCjkPunctuation,
  normalizeFullwidthLatin,
  normalizeEllipsis,
  hasFullwidthLatin,
  isCjkChar,
  endsWithPeriod,
  stripTrailingPeriod,
  NO_LINE_START,
  NO_LINE_END,
} from '../src/core/text.js';

test('displayWidth counts CJK as double and ignores combining marks', () => {
  assert.equal(displayWidth('ab'), 2);
  assert.equal(displayWidth('中文'), 4);
  assert.equal(displayWidth('a中'), 3);
  assert.equal(displayWidth(''), 0);
});

test('stripTags removes HTML and ASS markup', () => {
  assert.equal(stripTags('<i>hi</i> there'), 'hi there');
  assert.equal(stripTags('{\\an8}hi'), 'hi');
  assert.equal(stripTags('line\\Nbreak'), 'line\nbreak');
  assert.equal(stripTags('a &amp; b'), 'a & b');
});

test('hasMarkup detects markup', () => {
  assert.equal(hasMarkup('<b>x</b>'), true);
  assert.equal(hasMarkup('{\\an8}x'), true);
  assert.equal(hasMarkup('plain text'), false);
});

test('analyzeScript classifies dominant script', () => {
  assert.equal(analyzeScript('你好世界').dominant, 'cjk');
  assert.equal(analyzeScript('hello world').dominant, 'latin');
  assert.equal(analyzeScript('你好abc').dominant, 'mixed');
  const profile = analyzeScript('你好world');
  assert.equal(profile.cjk, 2);
  assert.equal(profile.latin, 5);
});

test('readingTime uses separate CJK/Latin budgets', () => {
  // 2 CJK chars at 9 cjk/s -> ~222ms
  assert.equal(readingTime('你好', { cjkCps: 9, latinCps: 20 }), 222);
  const fast = readingTime('这是一句很长的测试文本', { cjkCps: 9, latinCps: 20 });
  assert.ok(fast > 1000);
});

test('readingPressure and charsPerSecond', () => {
  // 222ms of reading shown for 111ms -> ~2x pressure
  assert.ok(readingPressure('你好', 111, { cjkCps: 9, latinCps: 20 }) > 1.5);
  assert.equal(charsPerSecond('ab', 1000), 2);
});

test('addCjkLatinSpacing inserts the 盘古之白 and is idempotent', () => {
  assert.equal(addCjkLatinSpacing('你好world'), '你好 world');
  assert.equal(addCjkLatinSpacing('你好 world'), '你好 world');
  assert.equal(addCjkLatinSpacing('hello世界'), 'hello 世界');
});

test('normalizeCjkPunctuation widens punctuation but spares 1.5 and e.g.', () => {
  assert.equal(normalizeCjkPunctuation('你好,世界'), '你好，世界');
  assert.equal(normalizeCjkPunctuation('1.5'), '1.5');
  assert.equal(normalizeCjkPunctuation('e.g. foo'), 'e.g. foo');
  assert.equal(normalizeCjkPunctuation('他说:好'), '他说：好');
});

test('normalizeFullwidthLatin reverts IME slips', () => {
  assert.equal(normalizeFullwidthLatin('ＡＢ１２'), 'AB12');
  assert.equal(hasFullwidthLatin('Ａ'), true);
  assert.equal(hasFullwidthLatin('A'), false);
});

test('normalizeEllipsis collapses runs', () => {
  assert.equal(normalizeEllipsis('...'), '…');
  assert.equal(normalizeEllipsis('。。。。'), '……');
});

test('isCjkChar / endsWithPeriod / stripTrailingPeriod', () => {
  assert.equal(isCjkChar('你'), true);
  assert.equal(isCjkChar('a'), false);
  assert.equal(endsWithPeriod('你好。'), true);
  assert.equal(endsWithPeriod('你好'), false);
  assert.equal(endsWithPeriod('你好...'), false);
  assert.equal(stripTrailingPeriod('你好。'), '你好');
});

test('mapOutsideMarkup applies the transform without touching tags', () => {
  assert.equal(mapOutsideMarkup('<i>你好world</i>', addCjkLatinSpacing), '<i>你好 world</i>');
});

test('NO_LINE_START / NO_LINE_END lists punctuation', () => {
  assert.ok(NO_LINE_START.includes('。'));
  assert.ok(NO_LINE_END.includes('（'));
});
