import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TIMESTAMP,
  createMonotonicFactory,
  decodeBase32,
  decodeUlid,
  encodeBase32,
  encodeRandom,
  encodeTime,
  generateUlid,
  isValidUlid,
  randomBytes,
} from '../src/index.js';

function fixedCrypto(values = [0]) {
  let position = 0;
  return { getRandomValues(array) { for (let index = 0; index < array.length; index += 1) array[index] = values[position++ % values.length]; return array; } };
}

test('matches the canonical Crockford Base32 alphabet behavior', () => {
  assert.equal(encodeBase32(31n, 2), '0Z');
  assert.equal(decodeBase32('0z'), 31n);
  assert.throws(() => decodeBase32('I'), /Invalid Crockford/);
  assert.throws(() => encodeBase32(32n, 1), /does not fit/);
});

test('encodes timestamp and 80-bit randomness fields exactly', () => {
  assert.equal(encodeTime(0), '0000000000');
  assert.equal(encodeTime(MAX_TIMESTAMP), '7ZZZZZZZZZ');
  assert.equal(encodeRandom(new Uint8Array(10)), '0000000000000000');
});

test('generates a deterministic spec-shaped ULID with injected crypto', () => {
  assert.equal(generateUlid(0, { cryptoSource: fixedCrypto([0]) }), '00000000000000000000000000');
  assert.equal(generateUlid(MAX_TIMESTAMP, { cryptoSource: fixedCrypto([255]) }), '7ZZZZZZZZZZZZZZZZZZZZZZZZZ');
});

test('decodes the canonical example and normalizes lowercase', () => {
  const decoded = decodeUlid('01arz3ndektsv4rrffq69g5fav');
  assert.equal(decoded.ulid, '01ARZ3NDEKTSV4RRFFQ69G5FAV');
  assert.equal(decoded.timestamp, 1469922850259);
  assert.match(decoded.randomnessHex, /^[0-9a-f]{20}$/u);
  assert.equal(decoded.time.getTime(), decoded.timestamp);
});

test('rejects timestamps outside the 48-bit range', () => {
  for (const value of [-1, MAX_TIMESTAMP + 1, 1.5, Number.NaN]) {
    assert.throws(() => generateUlid(value, { cryptoSource: fixedCrypto() }), /Timestamp/);
  }
});

test('rejects malformed and overflowing ULIDs', () => {
  assert.throws(() => decodeUlid('8' + '0'.repeat(25)), /48-bit/);
  assert.equal(isValidUlid('01ARZ3NDEKTSV4RRFFQ69G5FAV'), true);
  assert.equal(isValidUlid('01ARZ3NDEKTSV4RRFFQ69G5FAI'), false);
  assert.equal(isValidUlid('short'), false);
});

test('never falls back when secure randomness is unavailable', () => {
  assert.throws(() => randomBytes(10, null), /getRandomValues/);
  assert.throws(() => generateUlid(0, { cryptoSource: {} }), /getRandomValues/);
});

test('validates byte lengths and random field sizes', () => {
  assert.throws(() => randomBytes(0), /between 1 and 65536/);
  assert.throws(() => encodeRandom(new Uint8Array(9)), /exactly 10/);
});

test('monotonic factory increments randomness in the same millisecond', () => {
  const monotonic = createMonotonicFactory({ cryptoSource: fixedCrypto([0]) });
  const first = monotonic(1000);
  const second = monotonic(1000);
  assert.ok(first < second);
  assert.equal(decodeUlid(second).randomness, 1n);
});

test('monotonic factory remains ordered across clock rollback', () => {
  const monotonic = createMonotonicFactory({ cryptoSource: fixedCrypto([0]) });
  const first = monotonic(2000);
  const second = monotonic(1999);
  assert.ok(first < second);
  assert.equal(decodeUlid(second).timestamp, 2000);
});

test('default Node Web Crypto generates distinct valid ULIDs', () => {
  const values = Array.from({ length: 4 }, () => generateUlid());
  assert.equal(values.every(isValidUlid), true);
  assert.equal(new Set(values).size, values.length);
});
