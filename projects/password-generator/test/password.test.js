import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterSets, classifyEntropy, estimateEntropy, generatePassword, generatePasswords, randomInt } from '../src/index.js';

function sequenceCrypto(values) {
  let position = 0;
  return {
    getRandomValues(array) {
      for (let index = 0; index < array.length; index += 1) {
        array[index] = values[position % values.length];
        position += 1;
      }
      return array;
    },
  };
}

test('randomInt uses rejection sampling instead of modulo-biased values', () => {
  const cryptoSource = sequenceCrypto([0xffffffff, 7]);
  assert.equal(randomInt(10, cryptoSource), 7);
});

test('randomInt validates its bound and secure source', () => {
  for (const bound of [0, -1, 1.5, 0x1_0000_0001]) assert.throws(() => randomInt(bound), /maxExclusive/);
  assert.throws(() => randomInt(10, {}), /getRandomValues/);
  assert.throws(() => randomInt(10, null), /getRandomValues/);
});

test('buildCharacterSets applies switches and ambiguous-character filtering', () => {
  const sets = buildCharacterSets({ uppercase: false, digits: false, symbols: false, excludeAmbiguous: true });
  assert.deepEqual(sets.map((set) => set.name), ['lowercase']);
  assert.doesNotMatch(sets[0].characters, /[lI10O]/u);
});

test('buildCharacterSets rejects no selected sets and non-boolean switches', () => {
  assert.throws(() => buildCharacterSets({ lowercase: false, uppercase: false, digits: false, symbols: false }), /At least one/);
  assert.throws(() => buildCharacterSets({ digits: 'yes' }), /boolean/);
});

test('generatePassword guarantees every selected character class', () => {
  const password = generatePassword(16, { cryptoSource: sequenceCrypto([0, 1, 2, 3, 4, 5]) });
  assert.match(password, /[a-z]/u);
  assert.match(password, /[A-Z]/u);
  assert.match(password, /[0-9]/u);
  assert.match(password, /[!@#$%^&*()\-_=+\[\]{};:,.<>?]/u);
  assert.equal(password.length, 16);
});

test('generatePassword honors excluded ambiguous characters', () => {
  const password = generatePassword(64, { excludeAmbiguous: true, cryptoSource: sequenceCrypto([0, 10, 20, 30, 40, 50]) });
  assert.doesNotMatch(password, /[0O1lI|`'"]/u);
});

test('generatePassword validates length and per-set guarantees', () => {
  assert.throws(() => generatePassword(3, { cryptoSource: sequenceCrypto([0]) }), /between 4 and 1024/);
  assert.throws(() => generatePassword(4.5, { cryptoSource: sequenceCrypto([0]) }), /between 4 and 1024/);
});

test('generatePasswords validates count and produces the requested amount', () => {
  const values = generatePasswords(3, { length: 12, cryptoSource: sequenceCrypto([0, 1, 2, 3, 4]) });
  assert.equal(values.length, 3);
  assert.equal(values.every((value) => value.length === 12), true);
  for (const count of [0, 101, 1.5]) assert.throws(() => generatePasswords(count), /between 1 and 100/);
});

test('estimateEntropy reflects length and selected pool size', () => {
  assert.equal(estimateEntropy(10, { uppercase: false, digits: false, symbols: false }), 10 * Math.log2(26));
  assert.ok(estimateEntropy(20) > estimateEntropy(10));
});

test('classifyEntropy uses documented boundaries', () => {
  assert.equal(classifyEntropy(39.9), 'weak');
  assert.equal(classifyEntropy(40), 'fair');
  assert.equal(classifyEntropy(64), 'strong');
  assert.equal(classifyEntropy(100), 'very-strong');
  assert.throws(() => classifyEntropy(Infinity), /finite/);
});

test('the default Node.js crypto source generates distinct passwords', () => {
  const values = generatePasswords(4, { length: 24 });
  assert.equal(new Set(values).size, values.length);
});
