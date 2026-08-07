const test = require('node:test');
const assert = require('node:assert');
const B = require('../src/base32.js');

const enc = (s, v) => B.encode(Array.from(new TextEncoder().encode(s)), v);
const dec = (s, v) => new TextDecoder().decode(new Uint8Array(B.decode(s, v)));

test('rfc4648 known vectors', () => {
  assert.strictEqual(enc(''), '');
  assert.strictEqual(enc('f'), 'MY======');
  assert.strictEqual(enc('fo'), 'MZXQ====');
  assert.strictEqual(enc('foo'), 'MZXW6===');
  assert.strictEqual(enc('foob'), 'MZXW6YQ=');
  assert.strictEqual(enc('fooba'), 'MZXW6YTB');
  assert.strictEqual(enc('foobar'), 'MZXW6YTBOI======');
});

test('rfc4648 round trip', () => {
  for (const s of ['', 'a', 'Hello, Base32!', '你好，世界', 'The quick brown fox']) {
    assert.strictEqual(dec(enc(s)), s, `round trip failed for ${JSON.stringify(s)}`);
  }
});

test('crockford round trip + ambiguous char normalization', () => {
  const s = 'Hello-Crockford!';
  const e = B.encode(new TextEncoder().encode(s), 'crockford');
  assert.strictEqual(dec(e, 'crockford'), s);
  // lowercase, hyphen, I/L->1, O->0 are all accepted and equivalent
  const norm = e.toLowerCase().replace(/1/g, 'I').replace(/0/g, 'O');
  assert.strictEqual(B.decode(norm, 'crockford').join(','), B.decode(e, 'crockford').join(','));
});

test('invalid char throws (rfc)', () => {
  assert.throws(() => B.decode('0189'), /非法/);
});

test('empty input', () => {
  assert.strictEqual(B.encode([]), '');
  assert.deepStrictEqual(B.decode(''), []);
});
