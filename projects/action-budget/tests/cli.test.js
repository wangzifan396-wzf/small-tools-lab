"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { repository } = require("./helpers.js");
const cli = path.resolve(__dirname, "../bin/action-budget.js");

test("uses finding and usage exit codes", (t) => {
  const root = repository(t, { ".github/workflows/ci.yml": "on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n" });
  assert.equal(spawnSync(process.execPath, [cli, root, "--fail-on", "low"], { encoding: "utf8" }).status, 1);
  assert.equal(spawnSync(process.execPath, [cli, root, "--fail-on", "none"], { encoding: "utf8" }).status, 0);
  assert.equal(spawnSync(process.execPath, [cli, root, "--max-jobs", "zero"], { encoding: "utf8" }).status, 2);
});

test("writes parseable reports", (t) => {
  const root = repository(t, { ".github/workflows/ci.yml": "on: push\njobs: {}\n" }); const output = path.join(root, "reports", "budget.json");
  const result = spawnSync(process.execPath, [cli, root, "--format", "json", "--output", output, "--fail-on", "none"], { encoding: "utf8" });
  assert.equal(result.status, 0); assert.equal(JSON.parse(fs.readFileSync(output, "utf8")).tool, "action-budget");
});
