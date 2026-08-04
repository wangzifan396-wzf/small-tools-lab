"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const projectsRoot = path.join(root, "projects");
const npmFromScript = process.env.npm_execpath;
const npm = npmFromScript ? process.execPath : (process.platform === "win32" ? "npm.cmd" : "npm");
const npmArgs = npmFromScript ? [npmFromScript, "test"] : ["test"];
const projects = fs.readdirSync(projectsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(projectsRoot, entry.name, "package.json")))
  .map((entry) => entry.name)
  .sort();

let failed = 0;
for (const project of projects) {
  process.stdout.write(`\n=== ${project} ===\n`);
  const result = spawnSync(npm, npmArgs, { cwd: path.join(projectsRoot, project), stdio: "inherit", shell: false });
  if (result.error) { console.error(result.error.message); failed += 1; }
  else if (result.status !== 0) failed += 1;
}

console.log(`\nProject suites: ${projects.length - failed}/${projects.length} passed.`);
if (failed) process.exitCode = 1;
