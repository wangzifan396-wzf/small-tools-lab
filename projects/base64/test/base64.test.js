import test from 'node:test';
import assert from 'node:assert/strict';
import { base64ToBytes, bytesToBase64, decodeBase64, encodeBase64, normalizeBase64, utf8ToBytes } from '../src/index.js';

test('encodes and decodes ASCII', () => {
  assert.equal(encodeBase64('hello'), 'aGVsbG8=');
  assert.equal(decodeBase64('aGVsbG8='), 'hello');
});

test('round-trips CJK and emoji as UTF-8', () => {
  const value = '你好，世界 😀';
  assert.equal(decodeBase64(encodeBase64(value)), value);
});

test('supports empty input and whitespace around encoded text', () => {
  assert.equal(encodeBase64(''), '');
  assert.equal(decodeBase64(' aG Vs\nbG8= '), 'hello');
});

test('supports Base64URL with optional padding', () => {
  const encoded = encodeBase64('subjects?_d', { urlSafe: true, padding: false });
  assert.doesNotMatch(encoded, /[+/=]/u);
  assert.equal(decodeBase64(encoded), 'subjects?_d');
});

test('normalizes unpadded input and rejects malformed padding', () => {
  assert.equal(normalizeBase64('aGVsbG8'), 'aGVsbG8=');
  assert.throws(() => normalizeBase64('a==='), /Invalid/);
  assert.throws(() => normalizeBase64('abcde'), /Invalid/);
});

test('can reject URL-safe alphabet explicitly', () => {
  assert.throws(() => normalizeBase64('SGVsbG8_', { urlSafe: false }), /not allowed/);
});

test('byte helpers preserve arbitrary binary', () => {
  const bytes = Uint8Array.from([0, 1, 127, 128, 255]);
  assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
  assert.deepEqual(utf8ToBytes('A'), Uint8Array.of(65));
});

test('decode rejects bytes that are not valid UTF-8', () => {
  assert.throws(() => decodeBase64('/w=='), /valid UTF-8/);
  assert.throws(() => decodeBase64('not@base64'), /Invalid/);
});
