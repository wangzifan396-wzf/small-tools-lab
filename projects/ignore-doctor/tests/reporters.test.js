"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { escapeHtml, renderHtml, renderJson, renderMarkdown, renderPretty } = require("../src/reporters.js");

const report = { tool: "ignore-doctor", version: "0.1.0", generatedAt: "2026-08-05T00:00:00.000Z", repository: "demo", config: {}, summary: { score: 100, grade: "A", ignoreFiles: 1, rules: 2, findings: 0 }, counts: { high: 0, medium: 0, low: 0 }, files: [{ file: ".gitignore", kind: ".gitignore", scope: ".", rules: 2, negations: 0 }], findings: [] };
test("renders useful terminal, JSON, Markdown, and HTML reports", () => { assert.match(renderPretty(report), /Ignore Doctor/); assert.equal(JSON.parse(renderJson(report)).summary.score, 100); assert.match(renderMarkdown(report), /No findings/); assert.match(renderHtml(report), /Filter findings/); });
test("escapes repository-controlled HTML values", () => { assert.equal(escapeHtml(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"); assert.doesNotMatch(renderHtml({ ...report, repository: "<unsafe>" }), /<unsafe>/); });
