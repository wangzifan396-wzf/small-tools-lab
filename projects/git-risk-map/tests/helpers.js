"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function write(root, relative, content) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

function repository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "git-risk-map-test-"));
  t.after(() => { try { spawn(process.execPath, ["-e", `require("node:fs").rmSync(${JSON.stringify(root)},{recursive:true,force:true,maxRetries:3})`], { detached: true, stdio: "ignore" }).unref(); } catch { /* cleanup is best-effort */ } });
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "tests@example.invalid"]);
  git(root, ["config", "user.name", "Git Risk Map Tests"]);
  git(root, ["config", "core.autocrlf", "false"]);
  return root;
}

function commit(root, message) {
  git(root, ["add", "."]);
  git(root, ["commit", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}

module.exports = { commit, git, repository, write };
