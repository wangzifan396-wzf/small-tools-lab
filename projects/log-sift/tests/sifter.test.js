"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { classify, estimateTokens, redactSecrets, siftLog, stripAnsi, stripTimestamp, validateConfig } = require("../src/sifter.js");

test("redacts credential provider bearer and URL forms", () => {
  const result = redactSecrets("api_key=synthetic_value_123456 Bearer abcdefghijklmnop https://user:pass123456@example.test ghp_abcdefghijklmnop");
  assert.equal(result.text.includes("synthetic_value"), false);
  assert.equal(result.text.includes("pass123456"), false);
  assert.equal(result.text.includes("ghp_"), false);
  assert.equal(result.count, 4);
});

test("collapses timestamped consecutive repetition", () => {
  const report = siftLog(["10:00:00 polling worker", "10:00:01 polling worker", "10:00:02 polling worker"].join("\n"), { budget: 100 });
  assert.match(report.output, /repeated 3x/);
  assert.equal(report.summary.repeatedLines, 2);
});

test("prioritizes errors warnings and nearby context", () => {
  const lines = Array.from({ length: 80 }, (_, index) => `ordinary line ${index}`);
  lines[39] = "request payload prepared";
  lines[40] = "ERROR database write failed";
  lines[41] = "at saveRecord (store.js:12:4)";
  lines[55] = "warning retry budget nearly exhausted";
  const report = siftLog(lines.join("\n"), { budget: 120, context: 1, head: 2, tail: 2 });
  assert.match(report.output, /database write failed/);
  assert.match(report.output, /saveRecord/);
  assert.match(report.output, /retry budget/);
  assert.match(report.output, /omitted/);
});

test("keeps output within the configured approximate budget", () => {
  const input = Array.from({ length: 200 }, (_, index) => `unique diagnostic line ${index} with enough detail to consume context`).join("\n");
  const report = siftLog(input, { budget: 64, head: 2, tail: 2 });
  assert.equal(report.summary.outputTokens <= 64, true);
  assert.equal(report.summary.compressionPercent > 80, true);
});

test("cleans ANSI timestamps and classifies common signals", () => {
  assert.equal(stripAnsi("\u001b[31mERROR\u001b[0m"), "ERROR");
  assert.equal(stripTimestamp("2026-08-04T10:00:00.000Z ready"), "ready");
  assert.equal(classify("Fatal exception in worker"), "error");
  assert.equal(classify("0 failed, 12 passed"), "summary");
  assert.equal(classify("deprecated option warning"), "warning");
});

test("strips timestamps only when requested and clips long lines", () => {
  const report = siftLog("2026-08-04T10:00:00.000Z " + "x".repeat(200), { budget: 100, maxLineChars: 60, stripTimestamps: true });
  assert.doesNotMatch(report.output, /2026-08/);
  assert.match(report.output, /line clipped/);
});

test("validates configuration and estimates tokens deterministically", () => {
  assert.throws(() => validateConfig({ budget: 4 }), /at least 32/);
  assert.throws(() => validateConfig({ context: -1 }), /non-negative/);
  assert.equal(estimateTokens("12345"), 2);
});
