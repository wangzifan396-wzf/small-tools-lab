"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { analyzeRepository, globToRegExp, parseLockfile, sourceInfo, validateConfig } = require("../src/analyzer.js");
const { lockfile, registryPackage, repository } = require("./helpers.js");

test("parses npm v2 and v3 package maps", () => {
  const parsed = parseLockfile(JSON.stringify(lockfile([registryPackage("safe", "1.0.0")])), "package-lock.json");
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].name, "safe");
  assert.equal(parsed.records[0].source.host, "registry.npmjs.org");
  assert.throws(() => parseLockfile(JSON.stringify({ lockfileVersion: 1 }), "old.json"), /lockfileVersion 2 or 3/);
});

test("gives a safe lockfile a perfect score", (t) => {
  const root = repository(t, { "package-lock.json": lockfile([registryPackage("safe", "1.0.0")], { safe: "^1.0.0" }) });
  const report = analyzeRepository(root, {}, {});
  assert.equal(report.summary.packages, 1);
  assert.equal(report.summary.score, 100);
  assert.deepEqual(report.findings, []);
});

test("detects source transport integrity and install risks", (t) => {
  const root = repository(t, { "package-lock.json": lockfile([
    { name: "git-tool", version: "1.0.0", resolved: "git+https://github.com/example/tool.git", hasInstallScript: true },
    { name: "http-tool", version: "2.0.0", resolved: "http://registry.example.test/http-tool.tgz" },
    { name: "mirror-tool", version: "3.0.0", resolved: "https://mirror.example.test/mirror-tool.tgz", integrity: "sha512-demo" }
  ], { "git-tool": "github:example/tool#main", "http-tool": "2.0.0", "mirror-tool": "3.0.0" }) });
  const rules = new Set(analyzeRepository(root, {}, {}).findings.map((item) => item.rule));
  for (const rule of ["LL002", "LL003", "LL004", "LL005", "LL006", "LL007"]) assert.equal(rules.has(rule), true, `missing ${rule}`);
});

test("compares baselines and highlights artifact drift and new scripts", (t) => {
  const before = lockfile([registryPackage("safe", "1.0.0")], { safe: "^1.0.0" });
  const current = lockfile([registryPackage("safe", "1.0.0", { integrity: "sha512-changed" }), registryPackage("scripted", "2.0.0", { hasInstallScript: true })], { safe: "^1.0.0", scripted: "^2.0.0" });
  const root = repository(t, { "package-lock.json": current, "before.json": before });
  const report = analyzeRepository(root, { maxNewPackages: 1 }, { before: path.join(root, "before.json") });
  assert.equal(report.summary.added, 1);
  assert.ok(report.findings.some((item) => item.rule === "LL010"));
  assert.ok(report.findings.some((item) => item.rule === "LL011"));
});

test("finds version spread and honors registry and path configuration", (t) => {
  const packages = lockfile([], {});
  packages.packages["node_modules/a"] = { name: "a", version: "1.0.0", resolved: "https://mirror.example/a-1.tgz", integrity: "sha512-1" };
  packages.packages["node_modules/x/node_modules/a"] = { name: "a", version: "2.0.0", resolved: "https://mirror.example/a-2.tgz", integrity: "sha512-2" };
  const root = repository(t, { "apps/main/package-lock.json": packages, "ignored/package-lock.json": "not json" });
  const report = analyzeRepository(root, { allowedRegistries: ["mirror.example"], maxVersionsPerPackage: 1, ignore: ["ignored/**"] }, {});
  assert.equal(report.summary.lockfiles, 1);
  assert.deepEqual(report.findings.map((item) => item.rule), ["LL008"]);
  assert.equal(globToRegExp("ignored/**").test("ignored/package-lock.json"), true);
});

test("reports malformed lockfiles without aborting the scan", (t) => {
  const root = repository(t, { "package-lock.json": "{ broken" });
  const report = analyzeRepository(root, {}, {});
  assert.equal(report.findings[0].rule, "LL001");
  assert.equal(report.lockfiles[0].packages, 0);
});

test("validates configuration and classifies sources", () => {
  assert.throws(() => validateConfig({ maxNewPackages: 0 }), /positive integer/);
  assert.throws(() => validateConfig({ ignore: "fixtures" }), /array of strings/);
  assert.equal(sourceInfo("git+https://example/repo.git").type, "git");
  assert.equal(sourceInfo("file:../local").type, "local");
  assert.equal(sourceInfo("https://registry.npmjs.org/a.tgz").type, "registry");
});
