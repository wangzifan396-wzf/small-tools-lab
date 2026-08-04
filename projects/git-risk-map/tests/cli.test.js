"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { commit, repository, write } = require("./helpers.js");

const cli = path.resolve(__dirname, "../bin/git-risk-map.js");

function run(root, args, cwd) {
  return spawnSync(process.execPath, [cli, root, ...args], { cwd: cwd || root, encoding: "utf8" });
}

test("uses exit codes for risk gates and usage errors", (t) => {
  const root = repository(t);
  write(root, "src/auth/session.js", "export const session = true;\n");
  commit(root, "baseline");
  fs.appendFileSync(path.join(root, "src/auth/session.js"), "export const permission = true;\n");
  assert.equal(run(root, ["--format", "json", "--fail-on", "low"]).status, 1);
  assert.equal(run(root, ["--format", "json", "--fail-on", "none"]).status, 0);
  const invalid = run(root, ["--unknown"]);
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /Unknown option/);
});

test("does not fail an empty comparison at the low threshold", (t) => {
  const root = repository(t);
  write(root, "README.md", "# Clean\n");
  commit(root, "baseline");
  assert.equal(run(root, ["--fail-on", "low"]).status, 0);
});

test("loads root configuration from a nested working path", (t) => {
  const root = repository(t);
  write(root, "src/core.js", "export const value = 1;\n");
  write(root, ".git-risk-map.json", JSON.stringify({ ignore: ["src/**"] }));
  commit(root, "baseline");
  fs.appendFileSync(path.join(root, "src/core.js"), "export const next = 2;\n");
  const result = run(path.join(root, "src"), ["--format", "json", "--fail-on", "low"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).summary.files, 0);
});

test("writes Markdown and HTML reports", (t) => {
  const root = repository(t);
  write(root, "src/core.js", "export const value = 1;\n");
  commit(root, "baseline");
  fs.appendFileSync(path.join(root, "src/core.js"), "export const next = 2;\n");
  const markdown = run(root, ["--format", "markdown", "--output", "reports/risk.md"]);
  assert.equal(markdown.status, 0, markdown.stderr);
  assert.match(fs.readFileSync(path.join(root, "reports/risk.md"), "utf8"), /Git Risk Map/);
  const html = run(root, ["--format", "html", "--output", "reports/risk.html"]);
  assert.equal(html.status, 0, html.stderr);
  assert.match(fs.readFileSync(path.join(root, "reports/risk.html"), "utf8"), /<!doctype html>/);
});
