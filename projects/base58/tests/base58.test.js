const test = require('node:test');
const assert = require('node:assert');
const B = require('../src/base58.js');

test('known vectors', () => {
  // "hello world" -> Bitcoin base58
  assert.strictEqual(B.encode(Array.from(new TextEncoder().encode('hello world'))), 'StV1DL6CwTryKyV');
  assert.strictEqual(B.encode([0, 0, 1]), '112');
  assert.strictEqual(B.decode('112').join(','), '0,0,1');
});

test('round trip random bytes', () => {
  for (let n = 0; n < 200; n++) {
    const len = 1 + (n * 7) % 40;
    const bytes = [];
    for (let i = 0; i < len; i++) bytes.push((n * 31 + i * 17) & 0xff);
    const s = B.encode(bytes);
    assert.deepStrictEqual(B.decode(s), bytes, `round trip failed for len ${len}`);
  }
});

test('leading zeros preserved', () => {
  assert.strictEqual(B.decode(B.encode([0, 0, 0, 5])).join(','), '0,0,0,5');
});

test('invalid char throws', () => {
  assert.throws(() => B.decode('0OIl'), /非法/);
});

test('empty input', () => {
  assert.strictEqual(B.encode([]), '');
  assert.deepStrictEqual(B.decode(''), []);
});
