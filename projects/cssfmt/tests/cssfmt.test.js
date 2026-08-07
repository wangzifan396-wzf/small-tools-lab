const test = require('node:test');
const assert = require('node:assert');
const { beautify, minify } = require('../src/cssfmt.js');

test('indents rules and declarations', () => {
  const out = beautify('a { color: red; font-size: 12px } b,c { margin: 0 }');
  assert.ok(out.includes('a {'));
  assert.ok(out.includes('\n  color: red;'));
  assert.ok(out.includes('\n  font-size: 12px'));
  assert.ok(out.includes('}\n'));
  assert.ok(out.includes('b,c {'));
});

test('handles nested braces (top-level)', () => {
  const out = beautify('@media screen { .box { width: 100% } }');
  assert.ok(out.startsWith('@media screen {'));
  assert.ok(out.includes('.box {'));
  // closing braces dedented
  assert.ok(out.trim().endsWith('}'));
});

test('protects comments and strings', () => {
  const out = beautify('a { content: "a : b"; } /* note */');
  assert.ok(out.includes('content: "a : b"'), 'string must survive');
  assert.ok(out.includes('/* note */'), 'comment must survive');
});

test('minify collapses whitespace and strips last semicolon', () => {
  const out = minify('a { color: red; }');
  assert.strictEqual(out, 'a{color:red}');
});

test('empty input', () => {
  assert.strictEqual(beautify(''), '');
  assert.strictEqual(minify('   '), '');
});
