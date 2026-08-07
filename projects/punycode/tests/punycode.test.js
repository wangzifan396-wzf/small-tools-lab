const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/punycode.js');

test('label encode/decode round trip', () => {
  assert.strictEqual(P.decode(P.encode('mañana')), 'mañana');
  assert.strictEqual(P.decode('maana-pta'), 'mañana');
  assert.strictEqual(P.encode('mañana'), 'maana-pta');
  assert.strictEqual(P.decode(P.encode('日本語')), '日本語');
  assert.strictEqual(P.decode(P.encode('München')), 'München');
});

test('domain toASCII / toUnicode', () => {
  assert.strictEqual(P.toASCII('例子.中国'), 'xn--fsqu00a.xn--fiqs8s');
  assert.strictEqual(P.toUnicode('xn--fsqu00a.xn--fiqs8s'), '例子.中国');
  // ASCII-only domain passes through unchanged
  assert.strictEqual(P.toASCII('example.com'), 'example.com');
  assert.strictEqual(P.toUnicode('example.com'), 'example.com');
});

test('emoji domain', () => {
  const d = '☃.net';
  const a = P.toASCII(d);
  assert.strictEqual(a.indexOf('xn--'), 0);
  assert.strictEqual(P.toUnicode(a), d);
});

test('mixed domain', () => {
  const d = '中文.example.com';
  const a = P.toASCII(d);
  assert.strictEqual(a, 'xn--fiq228c.example.com');
  assert.strictEqual(P.toUnicode(a), d);
});
