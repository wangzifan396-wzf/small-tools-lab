import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, untokenize, isCjk } from '../src/core/tokenize.js';

test('tokenize splits Latin into words and spaces', () => {
  const t = tokenize('hello world');
  assert.equal(t.length, 3);
  assert.equal(t[0].value, 'hello');
  assert.equal(t[0].type, 'word');
  assert.equal(t[1].value, ' ');
  assert.equal(t[1].type, 'space');
  assert.equal(t[2].value, 'world');
});

test('tokenize treats each CJK character as its own token', () => {
  const t = tokenize('你好');
  assert.equal(t.length, 2);
  assert.equal(t[0].value, '你');
  assert.equal(t[0].type, 'cjk');
  assert.equal(t[1].value, '好');
});

test('tokenize keeps mixed-script boundaries', () => {
  const t = tokenize('模型 model');
  assert.deepEqual(
    t.map((x) => x.value),
    ['模', '型', ' ', 'model'],
  );
  assert.equal(t[0].type, 'cjk');
  assert.equal(t[2].type, 'space');
  assert.equal(t[3].type, 'word');
});

test('tokenize preserves punctuation as individual tokens', () => {
  const t = tokenize('hi, there!');
  assert.equal(t[1].value, ',');
  assert.equal(t[1].type, 'punct');
  assert.equal(t[4].value, '!');
  assert.equal(t[4].type, 'punct');
});

test('isCjk recognises CJK ranges', () => {
  assert.ok(isCjk('中'));
  assert.ok(isCjk('あ'));
  assert.ok(isCjk('가'));
  assert.equal(isCjk('a'), false);
});

test('untokenize round-trips the original text', () => {
  const text = '模型 model と 日本語 (test) 123';
  assert.equal(untokenize(tokenize(text)), text);
});
