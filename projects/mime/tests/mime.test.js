const test = require('node:test');
const assert = require('node:assert');
const { lookup, extensions, charset } = require('../src/mime.js');

test('lookup by extension', () => {
  assert.equal(lookup('js'), 'text/javascript');
  assert.equal(lookup('.json'), 'application/json');
  assert.equal(lookup('PNG'), 'image/png');
  assert.equal(lookup('file.html'), 'text/html');
  assert.equal(lookup('archive.TAR.GZ'), 'application/gzip');
});

test('lookup unknown -> empty', () => {
  assert.equal(lookup(''), '');
  assert.equal(lookup('zzz'), '');
  assert.equal(lookup('weird.xyz'), '');
});

test('extensions reverse lookup', () => {
  var jp = extensions('image/jpeg').sort();
  assert.ok(jp.includes('jpg'));
  assert.ok(jp.includes('jpeg'));
  assert.deepEqual(extensions('text/markdown').sort(), ['markdown', 'md']);
  assert.deepEqual(extensions('nope/nope'), []);
});

test('charset hints for text-like types', () => {
  assert.equal(charset('text/html'), 'UTF-8');
  assert.equal(charset('application/json'), 'UTF-8');
  assert.equal(charset('image/png'), '');
  assert.equal(charset(''), '');
});
