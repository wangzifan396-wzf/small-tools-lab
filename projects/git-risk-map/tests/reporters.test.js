"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { escapeHtml, renderHtml, renderJson, renderMarkdown, renderPretty } = require("../src/reporters.js");

function report() {
  const file = {
    file: "src/<unsafe>.js", status: "M", additions: 12, deletions: 2, binary: false, currentLines: 30, bytes: 400,
    tags: ["source"], history: { commits: 3, authors: 2 }, score: 48, level: "medium",
    signals: [{ label: "Custom <signal>", points: 8, detail: "detail & evidence" }]
  };
  return {
    tool: "git-risk-map", version: "0.1.0", root: "/tmp/demo", repository: "demo", generatedAt: "2026-08-02T00:00:00.000Z",
    comparison: "working tree vs HEAD", historyDays: 90, thresholds: { critical: 75, high: 55, medium: 30, low: 0 },
    overall: { score: 52, level: "medium", blastRadius: 4 },
    summary: { files: 1, additions: 12, deletions: 2, sourceFiles: 1, testFiles: 0, testChangeRatio: 0, binaryFiles: 0 },
    files: [file], reviewPlan: [{ title: "Runtime behavior", files: [file.file] }], recommendations: ["Add focused tests."]
  };
}

test("escapes repository-controlled values in HTML", () => {
  assert.equal(escapeHtml("<&\"'"), "&lt;&amp;&quot;&#39;");
  const html = renderHtml(report());
  assert.match(html, /src\/&lt;unsafe&gt;\.js/);
  assert.match(html, /Custom &lt;signal&gt;/);
  assert.doesNotMatch(html, /<unsafe>/);
});

test("emits valid JSON and useful Markdown", () => {
  const json = JSON.parse(renderJson(report()));
  assert.equal(json.overall.score, 52);
  const markdown = renderMarkdown(report());
  assert.match(markdown, /## Git Risk Map/);
  assert.match(markdown, /src\/<unsafe>\.js/);
  assert.match(markdown, /Review plan/);
});

test("renders a stable terminal review order", () => {
  const output = renderPretty(report(), { color: false });
  assert.match(output, /MEDIUM/);
  assert.match(output, /src\/<unsafe>\.js/);
  assert.match(output, /Custom <signal> \+8/);
});
