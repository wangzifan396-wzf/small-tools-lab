"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const args = [path.join(__dirname, "lockfile-lens.js"), process.env.INPUT_PATH || "."];
for (const [input, flag] of [["INPUT_BASE", "--base"], ["INPUT_FAIL_ON", "--fail-on"], ["INPUT_FORMAT", "--format"], ["INPUT_OUTPUT", "--output"], ["INPUT_CONFIG", "--config"]]) {
  if (process.env[input]) args.push(flag, process.env[input]);
}
const result = spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.error) { console.error(result.error.message); process.exitCode = 2; }
else process.exitCode = result.status ?? 2;
