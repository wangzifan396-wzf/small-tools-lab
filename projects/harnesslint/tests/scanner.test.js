"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { globToRegExp, isHarnessFile, packageIsPinned, scanRepository } = require("../src/scanner.js");

function repository(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harnesslint-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [relative, content] of Object.entries(files)) {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
  }
  return root;
}

test("recognizes supported harness files", () => {
  assert.equal(isHarnessFile("AGENTS.md"), true);
  assert.equal(isHarnessFile("packages/api/CLAUDE.md"), true);
  assert.equal(isHarnessFile(".cursor/rules/security.mdc"), true);
  assert.equal(isHarnessFile(".claude/skills/review/SKILL.md"), true);
  assert.equal(isHarnessFile("src/index.js"), false);
});

test("matches ignore globs and pinned package forms", () => {
  const pattern = globToRegExp("examples/**");
  assert.equal(pattern.test("examples/demo/AGENTS.md"), true);
  assert.equal(pattern.test("src/AGENTS.md"), false);
  assert.equal(packageIsPinned("eslint@9.8.0"), true);
  assert.equal(packageIsPinned("@scope/server@1.2.3"), true);
  assert.equal(packageIsPinned("@scope/server"), false);
});

test("detects integrity, security, permission, and supply-chain risks", (t) => {
  const root = repository(t, {
    "package.json": JSON.stringify({ scripts: { test: "node --test" } }),
    "AGENTS.md": [
      "# Instructions",
      "Run `npm run verify` and read [guide](docs/missing.md).",
      "Use api_key = \"synthetic_secret_1234567890\".",
      "For cleanup run `git reset --hard`.",
      "Always run npm run verify before edits.",
      "This intentionally repeated instruction is long enough to trigger duplicate context detection in separate harness files."
    ].join("\n"),
    "CLAUDE.md": [
      "# Claude",
      "Never run npm run verify before edits.",
      "This intentionally repeated instruction is long enough to trigger duplicate context detection in separate harness files."
    ].join("\n"),
    ".mcp.json": JSON.stringify({ mcpServers: {
      package: { command: "npx", args: ["@scope/server"] },
      wrapped: { command: "bash", args: ["-c", "node server.js"] },
      remote: { url: "http://example.invalid/mcp" }
    } }, null, 2),
    ".claude/settings.json": JSON.stringify({ permissions: { allow: ["*"] } }),
    ".claude/skills/demo/SKILL.md": "# Missing frontmatter\n"
  });
  const report = scanRepository(root, {});
  const rules = new Set(report.findings.map((item) => item.rule));
  for (const expected of ["HL001", "HL002", "HL004", "HL005", "HL007", "HL008", "HL009", "HL010", "HL011", "HL013", "HL014"]) {
    assert.equal(rules.has(expected), true, `missing ${expected}`);
  }
  assert.equal(report.counts.high > 0, true);
  assert.equal(report.score < 100, true);
});

test("reports malformed JSON with a useful location", (t) => {
  const root = repository(t, {
    "AGENTS.md": "Run npm test after changes.\n",
    ".mcp.json": "{\n  \"mcpServers\": { broken: true }\n}"
  });
  const report = scanRepository(root, {});
  const malformed = report.findings.find((item) => item.rule === "HL015");
  assert.ok(malformed);
  assert.equal(malformed.file, ".mcp.json");
  assert.equal(malformed.severity, "high");
});

test("adds repository readiness findings and honors ignores", (t) => {
  const root = repository(t, {
    "nested/AGENTS.md": "No validation command is documented.\n",
    "ignored/CLAUDE.md": "api_key = \"synthetic_secret_1234567890\"\n"
  });
  const report = scanRepository(root, { ignore: ["ignored/**"] });
  const rules = report.findings.map((item) => item.rule);
  assert.ok(rules.includes("HL100"));
  assert.ok(rules.includes("HL101"));
  assert.equal(rules.includes("HL004"), false);
});

test("resolves scoped references and scripts from the nearest package", (t) => {
  const root = repository(t, {
    "package.json": JSON.stringify({ scripts: { test: "node --test" } }),
    "AGENTS.md": "Run `npm test` after changes.\n",
    "packages/tool/package.json": JSON.stringify({ scripts: { demo: "node bin/demo.js" } }),
    "packages/tool/AGENTS.md": "Review `src/index.js`, then run `npm run demo` and `node bin/demo.js`.\n",
    "packages/tool/src/index.js": "module.exports = true;\n",
    "packages/tool/bin/demo.js": "console.log('demo');\n"
  });
  const report = scanRepository(root, {});
  assert.equal(report.findings.some((item) => ["HL001", "HL002"].includes(item.rule)), false);
});

test("does not report duplicate instructions across sibling scopes", (t) => {
  const repeated = "Run the focused project tests before finishing any implementation change in this directory.";
  const root = repository(t, {
    "AGENTS.md": "Run `npm test` after changes.\n",
    "packages/one/AGENTS.md": `${repeated}\n`,
    "packages/two/AGENTS.md": `${repeated}\n`
  });
  const report = scanRepository(root, {});
  assert.equal(report.findings.some((item) => item.rule === "HL010"), false);
});
