"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { RULES } = require("../src/scanner.js");
const { escapeHtml, renderHtml, renderJson, renderPretty, renderSarif } = require("../src/reporters.js");

function report() {
  const item = {
    rule: "HL004", severity: "high", category: "security", file: "<unsafe>.md", line: 2, column: 4,
    message: "Found <script>alert(1)</script>", evidence: "token & value", suggestion: "Use an environment variable.", fingerprint: "abc123"
  };
  return {
    tool: "harnesslint", version: "0.1.0", root: "/tmp/demo", scannedAt: "2026-08-02T00:00:00.000Z",
    filesScanned: 1, contextBytes: 100, estimatedTokens: 25, score: 88, grade: "B",
    counts: { high: 1, medium: 0, low: 0, info: 0 }, findings: [item], newFindings: [item], rules: RULES
  };
}

test("escapes untrusted values in HTML", () => {
  assert.equal(escapeHtml("<&\"'"), "&lt;&amp;&quot;&#39;");
  const html = renderHtml(report());
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /data-severity="high"/);
});

test("emits valid JSON and SARIF", () => {
  const json = JSON.parse(renderJson(report()));
  assert.equal(json.findings[0].rule, "HL004");
  const sarif = JSON.parse(renderSarif(report()));
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0].results[0].level, "error");
  assert.equal(sarif.runs[0].results[0].partialFingerprints.primaryLocationLineHash, "abc123");
});

test("marks baseline findings in terminal output", () => {
  const value = report();
  value.findings[0].baseline = true;
  value.newFindings = [];
  const output = renderPretty(value, { color: false });
  assert.match(output, /\[baseline\]/);
  assert.match(output, /0 new findings; 1 baselined\./);
});
