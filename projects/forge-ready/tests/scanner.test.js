"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const { execFileSync } = require("node:child_process");
const { calculateScores, detectProfile, globToRegExp, scanRepository } = require("../src/scanner.js");
const { readyFiles, repository } = require("./helpers.js");

test("detects repository profiles", () => {
  assert.equal(detectProfile([], { bin: "bin/cli.js" }, "auto"), "cli");
  assert.equal(detectProfile([], { exports: "./index.js" }, "auto"), "library");
  assert.equal(detectProfile(["index.html"], null, "auto"), "app");
  assert.equal(detectProfile([], null, "general"), "general");
});

test("matches repository-relative ignore globs", () => {
  const pattern = globToRegExp("examples/**");
  assert.equal(pattern.test("examples/demo/package.json"), true);
  assert.equal(pattern.test("src/index.js"), false);
});

test("gives a complete repository a perfect score", (t) => {
  const root = repository(t, readyFiles());
  const report = scanRepository(root, { profile: "auto" }, {});
  assert.equal(report.profile, "cli");
  assert.equal(report.score, 100);
  assert.equal(report.grade, "A");
  assert.deepEqual(report.findings, []);
});

test("finds high-impact release, quality, and security gaps", (t) => {
  const root = repository(t, {
    "package.json": JSON.stringify({ name: "unsafe", private: true, dependencies: { demo: "1.0.0" }, bin: { unsafe: "bin/missing.js" } }),
    "credentials.json": "{\"api_key\":\"synthetic_secret_1234567890\"}",
    "src/index.js": "module.exports = true;\n"
  });
  const report = scanRepository(root, { profile: "cli" }, {});
  const rules = new Set(report.findings.map((item) => item.rule));
  for (const rule of ["FR001", "FR003", "FR005", "FR009", "FR010", "FR012", "FR013", "FR016", "FR019", "FR022", "FR023", "FR027", "FR028"]) assert.equal(rules.has(rule), true, `missing ${rule}`);
  assert.equal(report.score < 50, true);
  assert.equal(report.grade, "F");
});

test("requires a publish allowlist only for public packages", (t) => {
  const files = readyFiles();
  const manifest = JSON.parse(files["package.json"]);
  delete manifest.files;
  files["package.json"] = JSON.stringify(manifest);
  const root = repository(t, files);
  assert.equal(scanRepository(root, { profile: "cli" }, {}).findings.some((item) => item.rule === "FR021"), true);
  manifest.private = true;
  files["package.json"] = JSON.stringify(manifest);
  const privateRoot = repository(t, files);
  assert.equal(scanRepository(privateRoot, { profile: "cli" }, {}).findings.some((item) => item.rule === "FR021"), false);
});

test("accepts Pages deployment as app release automation", (t) => {
  const files = readyFiles();
  delete files[".github/workflows/release.yml"];
  files[".github/workflows/pages.yml"] = "name: Pages\non: push\njobs: {}\n";
  const root = repository(t, files);
  assert.equal(scanRepository(root, { profile: "app" }, {}).findings.some((item) => item.rule === "FR028"), false);
});

test("reports broken README links and mutable workflow refs", (t) => {
  const files = readyFiles();
  files["README.md"] += "\n[Missing](docs/missing.png)\n";
  files[".github/workflows/ci.yml"] = "name: CI\non: push\npermissions: write-all\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@main\n";
  const root = repository(t, files);
  const report = scanRepository(root, {}, {});
  assert.ok(report.findings.some((item) => item.rule === "FR015" && item.line > 1));
  assert.ok(report.findings.some((item) => item.rule === "FR025"));
  assert.ok(report.findings.some((item) => item.rule === "FR026"));
});

test("supports ignores and disabled rules", (t) => {
  const files = readyFiles();
  delete files["CODE_OF_CONDUCT.md"];
  files["dist/bundle.js"] = "generated";
  const root = repository(t, files);
  const report = scanRepository(root, {}, { ignore: ["dist/**"], disableRules: ["FR006"] });
  assert.equal(report.findings.some((item) => ["FR006", "FR017"].includes(item.rule)), false);
  assert.throws(() => scanRepository(root, {}, { disableRules: ["FR999"] }), /known rule IDs/);
});

test("caps category deductions when calculating scores", () => {
  const findings = Array.from({ length: 5 }, () => ({ category: "security", penalty: 15 }));
  const result = calculateScores(findings);
  assert.equal(result.categories.security.score, 0);
  assert.equal(result.score, 80);
  assert.equal(result.grade, "B");
});

test("ignores tracked files deleted from the working tree", (t) => {
  const root = repository(t, readyFiles());
  execFileSync("git", ["init"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  fs.rmSync(`${root}/src/index.js`);
  assert.doesNotThrow(() => scanRepository(root, { profile: "cli" }, {}));
});
