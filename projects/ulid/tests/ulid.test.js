const test = require('node:test');
const assert = require('node:assert');
const { generate, decode, isValid } = require('../src/ulid.js');

const RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

test('generate produces a 26-char Crockford ULID', () => {
  var u = generate();
  assert.equal(u.length, 26);
  assert.ok(RE.test(u), 'format: ' + u);
});

test('timestamp 0 encodes to a zero-padded time part', () => {
  assert.ok(generate(0).startsWith('0000000000'), generate(0));
});

test('round-trip several fixed timestamps', () => {
  [0, 1, 1700000000000, 281474976710655].forEach(function (t) {
    var u = generate(t);
    var d = decode(u);
    assert.equal(d.timestamp, t, 'failed at ' + t + ' -> ' + u);
    assert.equal(d.ulid, u);
  });
});

test('canonical ULID vector decodes to a stable, valid structure', () => {
  var v = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  var d = decode(v);
  assert.equal(d.ulid, v);
  assert.ok(d.timestamp > 0);
  assert.ok(d.time instanceof Date && !isNaN(d.time.getTime()));
  assert.match(d.randomness, /^[0-9a-f]{20}$/);
  // Re-generating from the decoded timestamp must reproduce the same 10-char
  // time part — proves encode/decode are exact inverses on real data.
  assert.equal(generate(d.timestamp).slice(0, 10), '01ARZ3NDEK');
});

test('isValid', () => {
  assert.equal(isValid(generate()), true);
  assert.equal(isValid('01ARZ3NDEKTSV4RRFFQ69G5FAV'), true);
  assert.equal(isValid('not-a-ulid!!!'), false);
  assert.equal(isValid('01ARZ3NDEKTSV4RRFFQ69G5FA'), false); // too short
});
