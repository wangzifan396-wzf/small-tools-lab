import test from 'node:test';
import assert from 'node:assert/strict';
import { hashText, hmacText, encode, decode, verify, hashBytes } from '../src/index.js';

test('sha256 of "abc" matches the NIST vector', async () => {
  assert.equal(
    await hashText('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('sha1 of empty string', async () => {
  assert.equal(await hashText('', 'sha1'), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
});

test('sha512 of "abc" matches the NIST vector', async () => {
  assert.equal(
    await hashText('abc', 'sha512'),
    'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
    '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'
  );
});

test('unsupported algorithm throws', async () => {
  await assert.rejects(() => hashText('x', 'md5'), /unsupported algorithm/);
});

test('hmac-sha256 matches RFC 4231 test case 1', async () => {
  const out = await hmacText('what do ya want for nothing?', 'Jefe', 'sha256');
  assert.equal(out, '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
});

test('base64 round-trips', () => {
  const enc = encode('hello, 世界', 'base64');
  assert.equal(decode(enc, 'base64'), 'hello, 世界');
});

test('hex round-trips', () => {
  const enc = encode('AB', 'hex');
  assert.equal(enc, '4142');
  assert.equal(decode(enc, 'hex'), 'AB');
});

test('verify is case/whitespace insensitive', () => {
  assert.equal(verify('BA78 16BF', 'ba7816bf'), true);
  assert.equal(verify('deadbeef', 'cafe'), false);
});

test('hashBytes matches hashText for equal input', async () => {
  const text = await hashText('ping');
  const bytes = await hashBytes(new TextEncoder().encode('ping'));
  assert.equal(text, bytes);
});
