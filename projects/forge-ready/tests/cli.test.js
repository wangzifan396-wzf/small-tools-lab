"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { readyFiles, repository } = require("./helpers.js");

const cli = path.resolve(__dirname, "../bin/forge-ready.js");
function run(root, args) { return spawnSync(process.execPath, [cli, root, ...args], { cwd: root, encoding: "utf8" }); }

test("uses score and usage exit codes", (t) => {
  const ready = repository(t, readyFiles());
  assert.equal(run(ready, ["--min-score", "100", "--format", "json"]).status, 0);
  const empty = repository(t, {});
  assert.equal(run(empty, ["--min-score", "80", "--format", "json"]).status, 1);
  const invalid = run(ready, ["--wat"]);
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /Unknown option/);
});

test("prints the rule catalog", (t) => {
  const root = repository(t, {});
  const result = run(root, ["--list-rules"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /FR001\tdocumentation\t-15/);
});

test("writes self-contained reports", (t) => {
  const root = repository(t, readyFiles());
  const result = run(root, ["--format", "html", "--output", "reports/readiness.html"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(root, "reports/readiness.html"), "utf8"), /<!doctype html>/);
});
