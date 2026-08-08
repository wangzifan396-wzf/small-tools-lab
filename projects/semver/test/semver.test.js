import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, formatVersion, isValidVersion, parseVersion, satisfies, sortVersions } from '../src/index.js';

test('parses strict SemVer 2.0 versions and an optional v prefix', () => {
  assert.deepEqual(parseVersion('v1.2.3-rc.1+linux.x64'), {
    major: '1', minor: '2', patch: '3', prerelease: ['rc', '1'], build: ['linux', 'x64'],
  });
  assert.equal(formatVersion('v1.2.3+build.7'), '1.2.3+build.7');
});

test('rejects leading zeros and malformed identifiers', () => {
  for (const version of ['01.2.3', '1.02.3', '1.2.03', '1.2.3-01', '1.2', '1.2.3-', '1.2.3+']) {
    assert.equal(isValidVersion(version), false, version);
  }
});

test('compares the SemVer specification prerelease example', () => {
  const ordered = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0'];
  assert.deepEqual(sortVersions([...ordered].reverse()), ordered);
});

test('ignores build metadata for precedence', () => {
  assert.equal(compareVersions('1.2.3+one', '1.2.3+two'), 0);
});

test('compares huge numeric identifiers without precision loss', () => {
  assert.equal(compareVersions('99999999999999999999.0.0', '100000000000000000000.0.0'), -1);
  assert.equal(compareVersions('1.0.0-99999999999999999999', '1.0.0-100000000000000000000'), -1);
});

test('sortVersions is non-mutating and supports descending order', () => {
  const input = ['2.0.0', '1.0.0'];
  assert.deepEqual(sortVersions(input, { descending: true }), ['2.0.0', '1.0.0']);
  assert.deepEqual(input, ['2.0.0', '1.0.0']);
});

test('supports exact, comparator, AND, and OR ranges', () => {
  assert.equal(satisfies('1.2.3', '1.2.3'), true);
  assert.equal(satisfies('1.5.0', '>=1.0.0 <2.0.0'), true);
  assert.equal(satisfies('2.1.0', '<1.0.0 || >=2.0.0'), true);
  assert.equal(satisfies('1.0.0', '>1.0.0'), false);
});

test('supports caret ranges around zero correctly', () => {
  assert.equal(satisfies('1.9.9', '^1.2.3'), true);
  assert.equal(satisfies('2.0.0', '^1.2.3'), false);
  assert.equal(satisfies('0.2.9', '^0.2.3'), true);
  assert.equal(satisfies('0.3.0', '^0.2.3'), false);
  assert.equal(satisfies('0.0.4', '^0.0.3'), false);
});

test('supports tilde, missing components, and wildcard ranges', () => {
  assert.equal(satisfies('1.2.9', '~1.2.3'), true);
  assert.equal(satisfies('1.3.0', '~1.2.3'), false);
  assert.equal(satisfies('1.8.0', '1'), true);
  assert.equal(satisfies('1.2.7', '1.2.x'), true);
  assert.equal(satisfies('1.3.0', '1.2'), false);
});

test('supports partial comparators and hyphen ranges', () => {
  assert.equal(satisfies('1.9.0', '>1'), false);
  assert.equal(satisfies('2.0.0', '>1'), true);
  assert.equal(satisfies('1.2.9', '1.2.3 - 1.2'), true);
  assert.equal(satisfies('1.3.0', '1.2.3 - 1.2'), false);
});

test('excludes prereleases unless a comparator opts into the same core version', () => {
  assert.equal(satisfies('1.3.0-beta.1', '>=1.2.0 <2.0.0'), false);
  assert.equal(satisfies('1.3.0-beta.2', '>=1.3.0-beta.1 <2.0.0'), true);
  assert.equal(satisfies('1.4.0-beta.1', '>=1.3.0-beta.1 <2.0.0'), false);
  assert.equal(satisfies('1.0.0-alpha', '*'), false);
});

test('rejects invalid versions and range syntax clearly', () => {
  assert.throws(() => parseVersion('1.2'), /Invalid SemVer/);
  assert.throws(() => satisfies('1.2.3', '1.x.3'), /wildcard/);
  assert.throws(() => satisfies('1.2.3', 'wat'), /range token/);
  assert.throws(() => satisfies('1.2.3', '1.x ||'), /cannot be empty/);
});
