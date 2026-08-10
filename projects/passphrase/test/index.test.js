"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const T = require("../src/index.js");

test("wordlist has 256 unique lowercase words", () => {
  assert.equal(T.WORDS.length, 256);
  assert.equal(new Set(T.WORDS).size, 256);
  for (const w of T.WORDS) assert.ok(/^[a-z]+$/.test(w), w);
});

test("generate returns the requested word count joined by separator", () => {
  const p = T.generate({ words: 5, separator: ".", rng: () => 0.0 });
  const parts = p.split(".");
  assert.equal(parts.length, 5);
  // rng=0 -> first word every time
  assert.equal(parts.every((x) => x === T.WORDS[0]), true);
});

test("generate clamps word count to [2,16]", () => {
  assert.equal(T.generate({ words: 0, rng: () => 0.5 }).split("-").length, 2);
  assert.equal(T.generate({ words: 999, rng: () => 0.5 }).split("-").length, 16);
});

test("capitalize and includeNumber options work", () => {
  const p = T.generate({ words: 3, capitalize: true, includeNumber: true, rng: () => 0.5 });
  const parts = p.split("-");
  assert.equal(parts.length, 4); // 3 words + 1 number
  assert.ok(/^[A-Z]/.test(parts[0]));
  assert.ok(/^[0-9]$/.test(parts[3]));
});

test("entropy grows linearly with word count", () => {
  const b1 = T.entropyBits(1);
  const b6 = T.entropyBits(6);
  assert.ok(b6 > b1 * 5 && b6 < b1 * 7);
  assert.ok(b6 >= 48); // 6 * 8 bits
});
