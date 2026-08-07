import test from 'node:test';
import assert from 'node:assert/strict';
import { countText, formatReadingTime } from '../src/index.js';

test('countText returns zeroed statistics for empty text', () => {
  assert.deepEqual(countText(''), {
    characters: 0, charactersNoWhitespace: 0, hanCharacters: 0, latinWords: 0,
    lines: 0, paragraphs: 0, sentences: 0, readingSeconds: 0, readingLabel: '0 秒',
  });
});

test('countText returns Unicode code-point character counts', () => {
  const result = countText('A😀中');
  assert.equal(result.characters, 3);
  assert.equal(result.charactersNoWhitespace, 3);
  assert.equal(result.hanCharacters, 1);
});

test('countText recognizes Latin words, apostrophes, hyphens, and numbers', () => {
  const result = countText("你好, don't stop state-of-the-art 2026.");
  assert.equal(result.hanCharacters, 2);
  assert.equal(result.latinWords, 4);
});

test('countText handles line endings and blank-line paragraphs', () => {
  assert.equal(countText('a\r\nb\rc\nd').lines, 4);
  assert.equal(countText('first\ncontinued\n\nsecond').paragraphs, 2);
  assert.equal(countText('  \n\n ').paragraphs, 0);
});

test('countText counts Chinese and Latin sentence terminators', () => {
  assert.equal(countText('第一句。第二句！Third? Fourth.').sentences, 4);
  assert.equal(countText('A sentence without punctuation').sentences, 1);
});

test('countText estimates reading time from Han characters and Latin words', () => {
  const result = countText(`${'中'.repeat(300)} ${Array(200).fill('word').join(' ')}`);
  assert.equal(result.readingSeconds, 120);
  assert.equal(result.readingLabel, '2 分钟');
});

test('countText rejects non-string input', () => {
  assert.throws(() => countText(null), /string/);
});

test('formatReadingTime formats seconds, minutes, and hours', () => {
  assert.equal(formatReadingTime(45), '45 秒');
  assert.equal(formatReadingTime(90), '1.5 分钟');
  assert.equal(formatReadingTime(3720), '1 小时 2 分钟');
  assert.throws(() => formatReadingTime(-1), /non-negative/);
});
