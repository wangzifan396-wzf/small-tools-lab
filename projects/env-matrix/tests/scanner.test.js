"use strict";
const assert = require("node:assert/strict"); const test = require("node:test");
const { SENSITIVE_NAME, globToRegExp, placeholder, scanRepository } = require("../src/scanner.js"); const { repository } = require("./helpers.js");

test("recognizes placeholders, sensitive names, and globs", () => {
  assert.equal(placeholder("<database-url>"), true); assert.equal(placeholder("real-value"), false);
  assert.equal(SENSITIVE_NAME.test("API_TOKEN"), true); assert.equal(globToRegExp("fixtures/**").test("fixtures/a/.env"), true);
});

test("builds a complete cross-layer contract", (t) => {
  const root = repository(t, {
    "src/config.js": "export const api = process.env.API_URL ?? 'http://localhost';\n",
    "src/config.py": "import os\ndatabase = os.environ['DATABASE_URL']\n",
    ".env.example": "API_URL=http://localhost\nDATABASE_URL=<postgres-url>\n",
    ".github/workflows/ci.yml": "name: CI\non: push\njobs:\n  test:\n    env:\n      DATABASE_URL: ${{ secrets.DATABASE_URL }}\n",
    "docker-compose.yml": "services:\n  api:\n    environment:\n      API_URL: http://api\n",
    "README.md": "Configure `API_URL` and `DATABASE_URL` before launch.\n"
  });
  const report = scanRepository(root, {});
  assert.equal(report.summary.coverage, 100); assert.equal(report.summary.score, 100); assert.equal(report.findings.length, 0);
  const database = report.variables.find((item) => item.name === "DATABASE_URL");
  assert.equal(database.requirement, "required"); assert.equal(database.layers.ci.length, 1); assert.equal(database.layers.docs.length, 1); assert.deepEqual(database.defaults.map((item) => item.value), ["[REDACTED]"]);
});

test("detects contract drift, dynamic access, and secret risks", (t) => {
  const root = repository(t, {
    "src/config.js": "const api = process.env.API_URL;\nconst token = process.env.API_TOKEN ?? 'unsafe_fallback_value';\nconst dynamic = process.env[key];\n",
    ".env.example": "API_TOKEN=synthetic_concrete_token\nDB_URL=\nUNUSED_FLAG=true\nUNUSED_FLAG=false\nlower_name=bad\n",
    ".env.sample": "API_TOKEN=another_concrete_token\nDB_URL=<database-url>\n",
    ".env": "ACTIVE_SECRET=do-not-copy\n"
  });
  const report = scanRepository(root, { required: ["DB_URL"] }); const rules = new Set(report.findings.map((item) => item.rule));
  for (const rule of ["EM001", "EM002", "EM003", "EM004", "EM005", "EM006", "EM007", "EM008", "EM009", "EM010", "EM011"]) assert.equal(rules.has(rule), true, `missing ${rule}`);
  const serialized = JSON.stringify(report); assert.doesNotMatch(serialized, /synthetic_concrete_token|another_concrete_token/); assert.match(serialized, /\[REDACTED\]/);
  const token = report.variables.find((item) => item.name === "API_TOKEN"); assert.deepEqual(token.layers.example.map((item) => item.defaultValue), ["[REDACTED]", "[REDACTED]"]);
});

test("supports multiple source languages", (t) => {
  const root = repository(t, {
    "main.go": "package main\nimport \"os\"\nvar region = os.Getenv(\"REGION\")\n",
    "App.java": "class App { String port = System.getenv(\"PORT\"); }\n",
    "lib.rb": "value = ENV['RUBY_MODE']\n",
    "main.rs": "fn main() { let home = std::env::var(\"APP_HOME\"); }\n",
    ".env.example": "REGION=local\nPORT=8080\nRUBY_MODE=dev\nAPP_HOME=/tmp/app\n"
  });
  const names = scanRepository(root, {}).variables.map((item) => item.name); assert.deepEqual(names, ["APP_HOME", "PORT", "REGION", "RUBY_MODE"]);
});

test("honors ignored and allowed variables", (t) => {
  const root = repository(t, { "src/app.js": "console.log(process.env.INTERNAL_ONLY);\n", ".env.example": "STALE_OK=true\n" });
  const report = scanRepository(root, { ignoreVariables: ["INTERNAL_ONLY"], allowUnused: ["STALE_OK"] });
  assert.equal(report.findings.length, 0); assert.deepEqual(report.variables.map((item) => item.name), ["STALE_OK"]);
});

test("applies configured requirements and compares only example defaults", (t) => {
  const root = repository(t, {
    "src/app.js": "const url = process.env.APP_URL ?? 'http://source-fallback';\n",
    ".env.example": "APP_URL=http://example-default\nREQUIRED_VALUE=\n",
    ".env.sample": "APP_URL=http://example-default\nREQUIRED_VALUE=<required-value>\n"
  });
  const report = scanRepository(root, { required: ["REQUIRED_VALUE"] });
  const conflicts = report.findings.filter((item) => item.rule === "EM004");
  assert.deepEqual(conflicts.map((item) => item.variable), ["REQUIRED_VALUE"]);
  assert.equal(report.findings.some((item) => item.rule === "EM005" && item.variable === "REQUIRED_VALUE"), true);
});
