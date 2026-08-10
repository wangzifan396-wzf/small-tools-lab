"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const T = require("../src/index.js");

test("basic small numbers", () => {
  assert.equal(T.toWords(0), "zero");
  assert.equal(T.toWords(7), "seven");
  assert.equal(T.toWords(15), "fifteen");
  assert.equal(T.toWords(42), "forty-two");
});

test("hundreds with and without 'and'", () => {
  assert.equal(T.toWords(101, { useAnd: true }), "one hundred and one");
  assert.equal(T.toWords(101, { useAnd: false }), "one hundred one");
  assert.equal(T.toWords(320), "three hundred and twenty");
});

test("thousands and commas", () => {
  assert.equal(T.toWords(1234), "one thousand, two hundred and thirty-four");
  assert.equal(T.toWords(1000000), "one million");
  assert.equal(T.toWords(2000001), "two million and one");
});

test("negative numbers", () => {
  assert.equal(T.toWords(-5), "negative five");
  assert.equal(T.toWords(-1234), "negative one thousand, two hundred and thirty-four");
});

test("rejects non-finite and over-large", () => {
  assert.throws(() => T.toWords("abc"));
  assert.throws(() => T.toWords(1e20));
});

test("keeps integers above Number.MAX_SAFE_INTEGER exact", () => {
  const a = T.toWords("9007199254740992");
  const b = T.toWords("9007199254740993");
  assert.notEqual(a, b);
  assert.ok(b.endsWith("nine hundred and ninety-three"));
  assert.equal(T.toWords(9007199254740993n), b);
});

test("rejects decimals, exponent notation, and unsafe Number values", () => {
  assert.throws(() => T.toWords(1.5), /整数/);
  assert.throws(() => T.toWords("1.5"), /整数/);
  assert.throws(() => T.toWords("1e3"), /整数/);
  assert.throws(() => T.toWords(9007199254740992), /字符串/);
});

test("supports the exact upper boundary and rejects 10^18", () => {
  const max = T.toWords("999999999999999999");
  assert.ok(max.startsWith("nine hundred and ninety-nine quadrillion"));
  assert.ok(max.endsWith("nine hundred and ninety-nine"));
  assert.throws(() => T.toWords("1000000000000000000"), /quadrillion/);
});
