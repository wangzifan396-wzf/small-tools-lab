import test from 'node:test';
import assert from 'node:assert/strict';
import { formatJson, minifyJson, parseJson, sortJsonKeys, validateJson } from '../src/index.js';

test('parseJson accepts every JSON top-level type', () => {
  assert.equal(parseJson('null'), null);
  assert.equal(parseJson('42'), 42);
  assert.deepEqual(parseJson('[true,"x"]'), [true, 'x']);
});

test('parseJson rejects empty and malformed input', () => {
  assert.throws(() => parseJson('  '), /empty/);
  assert.throws(() => parseJson('{bad}'), SyntaxError);
  assert.throws(() => parseJson(null), /string/);
});

test('formatJson pretty-prints with configurable indentation', () => {
  assert.equal(formatJson('{"a":1}'), '{\n  "a": 1\n}');
  assert.equal(formatJson('{"a":1}', { indent: '\t' }), '{\n\t"a": 1\n}');
  assert.equal(formatJson('{"a":1}', { finalNewline: true }).endsWith('\n'), true);
});

test('formatJson validates indentation boundaries', () => {
  assert.throws(() => formatJson('{}', { indent: 11 }), /0 to 10/);
  assert.throws(() => formatJson('{}', { indent: 1.5 }), /0 to 10/);
});

test('minifyJson removes insignificant whitespace', () => {
  assert.equal(minifyJson('{\n  "a": [1, 2]\n}'), '{"a":[1,2]}');
});

test('sortJsonKeys recursively sorts objects but preserves array order', () => {
  const sorted = sortJsonKeys({ z: 1, a: { y: 2, b: 3 }, list: [{ d: 1, c: 2 }] });
  assert.equal(JSON.stringify(sorted), '{"a":{"b":3,"y":2},"list":[{"c":2,"d":1}],"z":1}');
  assert.equal(formatJson('{"z":1,"a":2}', { sortKeys: true }), '{\n  "a": 2,\n  "z": 1\n}');
});

test('validateJson returns structured success and failure results', () => {
  assert.deepEqual(validateJson('{"ok":true}').value, { ok: true });
  const invalid = validateJson('{"ok": tru}');
  assert.equal(invalid.valid, false);
  assert.match(invalid.error, /JSON|token|expected/iu);
});
