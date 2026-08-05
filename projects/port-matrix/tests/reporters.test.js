"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { escapeHtml, renderHtml, renderJson, renderMarkdown, renderPretty } = require("../src/reporters.js");
const report = { tool: "port-matrix", version: "0.1.0", generatedAt: "2026-08-05T00:00:00Z", repository: "demo", config: {}, summary: { score: 100, grade: "A", declarations: 1, uniquePorts: 1, findings: 0 }, counts: { high: 0, medium: 0, low: 0 }, layers: { source: 1 }, declarations: [{ file: "server.js", line: 1, layer: "source", role: "runtime", port: 3000, service: "", protocol: "tcp", scope: ".", evidence: "listen(3000)" }], findings: [] };
test("renders all report formats", () => { assert.match(renderPretty(report), /Port Matrix/); assert.equal(JSON.parse(renderJson(report)).summary.score, 100); assert.match(renderMarkdown(report), /No findings/); assert.match(renderHtml(report), /Port inventory/); });
test("escapes untrusted HTML", () => { assert.equal(escapeHtml("<b>x</b>"), "&lt;b&gt;x&lt;/b&gt;"); assert.doesNotMatch(renderHtml({ ...report, repository: "<unsafe>" }), /<unsafe>/); });
