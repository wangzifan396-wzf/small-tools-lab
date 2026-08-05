"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { renderHtml, renderJson, renderMarkdown, renderPretty } = require("../src/reporters.js");

function report() {
  return { tool: "log-sift", version: "0.1.0", generatedAt: "2026-08-04T00:00:00.000Z", config: {}, summary: { inputLines: 20, includedLines: 4, omittedLines: 16, repeatedLines: 8, errors: 1, warnings: 1, inputTokens: 200, outputTokens: 40, compressionPercent: 80 }, redaction: { count: 1, types: ["credential"] }, output: "ERROR <failed>\nwarning next", entries: [{ startLine: 10, endLine: 10, count: 1, kind: "error", text: "ERROR <failed>" }] };
}

test("renders valid JSON and concise text formats", () => {
  const value = report();
  assert.equal(JSON.parse(renderJson(value)).summary.compressionPercent, 80);
  assert.match(renderPretty(value), /80% smaller/);
  assert.match(renderMarkdown(value), /```text/);
});

test("escapes log content in HTML", () => {
  const html = renderHtml(report(), { source: "build<&.log" });
  assert.doesNotMatch(html, /ERROR <failed>/);
  assert.match(html, /ERROR &lt;failed&gt;/);
  assert.match(html, /build&lt;&amp;\.log/);
});
