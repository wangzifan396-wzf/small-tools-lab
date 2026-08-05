"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const args = [path.join(__dirname, "log-sift.js"), process.env.INPUT_INPUT || "-"];
for (const [input, flag] of [["INPUT_BUDGET", "--budget"], ["INPUT_CONTEXT", "--context"], ["INPUT_FORMAT", "--format"], ["INPUT_OUTPUT", "--output"], ["INPUT_CONFIG", "--config"]]) {
  if (process.env[input]) args.push(flag, process.env[input]);
}
if (process.env.INPUT_FAIL_ON_SECRET === "true") args.push("--fail-on-secret");
const result = spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.error) { console.error(result.error.message); process.exitCode = 2; }
else process.exitCode = result.status ?? 2;
