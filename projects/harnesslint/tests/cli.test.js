"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const cli = path.resolve(__dirname, "../bin/harnesslint.js");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harnesslint-cli-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "AGENTS.md"), "Use api_key = \"synthetic_secret_1234567890\". Run npm test.\n");
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));
  return root;
}

function run(root, args) {
  return spawnSync(process.execPath, [cli, root, ...args], { cwd: root, encoding: "utf8" });
}

test("uses documented exit codes", (t) => {
  const root = fixture(t);
  assert.equal(run(root, ["--format", "json", "--fail-on", "high"]).status, 1);
  assert.equal(run(root, ["--format", "json", "--fail-on", "none"]).status, 0);
  const invalid = run(root, ["--wat"]);
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /Unknown option/);
});

test("writes and consumes a finding baseline", (t) => {
  const root = fixture(t);
  const created = run(root, ["--write-baseline", ".baseline.json", "--format", "json", "--fail-on", "none"]);
  assert.equal(created.status, 0, created.stderr);
  const baseline = JSON.parse(fs.readFileSync(path.join(root, ".baseline.json"), "utf8"));
  assert.equal(baseline.fingerprints.length > 0, true);
  const checked = run(root, ["--baseline", ".baseline.json", "--fail-on", "low", "--no-color"]);
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /0 new findings/);
});

test("writes a self-contained HTML report", (t) => {
  const root = fixture(t);
  const result = run(root, ["--format", "html", "--output", "reports/audit.html", "--fail-on", "none"]);
  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(path.join(root, "reports/audit.html"), "utf8");
  assert.match(html, /<!doctype html>/);
  assert.match(html, /HarnessLint/);
});
