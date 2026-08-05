"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { renderHtml, renderJson, renderMarkdown } = require("../src/reporters.js");

function report() {
  return { tool: "lockfile-lens", version: "0.1.0", generatedAt: "2026-08-04T00:00:00.000Z", repository: "demo<&", summary: { lockfiles: 1, packages: 2, added: 1, removed: 0, changed: 1, score: 85, grade: "B" }, counts: { high: 1, medium: 0, low: 0 }, lockfiles: [{ file: "package-lock.json", packages: 2, changes: { added: [{}], removed: [], changed: [{}] } }], findings: [{ rule: "LL003", title: "Host", severity: "high", category: "source", file: "<lock>", dependency: "bad|pkg", message: "Unexpected <host>", evidence: "https://bad.example?a=1&b=2", suggestion: "Review it." }] };
}

test("escapes HTML and emits valid JSON", () => {
  const value = report();
  const html = renderHtml(value);
  assert.doesNotMatch(html, /<lock>/);
  assert.match(html, /&lt;lock&gt;/);
  assert.equal(JSON.parse(renderJson(value)).findings.length, 1);
});

test("renders a useful Markdown finding table", () => {
  const markdown = renderMarkdown(report());
  assert.match(markdown, /Lockfile Lens/);
  assert.match(markdown, /bad\\\|pkg/);
});
