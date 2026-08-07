import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDelimiter, parseCsv, csvEscape, csvToData, csvToJson, jsonToCsv } from '../src/index.js';

test('detectDelimiter ignores candidates inside quoted headers', () => {
  assert.equal(detectDelimiter('"last, first";age\nDoe;30'), ';');
  assert.equal(detectDelimiter('name\tage\nAlice\t30'), '\t');
});

test('parseCsv handles quoted delimiters, quotes, and embedded newlines', () => {
  const rows = parseCsv('name,note\nAlice,"likes ""code"", coffee"\nBob,"two\nlines"');
  assert.deepEqual(rows, [['name', 'note'], ['Alice', 'likes "code", coffee'], ['Bob', 'two\nlines']]);
});

test('parseCsv handles BOM, CRLF, trailing empty fields, and no phantom row', () => {
  assert.deepEqual(parseCsv('\ufeffa,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,b,'), [['a', 'b', '']]);
  assert.deepEqual(parseCsv(''), []);
});

test('parseCsv rejects malformed quoting', () => {
  assert.throws(() => parseCsv('a,"unfinished'), /Unterminated/);
  assert.throws(() => parseCsv('a,b"ad'), /Unexpected quote/);
  assert.throws(() => parseCsv('a,"ok"x'), /after closing quote/);
  assert.throws(() => parseCsv('a,b', '😀'), /one character/);
});

test('csvEscape follows CSV quoting rules', () => {
  assert.equal(csvEscape('plain'), 'plain');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape(null), '');
});

test('csvToData creates records with auto-detected headers', () => {
  const result = csvToData('name;age\nAlice;30', { delimiter: 'auto' });
  assert.equal(result.delimiter, ';');
  assert.deepEqual({ ...result.data[0] }, { name: 'Alice', age: '30' });
});

test('csvToData can retain row arrays and blank rows', () => {
  const result = csvToData('a,b\n\n1,2', { header: false, skipBlankRows: false });
  assert.deepEqual(result.data, [['a', 'b'], [''], ['1', '2']]);
});

test('csvToData rejects headers or rows that would silently lose data', () => {
  assert.throws(() => csvToData('name,name\na,b'), /unique/);
  assert.throws(() => csvToData('name,age\nAlice'), /expected 2/);
  assert.throws(() => csvToData(',age\nAlice,30'), /cannot be empty/);
});

test('csvToJson returns formatted JSON', () => {
  assert.equal(csvToJson('name,age\nAlice,30'), '[\n  {\n    "name": "Alice",\n    "age": "30"\n  }\n]');
});

test('jsonToCsv unions object keys and escapes nested values', () => {
  const csv = jsonToCsv([{ name: 'Alice', note: 'a,b' }, { name: 'Bob', extra: { ok: true } }]);
  assert.equal(csv, 'name,note,extra\nAlice,"a,b",\nBob,,"{""ok"":true}"');
});

test('jsonToCsv supports two-dimensional and primitive arrays', () => {
  assert.equal(jsonToCsv([[1, 'a,b'], [2, 'c']]), '1,"a,b"\n2,c');
  assert.equal(jsonToCsv(['a', 'b']), 'a\nb');
});

test('jsonToCsv rejects mixed structural shapes', () => {
  assert.throws(() => jsonToCsv([[1], { a: 2 }]), /cannot mix rows/);
  assert.throws(() => jsonToCsv([{ a: 1 }, 2]), /cannot mix objects/);
});

test('object data survives a JSON to CSV to JSON round trip', () => {
  const csv = jsonToCsv([{ name: 'Alice', note: 'line 1\nline 2' }]);
  assert.deepEqual(JSON.parse(csvToJson(csv)), [{ name: 'Alice', note: 'line 1\nline 2' }]);
});
