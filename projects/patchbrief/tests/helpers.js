"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function git(root, args) { return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
function write(root, relative, content) { const destination = path.join(root, relative); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, content); }
function repository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patchbrief-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "tests@example.invalid"]);
  git(root, ["config", "user.name", "PatchBrief Tests"]);
  git(root, ["config", "core.autocrlf", "false"]);
  return root;
}
function commit(root, message) { git(root, ["add", "."]); git(root, ["commit", "-m", message]); return git(root, ["rev-parse", "HEAD"]); }
function baseline(t) {
  const root = repository(t);
  write(root, "AGENTS.md", "# Instructions\n\nRun npm test after changes.\n");
  write(root, "package.json", JSON.stringify({ name: "sample", scripts: { test: "node --test" } }, null, 2));
  write(root, "src/util.js", "export const allowed = new Set(['member']);\n");
  write(root, "src/auth.js", "import { allowed } from './util.js';\nexport const authorize = role => allowed.has(role);\n");
  write(root, "src/controller.js", "import { authorize } from './auth.js';\nexport const open = role => authorize(role);\n");
  write(root, "tests/auth.test.js", "import { authorize } from '../src/auth.js';\nexport const covered = authorize('member');\n");
  const base = commit(root, "baseline");
  return { root, base };
}

module.exports = { baseline, commit, git, repository, write };
