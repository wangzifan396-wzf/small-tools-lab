"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { analyzeRepository, expandMatrix, globToRegExp, scheduledRunsPerDay, validateConfig } = require("../src/analyzer.js");
const { repository } = require("./helpers.js");

test("expands cartesian matrices with excludes and includes", () => {
  const result = expandMatrix({ os: ["linux", "windows"], node: [20, 22], exclude: [{ os: "windows", node: 22 }], include: [{ os: "linux", node: 22, experimental: true }, { os: "linux", node: 24 }] });
  assert.equal(result.known, true); assert.equal(result.variants, 4);
  assert.equal(result.combinations.some((item) => item.node === 22 && item.experimental), true);
  assert.equal(result.combinations.some((item) => item.node === 24), true);
});

test("marks expression-driven matrices as unknown", () => {
  const result = expandMatrix("${{ fromJSON(needs.plan.outputs.matrix) }}");
  assert.equal(result.known, false); assert.equal(result.variants, 1);
});

test("measures variants concurrency timeout and runners", (t) => {
  const root = repository(t, { ".github/workflows/ci.yml": `name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: \${{ matrix.os }}
    timeout-minutes: 10
    strategy:
      max-parallel: 2
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [20, 22]
    steps:
      - run: echo ok
` });
  const report = analyzeRepository(root, { maxMatrixVariants: 3 }); const workflow = report.workflows[0]; const job = workflow.jobs[0];
  assert.equal(job.matrix.variants, 4); assert.equal(job.concurrency, 2); assert.equal(job.timeoutExposure, 40);
  assert.deepEqual(report.runnerBreakdown, { linux: 2, windows: 2 });
  assert.equal(report.findings.some((item) => item.rule === "AB002"), true);
  assert.equal(report.findings.some((item) => item.rule === "AB009"), true);
});

test("surfaces dynamic matrices reusable workflows and default timeouts", (t) => {
  const root = repository(t, { ".github/workflows/dynamic.yml": `name: Dynamic
on: workflow_dispatch
jobs:
  generated:
    runs-on: ubuntu-latest
    strategy:
      matrix: \${{ fromJSON(inputs.matrix) }}
    steps:
      - run: echo generated
  reused:
    uses: owner/repo/.github/workflows/build.yml@main
` });
  const report = analyzeRepository(root, {}); const rules = new Set(report.findings.map((item) => item.rule));
  assert.equal(rules.has("AB005"), true); assert.equal(rules.has("AB006"), true); assert.equal(rules.has("AB007"), true); assert.equal(report.summary.unknownJobs, 2);
});

test("recognizes a push branch filter as duplicate-run mitigation", (t) => {
  const root = repository(t, { ".github/workflows/ci.yml": `name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: echo ok
` });
  const report = analyzeRepository(root, {});
  assert.equal(report.findings.some((item) => item.rule === "AB009"), false);
});

test("reports invalid YAML without aborting the repository scan", (t) => {
  const root = repository(t, { ".github/workflows/bad.yml": "name: bad\njobs:\n  test: [\n" }); const report = analyzeRepository(root, {});
  assert.equal(report.findings[0].rule, "AB012"); assert.match(report.workflows[0].parseError, /flow sequence|Unexpected|end/i);
});

test("estimates common schedule frequencies", () => {
  assert.equal(scheduledRunsPerDay("*/15 * * * *"), 96); assert.equal(scheduledRunsPerDay("0 * * * *"), 24); assert.equal(scheduledRunsPerDay("0,30 * * * *"), 48); assert.equal(scheduledRunsPerDay("0 0 * * *"), 1); assert.equal(scheduledRunsPerDay("0 */6 * * *"), 4); assert.equal(scheduledRunsPerDay("dynamic"), null);
});

test("supports ignores and empty repositories", (t) => {
  const root = repository(t, { ".github/workflows/skip.yml": "on: push\njobs: {}\n" });
  const report = analyzeRepository(root, { ignore: [".github/workflows/**"] }); assert.equal(report.summary.workflows, 0); assert.equal(report.findings.length, 0);
  assert.equal(globToRegExp(".github/workflows/**").test(".github/workflows/ci.yml"), true);
});

test("validates numeric budgets", () => {
  assert.throws(() => validateConfig({ maxJobsPerRun: 0 }), /positive number/); assert.throws(() => validateConfig({ ignore: "fixtures" }), /array of strings/);
});
