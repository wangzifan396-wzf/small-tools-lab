"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { analyzeRepository, isIgnored, matchesGlob, parseIgnore, ruleMatches } = require("../src/analyzer.js");

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ignore-doctor-"));
  for (const [name, content] of Object.entries(files)) { const destination = path.join(root, name); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, content); }
  return root;
}

test("parses comments, negations, anchors, and directories", () => {
  const rules = parseIgnore("# note\n/node_modules/\n!.env.example\n*.log\n");
  assert.equal(rules.length, 3); assert.equal(rules[0].anchored, true); assert.equal(rules[0].directoryOnly, true); assert.equal(rules[1].negated, true);
});

test("matches simple, nested, and double-star globs", () => {
  assert.equal(matchesGlob("src/a.js", "src/*.js"), true); assert.equal(matchesGlob("a/node_modules/x", "**/node_modules/**"), true); assert.equal(matchesGlob("a.txt", "*.log"), false);
});

test("applies ordered ignore and negation rules", () => {
  const rules = parseIgnore("*.env\n!.env.example\n");
  assert.equal(isIgnored(".env", false, rules), true); assert.equal(isIgnored(".env.example", false, rules), false); assert.equal(ruleMatches("src/.env", false, rules[0]), true);
});

test("reports duplicates, dangerous negations, and missing Docker boundaries", () => {
  const root = fixture({ ".gitignore": "*.log\n*.log\n!credentials.txt\n", ".dockerignore": "dist/\n", "credentials.txt": "placeholder" });
  const report = analyzeRepository(root, { sensitivePatterns: ["credentials.txt"] });
  assert.equal(report.summary.grade, "F"); assert.deepEqual(new Set(report.findings.map((item) => item.rule)), new Set(["ID001", "ID002", "ID004", "ID005"]));
});

test("does not report example sensitive files that are ignored", () => {
  const root = fixture({ ".gitignore": "*.pem\n", "certificate.pem": "placeholder" });
  const report = analyzeRepository(root); assert.equal(report.findings.some((item) => item.rule === "ID002"), false);
});

test("reports visible dependency directories", () => {
  const root = fixture({ "package.json": "{}", "packages/node_modules/keep.txt": "x" });
  const report = analyzeRepository(root); assert.equal(report.findings.some((item) => item.rule === "ID003"), true);
});

test("checks Docker context requirements only when Docker ignore exists", () => {
  const clean = analyzeRepository(fixture({ ".gitignore": "node_modules/\n" })); assert.equal(clean.findings.some((item) => item.rule === "ID004"), false);
  const report = analyzeRepository(fixture({ ".dockerignore": ".git\nnode_modules\n.env\n" })); assert.equal(report.findings.some((item) => item.rule === "ID004"), false);
});

test("validates configuration", () => {
  assert.throws(() => analyzeRepository(fixture({}), { maxRulesPerFile: 0 }), /maxRulesPerFile/);
  assert.throws(() => analyzeRepository(fixture({}), { ignore: "bad" }), /must be arrays/);
});
