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
