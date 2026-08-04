"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { escapeHtml, renderHtml, renderJson, renderMarkdown, renderPretty } = require("../src/reporters.js");

function report() {
  return { tool: "action-budget", version: "0.1.0", generatedAt: "2026-08-03T00:00:00.000Z", repository: "demo<&", config: {}, summary: { workflows: 1, jobDefinitions: 1, jobVariants: 4, maxConcurrentJobs: 2, timeoutExposure: 40, unknownJobs: 0, scheduledRunsPerDay: 0, score: 94, grade: "B" }, counts: { high: 0, medium: 1, low: 0 }, runnerBreakdown: { linux: 4 }, workflows: [{ file: ".github/workflows/<ci>.yml", name: "CI | test", triggers: ["push"], parseError: null, jobs: [], summary: { jobDefinitions: 1, jobVariants: 4, concurrency: 2, timeoutExposure: 40, unknownJobs: 0, scheduledRunsPerDay: 0 } }], findings: [{ rule: "AB002", severity: "medium", file: ".github/workflows/<ci>.yml", job: "test", message: "Large <matrix>", evidence: "4 > 3", suggestion: "Reduce it." }] };
}

test("escapes self-contained HTML", () => {
  assert.equal(escapeHtml("<&\"'"), "&lt;&amp;&quot;&#39;"); const html = renderHtml(report()); assert.match(html, /demo&lt;&amp;/); assert.doesNotMatch(html, /Large <matrix>/); assert.match(html, /data-filter/);
});

test("renders JSON Markdown and terminal summaries", () => {
  assert.equal(JSON.parse(renderJson(report())).summary.jobVariants, 4); assert.match(renderMarkdown(report()), /## Action Budget/); assert.match(renderPretty(report(), { color: false }), /Timeout exposure 40 min/);
});
