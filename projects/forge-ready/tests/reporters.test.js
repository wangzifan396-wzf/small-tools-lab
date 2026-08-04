"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { escapeHtml, renderHtml, renderJson, renderMarkdown, renderPretty } = require("../src/reporters.js");

function report() {
  const finding = { rule: "FR015", title: "Broken README link", category: "documentation", penalty: 5, severity: "medium", effort: "small", file: "<README>.md", line: 4, message: "Missing <image>", evidence: "docs/a&b.png", suggestion: "Correct the link." };
  return { tool: "forge-ready", version: "0.1.0", generatedAt: "2026-08-03T00:00:00.000Z", repository: "demo", profile: "cli", filesScanned: 4, score: 95, grade: "A", categories: { documentation: { score: 20, maximum: 25, deductions: 5 }, community: { score: 15, maximum: 15, deductions: 0 }, quality: { score: 25, maximum: 25, deductions: 0 }, security: { score: 20, maximum: 20, deductions: 0 }, release: { score: 15, maximum: 15, deductions: 0 } }, findings: [finding], counts: { high: 0, medium: 1, low: 0 }, nextActions: [{ rule: "FR015", title: finding.title, suggestion: finding.suggestion, effort: "small" }] };
}

test("escapes repository-controlled HTML values", () => {
  assert.equal(escapeHtml("<&\"'"), "&lt;&amp;&quot;&#39;");
  const html = renderHtml(report());
  assert.match(html, /Missing &lt;image&gt;/);
  assert.doesNotMatch(html, /Missing <image>/);
});

test("renders valid JSON, Markdown, and terminal output", () => {
  assert.equal(JSON.parse(renderJson(report())).score, 95);
  assert.match(renderMarkdown(report()), /## ForgeReady/);
  const pretty = renderPretty(report(), { color: false });
  assert.match(pretty, /Grade A/);
  assert.match(pretty, /FR015/);
});
