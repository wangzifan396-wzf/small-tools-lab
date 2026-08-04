"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { analyzeRepository, classifyPath, globToRegExp, parseNameStatus, riskLevel, scoreFile, validateConfig } = require("../src/analyzer.js");
const { commit, git, repository, write } = require("./helpers.js");

test("parses null-delimited statuses including renames", () => {
  const changes = parseNameStatus("M\0src/app.js\0R095\0old name.js\0new name.js\0D\0gone.js\0");
  assert.deepEqual(changes, [
    { status: "M", file: "src/app.js" },
    { status: "R", similarity: 95, oldPath: "old name.js", file: "new name.js" },
    { status: "D", file: "gone.js" }
  ]);
});

test("classifies review surfaces by path", () => {
  assert.deepEqual(new Set(classifyPath("src/auth/session.ts")), new Set(["security", "source"]));
  assert.ok(classifyPath("migrations/001_users.sql").includes("migration"));
  assert.ok(classifyPath(".github/workflows/ci.yml").includes("infrastructure"));
  assert.ok(classifyPath("tests/session.test.js").includes("test"));
  assert.ok(classifyPath("package-lock.json").includes("dependency"));
});

test("scores files with a transparent signal breakdown", () => {
  const result = scoreFile({
    file: "src/auth/session.js", status: "M", additions: 120, deletions: 30, currentLines: 400, binary: false,
    tags: ["security", "source"], history: { commits: 8, authors: 3 }
  }, {
    testsChanged: false, historyDays: 90, thresholds: { critical: 75, high: 55, medium: 30, low: 0 },
    pathRules: [{ pattern: globToRegExp("src/auth/**"), source: "src/auth/**", label: "Identity boundary", weight: 10 }]
  });
  assert.equal(result.level, "critical");
  assert.ok(result.signals.some((signal) => signal.label === "No tests changed"));
  assert.ok(result.signals.some((signal) => signal.label === "Identity boundary"));
  assert.equal(result.score <= 100, true);
});

test("validates configuration and risk thresholds", () => {
  assert.doesNotThrow(() => validateConfig({ ignore: ["dist/**"], pathRules: [{ pattern: "src/**", weight: 5 }] }));
  assert.throws(() => validateConfig({ ignore: "dist/**" }), /config.ignore/);
  assert.equal(riskLevel(74, { critical: 75, high: 55, medium: 30, low: 0 }), "high");
});

test("analyzes working-tree changes, untracked files, and ignores", (t) => {
  const root = repository(t);
  write(root, "src/auth/session.js", "export const session = id => ({ id });\n");
  write(root, "tests/session.test.js", "export const covered = true;\n");
  write(root, "docs/guide.md", "# Guide\n");
  commit(root, "baseline");
  fs.appendFileSync(path.join(root, "src/auth/session.js"), `${Array.from({ length: 80 }, (_, index) => `export const rule${index} = true;`).join("\n")}\n`);
  write(root, "migrations/002_scope.sql", "ALTER TABLE sessions ADD COLUMN scope TEXT;\n");
  write(root, "docs/draft.md", "# Ignored draft\n");

  const report = analyzeRepository(root, {}, {
    ignore: ["docs/**"],
    pathRules: [{ pattern: "src/auth/**", label: "Identity", weight: 15 }]
  });
  assert.equal(report.summary.files, 2);
  assert.equal(report.files[0].file, "src/auth/session.js");
  assert.ok(report.files.some((file) => file.status === "U" && file.tags.includes("migration")));
  assert.equal(report.summary.sourceFiles, 1);
  assert.equal(report.summary.testFiles, 0);
  assert.equal(report.overall.score > 0, true);
  assert.ok(report.recommendations.some((item) => /tests/.test(item)));
});

test("supports staged and base comparisons", (t) => {
  const root = repository(t);
  write(root, "src/core.js", "export const value = 1;\n");
  const base = commit(root, "baseline");
  write(root, "src/core.js", "export const value = 2;\nexport const next = 3;\n");
  write(root, "notes.txt", "not staged\n");
  git(root, ["add", "src/core.js"]);
  const staged = analyzeRepository(root, { staged: true }, {});
  assert.deepEqual(staged.files.map((file) => file.file), ["src/core.js"]);
  assert.equal(staged.comparison, "staged changes vs HEAD");
  git(root, ["commit", "-m", "change runtime value"]);
  const compared = analyzeRepository(root, { base, head: "HEAD" }, {});
  assert.deepEqual(compared.files.map((file) => file.file), ["src/core.js"]);
  assert.match(compared.comparison, /\.\.\.HEAD$/);
});

test("returns a clean report when no files changed", (t) => {
  const root = repository(t);
  write(root, "README.md", "# Clean\n");
  commit(root, "baseline");
  const report = analyzeRepository(root, {}, {});
  assert.equal(report.files.length, 0);
  assert.deepEqual(report.overall, { score: 0, level: "low", blastRadius: 0 });
});
