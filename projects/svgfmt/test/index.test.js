"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const T = require("../src/index.js");

const SAMPLE = '<svg   xmlns="http://www.w3.org/2000/svg"><!-- c --><circle cx="5" cy="5" r="4" /></svg>';

test("isSvg detects svg root", () => {
  assert.equal(T.isSvg(SAMPLE), true);
  assert.equal(T.isSvg("<div></div>"), false);
  assert.equal(T.isSvg(""), false);
});

test("minify removes comments and collapses inter-tag whitespace", () => {
  const out = T.minify(SAMPLE);
  assert.ok(!out.includes("<!--"), "comments removed");
  assert.ok(!/>\s+</.test(out), "no inter-tag whitespace");
  assert.ok(out.startsWith("<svg") && out.endsWith("</svg>"));
});

test("format adds indentation and newlines", () => {
  const out = T.format(SAMPLE, "  ");
  assert.ok(out.includes("\n"), "has newlines");
  assert.ok(/^\s{2}<circle/.test(out.split("\n").find((l) => l.includes("<circle")) || ""), "circle indented");
});

test("format is reversible enough: minify(format()) stays valid svg", () => {
  const f = T.format(SAMPLE, "  ");
  const m = T.minify(f);
  assert.equal(T.isSvg(m), true);
});

test("summary reports byte size and tag count", () => {
  const s = T.summary(SAMPLE);
  assert.ok(s.bytes > 0);
  assert.ok(s.tags >= 2);
  assert.equal(s.isSvg, true);
});

test("minify preserves text, quoted whitespace, and CDATA", () => {
  const input = '<svg aria-label="a  >  b"><text xml:space="preserve"> a  b </text><![CDATA[<!--keep-->]]></svg>';
  const out = T.minify(input);
  assert.ok(out.includes('aria-label="a  >  b"'));
  assert.ok(out.includes('<text xml:space="preserve"> a  b </text>'));
  assert.ok(out.includes('<![CDATA[<!--keep-->]]>'));
});

test("format keeps text containers inline and handles greater-than in attributes", () => {
  const input = '<svg><g data-check="x > y"><text>A <tspan>B</tspan> C</text></g></svg>';
  const out = T.format(input);
  assert.ok(out.includes('data-check="x > y"'));
  assert.ok(out.includes('<text>A <tspan>B</tspan> C</text>'));
});

test("summary counts UTF-8 bytes without relying on Node Buffer", () => {
  const input = "<svg>汉</svg>";
  assert.equal(T.summary(input).bytes, new TextEncoder().encode(input).length);
});

test("malformed comments and tags fail clearly", () => {
  assert.throws(() => T.minify("<svg><!--"), /注释未闭合/);
  assert.throws(() => T.minify('<svg data-x="broken>'), /标签未闭合/);
});

test("format rejects mismatched and unclosed element structures", () => {
  assert.throws(() => T.format("<svg><g></svg>"), /标签不匹配/);
  assert.throws(() => T.format("<svg><g></g>"), /标签未闭合/);
});
