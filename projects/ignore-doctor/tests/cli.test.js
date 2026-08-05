"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const cli = path.resolve(__dirname, "../bin/ignore-doctor.js");

test("CLI emits JSON and honors the none gate", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ignore-doctor-cli-")); fs.writeFileSync(path.join(root, ".gitignore"), "*.log\n");
  const result = spawnSync(process.execPath, [cli, root, "--format", "json", "--fail-on", "none"], { encoding: "utf8" });
  assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).tool, "ignore-doctor");
});

test("CLI returns usage errors", () => { const result = spawnSync(process.execPath, [cli, "--format", "toml"], { encoding: "utf8" }); assert.equal(result.status, 2); assert.match(result.stderr, /Unsupported format/); });
