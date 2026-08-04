"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const projects = ["local-kb", "screenshot-qa"];
function uvManagedPython() {
  const result = spawnSync("uv", ["python", "find"], { encoding: "utf8", shell: false, timeout: 10000 });
  return !result.error && result.status === 0 && result.stdout.trim()
    ? { command: result.stdout.trim(), prefix: [] }
    : null;
}

const managedPython = process.env.PYTHON ? null : uvManagedPython();
const candidates = process.env.PYTHON
  ? [{ command: process.env.PYTHON, prefix: [] }]
  : process.platform === "win32"
    ? [
        { command: "py", prefix: ["-3"] },
        { command: "python", prefix: [] },
        managedPython
      ].filter(Boolean)
    : [
        { command: "python3", prefix: [] },
        { command: "python", prefix: [] },
        managedPython
      ].filter(Boolean);
const launcher = candidates.find((candidate) => {
  const probe = spawnSync(candidate.command, [...candidate.prefix, "--version"], { stdio: "ignore", shell: false });
  return !probe.error && probe.status === 0;
});

if (!launcher) {
  console.error("No Python 3 launcher found. Install Python, run `uv python install`, or set PYTHON to an executable path.");
  process.exit(1);
}
let failed = 0;

for (const project of projects) {
  process.stdout.write(`\n=== ${project} (Python) ===\n`);
  const result = spawnSync(launcher.command, [...launcher.prefix, "-m", "unittest", "discover", "-s", "tests"], { cwd: path.join(root, "projects", project), stdio: "inherit", shell: false });
  if (result.error) { console.error(result.error.message); failed += 1; }
  else if (result.status !== 0) failed += 1;
}

console.log(`\nPython suites: ${projects.length - failed}/${projects.length} passed.`);
if (failed) process.exitCode = 1;
