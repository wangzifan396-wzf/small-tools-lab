import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, parseBytes } from '../src/core/bytes.js';

test('formatBytes: zero and small', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
});

test('formatBytes: binary (default)', () => {
  assert.equal(formatBytes(1024), '1 KiB');
  assert.equal(formatBytes(1536), '1.5 KiB');
  assert.equal(formatBytes(1048576), '1 MiB');
});

test('formatBytes: decimal (--si)', () => {
  assert.equal(formatBytes(1000, { binary: false }), '1 kB');
  assert.equal(formatBytes(1500000, { binary: false }), '1.5 MB');
});

test('formatBytes: decimals and locale', () => {
  assert.equal(formatBytes(1536, { decimals: 2, trimZero: false }), '1.50 KiB');
  assert.equal(formatBytes(1536, { locale: 'de-DE' }), '1,5 KiB');
});

test('formatBytes: rejects invalid input', () => {
  assert.throws(() => formatBytes(-1), RangeError);
  assert.throws(() => formatBytes('abc'), TypeError);
});

test('parseBytes: round-trips formatBytes', () => {
  assert.equal(parseBytes('1.5 KiB'), 1536);
  assert.equal(parseBytes('1 MB'), 1e6);
  assert.equal(parseBytes('1 kB'), 1000);
  assert.equal(parseBytes('512'), 512);
});

test('parseBytes: accepts a number', () => {
  assert.equal(parseBytes(2048), 2048);
});

test('parseBytes: rejects garbage', () => {
  assert.throws(() => parseBytes('nonsense'), /cannot parse/);
  assert.throws(() => parseBytes('10 zz'), /unknown unit/);
});
