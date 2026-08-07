import test from 'node:test';
import assert from 'node:assert/strict';
import { generateUuids, isUuidV4, uuidV4 } from '../src/index.js';

function fixedCrypto(fill = 0) {
  return {
    getRandomValues(array) {
      array.fill(fill);
      return array;
    },
  };
}

test('uuidV4 sets RFC version and variant bits', () => {
  assert.equal(uuidV4({ cryptoSource: fixedCrypto(0) }), '00000000-0000-4000-8000-000000000000');
  assert.equal(uuidV4({ cryptoSource: fixedCrypto(255) }), 'ffffffff-ffff-4fff-bfff-ffffffffffff');
});

test('uuidV4 requires cryptographically secure randomness', () => {
  assert.throws(() => uuidV4({ cryptoSource: {} }), /getRandomValues/);
  assert.throws(() => uuidV4({ cryptoSource: null }), /getRandomValues/);
});

test('generateUuids applies compact and uppercase formatting', () => {
  assert.deepEqual(generateUuids(2, { cryptoSource: fixedCrypto(1), dashes: false, uppercase: true }), [
    '01010101010141018101010101010101',
    '01010101010141018101010101010101',
  ]);
});

test('generateUuids validates count boundaries', () => {
  for (const count of [0, 201, 1.5, Number.NaN]) {
    assert.throws(() => generateUuids(count, { cryptoSource: fixedCrypto() }), /between 1 and 200/);
  }
});

test('generateUuids validates boolean format options', () => {
  assert.throws(() => generateUuids(1, { cryptoSource: fixedCrypto(), dashes: 'yes' }), /booleans/);
});

test('isUuidV4 accepts dashed and compact values in either case', () => {
  assert.equal(isUuidV4('00000000-0000-4000-8000-000000000000'), true);
  assert.equal(isUuidV4('FFFFFFFFFFFF4FFFBFFFFFFFFFFFFFFF'), true);
});

test('isUuidV4 rejects wrong versions, variants, and malformed values', () => {
  assert.equal(isUuidV4('00000000-0000-1000-8000-000000000000'), false);
  assert.equal(isUuidV4('00000000-0000-4000-7000-000000000000'), false);
  assert.equal(isUuidV4('not-a-uuid'), false);
  assert.equal(isUuidV4(null), false);
});

test('default crypto source produces valid UUIDs in Node.js 20+', () => {
  const values = generateUuids(4);
  assert.equal(values.every(isUuidV4), true);
  assert.equal(new Set(values).size, values.length);
});
