"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { baseline, write } = require("./helpers.js");

const cli = path.resolve(__dirname, "../bin/patchbrief.js");
function run(root, args) { return spawnSync(process.execPath, [cli, root, ...args], { cwd: root, encoding: "utf8" }); }

test("gates on redactions and validates usage", (t) => {
  const { root } = baseline(t);
  write(root, "src/auth.js", "const api_key = \"synthetic_secret_1234567890\";\nexport const authorize = true;\n");
  const gated = run(root, ["--format", "json", "--fail-on-redaction"]);
  assert.equal(gated.status, 1, gated.stderr);
  assert.equal(JSON.parse(gated.stdout).redaction.count > 0, true);
  assert.equal(run(root, ["--format", "json", "--no-redact", "--fail-on-redaction"]).status, 0);
  const invalid = run(root, ["--wat"]);
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /Unknown option/);
});

test("writes Markdown and HTML packets", (t) => {
  const { root } = baseline(t);
  write(root, "src/new.js", "export const next = true;\n");
  assert.equal(run(root, ["--format", "markdown", "--output", "out/packet.md"]).status, 0);
  assert.match(fs.readFileSync(path.join(root, "out/packet.md"), "utf8"), /# PatchBrief/);
  assert.equal(run(root, ["--format", "html", "--output", "out/packet.html"]).status, 0);
  assert.match(fs.readFileSync(path.join(root, "out/packet.html"), "utf8"), /<!doctype html>/);
});
