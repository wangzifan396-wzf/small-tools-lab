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
