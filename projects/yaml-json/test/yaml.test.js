import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScalar, parseYaml, stringifyScalar, stringifyYaml } from '../src/index.js';

test('parses nested mappings, sequences, and sequence mappings', () => {
  const value = parseYaml('server:\n  port: 8080\n  flags: [fast, true]\nusers:\n  - name: Ada\n    roles:\n      - admin\n      - author\n');
  assert.deepEqual({ ...value.server }, { port: 8080, flags: ['fast', true] });
  assert.equal(value.users[0].name, 'Ada');
  assert.deepEqual(value.users[0].roles, ['admin', 'author']);
});

test('parses flow maps safely with quoted strings and comments', () => {
  const value = parseYaml('config: {name: "a # b", enabled: true}\nempty: {} # comment\n');
  assert.equal(value.config.name, 'a # b');
  assert.equal(value.config.enabled, true);
  assert.deepEqual({ ...value.empty }, {});
});

test('parses primitive scalars and single quote escaping', () => {
  assert.equal(parseScalar("'it''s fine'"), "it's fine");
  assert.deepEqual(parseScalar('[null, -2.5e2, false]'), [null, -250, false]);
});

test('returns null for an empty or comment-only document', () => {
  assert.equal(parseYaml('  # nothing\n\n'), null);
});

test('uses null-prototype mappings so __proto__ is data, not mutation', () => {
  const value = parseYaml('__proto__: safe\nconstructor: data\n');
  assert.equal(Object.getPrototypeOf(value), null);
  assert.equal(value.__proto__, 'safe');
  assert.equal(value.constructor, 'data');
  assert.equal({}.safe, undefined);
});

test('rejects duplicate keys in block and flow mappings', () => {
  assert.throws(() => parseYaml('a: 1\na: 2'), /Line 2: duplicate key/);
  assert.throws(() => parseYaml('a: {x: 1, x: 2}'), /Line 1: duplicate key/);
});

test('rejects tabs, odd indentation, and indentation jumps with line numbers', () => {
  assert.throws(() => parseYaml('a:\n\tb: 1'), /Line 2: tabs/);
  assert.throws(() => parseYaml('a:\n b: 1'), /Line 2: indentation/);
  assert.throws(() => parseYaml('a:\n    b: 1'), /Line 2: nested content/);
});

test('rejects malformed mappings and mixed collection types', () => {
  assert.throws(() => parseYaml('a: 1\nmissing value'), /Line 2: mapping entry/);
  assert.throws(() => parseYaml('a: 1\n- b'), /cannot mix/);
});

test('explicitly rejects unsupported YAML features', () => {
  for (const source of ['a: &base 1', 'a: *base', 'a: !tag value', 'a: |', 'a: >-', '---\na: 1']) {
    assert.throws(() => parseYaml(source), /not supported/);
  }
});

test('stringifies JSON-like values and round-trips them', () => {
  const input = { name: 'Small Tools', enabled: true, values: [1, null, { text: 'a: b' }] };
  const output = stringifyYaml(input);
  const parsed = parseYaml(output);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), input);
  assert.match(output, /"a: b"/);
});

test('quotes ambiguous strings while leaving safe text readable', () => {
  assert.equal(stringifyScalar('true'), '"true"');
  assert.equal(stringifyScalar('12'), '"12"');
  assert.equal(stringifyScalar('hello world'), 'hello world');
});

test('serializes empty collections', () => {
  const output = stringifyYaml({ list: [], map: {} });
  assert.equal(output, 'list:\n  []\nmap:\n  {}\n');
  assert.deepEqual(JSON.parse(JSON.stringify(parseYaml(output))), { list: [], map: {} });
});

test('supports root scalars and escaped backslashes in quoted strings', () => {
  assert.equal(parseYaml('true'), true);
  assert.equal(parseYaml('"C:\\\\tools"'), 'C:\\tools');
});

test('rejects cyclic, unsupported, and non-finite values', () => {
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => stringifyYaml(cyclic), /cyclic/);
  assert.throws(() => stringifyYaml({ value: Infinity }), /non-finite/);
  assert.throws(() => stringifyYaml({ value: undefined }), /undefined/);
  assert.throws(() => stringifyYaml(new Date()), /plain objects/);
});
