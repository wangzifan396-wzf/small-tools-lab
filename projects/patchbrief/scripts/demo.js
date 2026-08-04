"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { buildPacket } = require("../src/builder.js");
const { renderHtml } = require("../src/reporters.js");

function git(root, args) { execFileSync("git", ["-C", root, ...args], { stdio: "ignore" }); }
function write(root, relative, content) { const destination = path.join(root, relative); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, content); }

const root = fs.mkdtempSync(path.join(os.tmpdir(), "patchbrief-demo-"));
try {
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "demo@example.invalid"]);
  git(root, ["config", "user.name", "PatchBrief Demo"]);
  write(root, "AGENTS.md", "# Service instructions\n\nRun npm test after changes. Keep authorization rules explicit.\n");
  write(root, "package.json", `${JSON.stringify({ name: "sample-service", version: "1.0.0", scripts: { test: "node --test" } }, null, 2)}\n`);
  write(root, "src/roles.js", "export const roles = new Set(['admin', 'member']);\n");
  write(root, "src/auth.js", "import { roles } from './roles.js';\nexport function authorize(role) { return roles.has(role); }\n");
  write(root, "src/controller.js", "import { authorize } from './auth.js';\nexport const canOpen = role => authorize(role);\n");
  write(root, "tests/auth.test.js", "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { authorize } from '../src/auth.js';\ntest('member', () => assert.equal(authorize('member'), true));\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "initial authorization"]);
  write(root, "src/auth.js", "import { roles } from './roles.js';\nconst api_key = \"synthetic_secret_1234567890\";\nexport function authorize(role, scope) {\n  if (scope === 'billing') return role === 'admin';\n  return roles.has(role);\n}\n");
  write(root, "src/audit.js", "export const audit = event => ({ event, at: Date.now() });\n");
  const packet = buildPacket(root, { budget: 2600, contextLines: 8 }, {});
  packet.repository = "sample-service";
  const output = path.resolve(process.cwd(), "patchbrief-report.html");
  fs.writeFileSync(output, renderHtml(packet));
  process.stdout.write(`Wrote ${output}\nIncluded ${packet.sections.length} sections in ~${packet.estimatedTokens} tokens with ${packet.redaction.count} redactions.\n`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
