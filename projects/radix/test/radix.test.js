import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BASE, alphabetFor, isValidInput, toDecimal, fromDecimal,
  convert, commonConversions, bitView,
} from "../src/core/radix.js";
import { run } from "../src/cli.js";

test("isValidInput accepts and rejects by base", () => {
  assert.equal(isValidInput("101", 2), true);
  assert.equal(isValidInput("2", 2), false);
  assert.equal(isValidInput("ff", 16), true);
  assert.equal(isValidInput("g", 16), false);
  assert.equal(isValidInput("-a", 16), true);
  assert.equal(isValidInput("", 10), false);
});

test("toDecimal parses signed values as BigInt", () => {
  assert.equal(toDecimal("ff", 16), 255n);
  assert.equal(toDecimal("101", 2), 5n);
  assert.equal(toDecimal("-a", 16), -10n);
  assert.equal(toDecimal("z", 36), 35n);
});

test("fromDecimal renders in target base", () => {
  assert.equal(fromDecimal(255n, 16), "ff");
  assert.equal(fromDecimal(255n, 2), "11111111");
  assert.equal(fromDecimal(0n, 16), "0");
  assert.equal(fromDecimal(-10n, 16), "-a");
});

test("convert round-trips between bases", () => {
  assert.equal(convert("ff", 16, 10).value, "255");
  assert.equal(convert("255", 10, 16).value, "ff");
  assert.equal(convert("1010", 2, 10).value, "10");
  assert.equal(convert("-ff", 16, 10).value, "-255");
  assert.equal(convert("255", 10, 16).decimal, "255");
});

test("large values stay exact via BigInt", () => {
  const big = "ffffffffffffffff"; // 2^64-1
  const r = convert(big, 16, 10);
  assert.equal(r.value, "18446744073709551615");
});

test("commonConversions shows four bases", () => {
  const c = commonConversions("255", 10);
  assert.equal(c.binary, "11111111");
  assert.equal(c.octal, "377");
  assert.equal(c.decimal, "255");
  assert.equal(c.hex, "ff");
});

test("bitView reports bits, bytes and byte-aligned groups", () => {
  const b = bitView("255", 10);
  assert.equal(b.binary, "11111111");
  assert.equal(b.bits, 8);
  assert.equal(b.byteLength, 1);
  assert.deepEqual(b.bytes, ["11111111"]);

  const b2 = bitView("256", 10);
  assert.equal(b2.binary, "100000000");
  assert.equal(b2.bits, 9);
  assert.equal(b2.byteLength, 2);
  assert.deepEqual(b2.bytes, ["00000001", "00000000"]);
});

test("alphabetFor enforces base range", () => {
  assert.equal(alphabetFor(1), null);
  assert.equal(alphabetFor(MAX_BASE + 1), null);
  assert.equal(alphabetFor(16).length, 16);
});

test("CLI converts base to base", () => {
  const r = run(["ff", "16", "10"]);
  assert.equal(r.code, 0);
  assert.equal(r.out, "255");
});

test("CLI --all prints four bases", () => {
  const r = run(["--all", "255", "10"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /二进制/);
  assert.match(r.out, /11111111/);
  assert.match(r.out, /ff/);
});

test("CLI --bits shows byte view", () => {
  const r = run(["--bits", "255", "10"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /字节视图/);
  assert.match(r.out, /11111111/);
});

test("CLI rejects invalid input", () => {
  const r = run(["2", "2", "10"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /非法输入/);
});

test("CLI shows help", () => {
  const r = run(["--help"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /用法/);
});
