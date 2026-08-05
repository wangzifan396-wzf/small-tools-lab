"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const cli = path.resolve(__dirname, "../bin/log-sift.js");

test("reads stdin and gates on redacted secrets", () => {
  const result = spawnSync(process.execPath, [cli, "-", "--format", "json", "--fail-on-secret"], { input: "start\napi_key=synthetic_secret_123456\nERROR stopped\n", encoding: "utf8" });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.redaction.count, 1);
  assert.doesNotMatch(report.output, /synthetic_secret/);
});

test("reads files and writes a report", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "log-sift-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, "input.txt");
  const output = path.join(root, "reports", "sift.md");
  fs.writeFileSync(input, "start\nwarning retry\nERROR failed\nend\n");
  const result = spawnSync(process.execPath, [cli, input, "--format", "markdown", "--output", output, "--budget", "100"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(fs.readFileSync(output, "utf8"), /Log Sift/);
});

test("returns usage errors for invalid formats", () => {
  const result = spawnSync(process.execPath, [cli, "-", "--format", "xml"], { input: "log", encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unsupported format/);
});
