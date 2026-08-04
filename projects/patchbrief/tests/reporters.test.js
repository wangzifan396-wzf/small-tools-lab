"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { escapeHtml, renderHtml, renderJson, renderMarkdown, renderSummary, renderXml } = require("../src/reporters.js");

function packet() {
  const section = { id: "diff:src/a.js", kind: "diff", title: "Diff: src/<a>.js", file: "src/<a>.js", priority: 100, essential: true, reason: "Changed & reviewed", language: "diff", content: "+const value = `<unsafe>`;\n```", tokens: 12, redactions: 1, truncated: false };
  return { tool: "patchbrief", version: "0.1.0", generatedAt: "2026-08-03T00:00:00.000Z", repository: "demo", comparison: "working tree vs HEAD", budget: 1000, estimatedTokens: 212, remainingTokens: 788, contextLines: 20, redaction: { enabled: true, count: 1, types: ["SECRET_VALUE"] }, changes: [{ status: "M", file: "src/<a>.js" }], sections: [section], excluded: [], kindCounts: { diff: 1 } };
}

test("escapes untrusted HTML and XML values", () => {
  assert.equal(escapeHtml("<&\"'"), "&lt;&amp;&quot;&#39;");
  const html = renderHtml(packet());
  assert.match(html, /src\/&lt;a&gt;\.js/);
  assert.doesNotMatch(html, /<unsafe>/);
  const xml = renderXml(packet());
  assert.match(xml, /&lt;unsafe&gt;/);
  assert.doesNotMatch(xml, /<unsafe>/);
});

test("emits valid JSON and collision-safe Markdown fences", () => {
  assert.equal(JSON.parse(renderJson(packet())).estimatedTokens, 212);
  const markdown = renderMarkdown(packet());
  assert.match(markdown, /# PatchBrief/);
  assert.match(markdown, /````diff/);
});

test("renders a concise terminal manifest", () => {
  const summary = renderSummary(packet(), { color: false });
  assert.match(summary, /212 \/ 1,000 tokens/);
  assert.match(summary, /src\/<a>\.js/);
});
