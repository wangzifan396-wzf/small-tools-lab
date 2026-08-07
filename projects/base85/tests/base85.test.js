const test = require('node:test');
const assert = require('node:assert');
const B = require('../src/base85.js');

const enc = (s) => Array.from(new TextEncoder().encode(s));

test('alphabets are 85 chars', () => {
  // sanity: encode/decode use 85-symbol alphabets
  assert.strictEqual(B.ascii85.encode(enc('')), '');
  assert.strictEqual(B.z85.encode(enc('')), '');
});

test('ascii85 round trip', () => {
  for (const s of ['a', 'M', 'Man', 'Manx', 'Hello, Base85!', 'The quick brown fox jumps', '你好，世界']) {
    const bytes = enc(s);
    const e = B.ascii85.encode(bytes);
    const d = new TextDecoder().decode(new Uint8Array(B.ascii85.decode(e)));
    assert.strictEqual(d, s, `ascii85 round trip failed for ${JSON.stringify(s)}`);
  }
});

test('z85 round trip', () => {
  for (const s of ['a', 'M', 'Man', 'Manx', 'Hello, Base85!', 'ZeroMQ frames', '你好，世界']) {
    const bytes = enc(s);
    const e = B.z85.encode(bytes);
    const d = new TextDecoder().decode(new Uint8Array(B.z85.decode(e)));
    assert.strictEqual(d, s, `z85 round trip failed for ${JSON.stringify(s)}`);
  }
});

test('ascii85 z shortcut for all-zero block', () => {
  assert.strictEqual(B.ascii85.encode([0, 0, 0, 0]), 'z');
  assert.deepStrictEqual(B.ascii85.decode('z'), [0, 0, 0, 0]);
});

test('invalid char throws', () => {
  assert.throws(() => B.ascii85.decode('hello world'), /非法/); // space is not in Ascii85 alphabet
  assert.throws(() => B.z85.decode(' '), /非法/);
});
