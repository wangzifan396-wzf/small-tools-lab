"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { analyzeRepository } = require("../src/analyzer.js");
const { renderHtml } = require("../src/reporters.js");

function run(root, args) {
  execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
}

function write(root, relative, content) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "git-risk-map-demo-"));
try {
  run(root, ["init", "-b", "main"]);
  run(root, ["config", "user.email", "demo@example.invalid"]);
  run(root, ["config", "user.name", "Risk Map Demo"]);
  write(root, "src/auth/session.js", "export function session(id) { return { id }; }\n");
  write(root, "src/core/parser.js", "export function parse(value) { return JSON.parse(value); }\n");
  write(root, "package.json", `${JSON.stringify({ name: "sample-service", version: "1.0.0", dependencies: { fastify: "4.0.0" } }, null, 2)}\n`);
  run(root, ["add", "."]);
  run(root, ["commit", "-m", "initial service"]);
  for (let index = 1; index <= 4; index += 1) {
    fs.appendFileSync(path.join(root, "src/core/parser.js"), `export const parserRevision${index} = ${index};\n`);
    run(root, ["add", "."]);
    run(root, ["commit", "-m", `parser revision ${index}`]);
  }

  fs.appendFileSync(path.join(root, "src/auth/session.js"), `${Array.from({ length: 120 }, (_, index) => `export function permissionRule${index}(actor) { return actor.roles.includes("role-${index}"); }`).join("\n")}\n`);
  fs.appendFileSync(path.join(root, "src/core/parser.js"), `${Array.from({ length: 90 }, (_, index) => `export const decoder${index} = value => String(value).trim();`).join("\n")}\n`);
  write(root, "migrations/20260802_add_session_scope.sql", `${Array.from({ length: 45 }, (_, index) => `ALTER TABLE sessions ADD COLUMN scope_${index} TEXT;`).join("\n")}\n`);
  write(root, ".github/workflows/deploy.yml", "name: Deploy\non: push\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ./deploy.sh\n");
  write(root, "package.json", `${JSON.stringify({ name: "sample-service", version: "1.0.0", dependencies: { fastify: "5.2.0", jose: "6.0.0" } }, null, 2)}\n`);
  write(root, "docs/release-notes.md", "# Release notes\n\nSession authorization and parser behavior changed.\n");

  const report = analyzeRepository(root, {}, {
    pathRules: [{ pattern: "src/auth/**", label: "Production identity boundary", weight: 15 }]
  });
  report.repository = "sample-service";
  const output = path.resolve(process.cwd(), "git-risk-map-report.html");
  fs.writeFileSync(output, renderHtml(report));
  process.stdout.write(`Wrote ${output}\nRisk ${report.overall.level} ${report.overall.score}/100 across ${report.summary.files} files.\n`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
