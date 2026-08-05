"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { lockfile, registryPackage, repository } = require("./helpers.js");

const cli = path.resolve(__dirname, "../bin/lockfile-lens.js");

test("uses finding and usage exit codes", (t) => {
  const root = repository(t, { "package-lock.json": lockfile([{ name: "bad", version: "1.0.0", resolved: "http://example.test/bad.tgz" }], { bad: "1.0.0" }) });
  const finding = spawnSync(process.execPath, [cli, root, "--fail-on", "high", "--no-color"], { encoding: "utf8" });
  assert.equal(finding.status, 1);
  assert.match(finding.stdout, /LL006/);
  const usage = spawnSync(process.execPath, [cli, root, "--format", "xml"], { encoding: "utf8" });
  assert.equal(usage.status, 2);
});

test("writes parseable JSON and self-contained HTML reports", (t) => {
  const root = repository(t, { "package-lock.json": lockfile([registryPackage("safe", "1.0.0")], { safe: "^1.0.0" }) });
  const json = path.join(root, "reports", "lens.json");
  const html = path.join(root, "reports", "lens.html");
  assert.equal(spawnSync(process.execPath, [cli, root, "--format", "json", "--output", json], { encoding: "utf8" }).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(json, "utf8")).summary.score, 100);
  assert.equal(spawnSync(process.execPath, [cli, root, "--format", "html", "--output", html], { encoding: "utf8" }).status, 0);
  assert.match(fs.readFileSync(html, "utf8"), /<!doctype html>/);
});
