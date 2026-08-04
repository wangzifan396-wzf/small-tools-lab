"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildPacket, createSnippet, estimateTokens, extractChangedRanges, globToRegExp, localImportSpecifiers, mergeRanges, parseNameStatus, redactContent, resolveLocalImport, selectCandidates } = require("../src/builder.js");
const { baseline, git, write } = require("./helpers.js");

test("parses Git statuses and changed ranges", () => {
  assert.deepEqual(parseNameStatus("M\0src/a.js\0R100\0old.js\0new.js\0"), [{ status: "M", file: "src/a.js" }, { status: "R", similarity: 100, oldPath: "old.js", file: "new.js" }]);
  assert.deepEqual(extractChangedRanges("@@ -1,0 +2,3 @@\n+x\n@@ -8 +11 @@\n-y\n+z"), [{ start: 2, end: 4 }, { start: 11, end: 11 }]);
});

test("merges contextual ranges and creates numbered snippets", () => {
  assert.deepEqual(mergeRanges([{ start: 3, end: 3 }, { start: 7, end: 7 }], 2, 10), [{ start: 1, end: 9 }]);
  const snippet = createSnippet("a\nb\nc\nd\ne", [{ start: 3, end: 3 }], 1);
  assert.match(snippet, /lines 2-4/);
  assert.match(snippet, /\s+3 \| c/);
});

test("redacts supported secret forms before output", () => {
  const value = redactContent("const api_key = \"synthetic_secret_1234567890\";", true);
  assert.equal(value.count, 1);
  assert.match(value.content, /\[REDACTED:SECRET_VALUE\]/);
  assert.doesNotMatch(value.content, /synthetic_secret/);
});

test("discovers and resolves local imports", (t) => {
  const { root } = baseline(t);
  const imports = localImportSpecifiers("import { allowed } from './util.js';", ".js");
  assert.deepEqual(imports, ["./util.js"]);
  assert.equal(resolveLocalImport(root, "src/auth.js", imports[0]), "src/util.js");
  assert.equal(globToRegExp("docs/**").test("docs/a/readme.md"), true);
});

test("shares a constrained budget across essential sections", () => {
  const candidates = [
    { id: "a", kind: "diff", file: "a.js", priority: 100, essential: true, content: "a".repeat(1000), tokens: 250 },
    { id: "b", kind: "diff", file: "b.js", priority: 100, essential: true, content: "b".repeat(1000), tokens: 250 },
    { id: "c", kind: "test", file: "a.test.js", priority: 75, essential: false, content: "c".repeat(800), tokens: 200 }
  ];
  const result = selectCandidates(candidates, 500, 100);
  assert.equal(result.selected.filter((item) => item.essential).length, 2);
  assert.equal(result.usedTokens <= 500, true);
  assert.ok(result.selected.some((item) => item.truncated));
});

test("does not truncate essential sections when they fit", () => {
  const candidates = [
    { id: "a", kind: "diff", file: "a.js", priority: 100, essential: true, content: "a".repeat(200), tokens: 50 },
    { id: "b", kind: "instruction", file: "AGENTS.md", priority: 95, essential: true, content: "b".repeat(400), tokens: 100 },
    { id: "c", kind: "test", file: "a.test.js", priority: 75, essential: false, content: "c".repeat(200), tokens: 50 }
  ];
  const result = selectCandidates(candidates, 500, 100);
  assert.equal(result.selected.filter((item) => item.essential).every((item) => !item.truncated), true);
  assert.equal(result.selected.length, 3);
});

test("builds a redacted packet with instructions and related code", (t) => {
  const { root } = baseline(t);
  write(root, "src/auth.js", "import { allowed } from './util.js';\nconst api_key = \"synthetic_secret_1234567890\";\nexport const authorize = (role, scope) => scope === 'admin' ? role === 'admin' : allowed.has(role);\n");
  write(root, "src/new-file.js", "export const newValue = true;\n");
  const packet = buildPacket(root, { budget: 1800, contextLines: 5 }, {});
  const kinds = new Set(packet.sections.map((item) => item.kind));
  for (const kind of ["diff", "instruction", "snippet", "manifest", "test", "dependency", "importer"]) assert.equal(kinds.has(kind), true, `missing ${kind}`);
  assert.equal(packet.estimatedTokens <= packet.budget, true);
  assert.equal(packet.redaction.count > 0, true);
  assert.equal(packet.sections.some((item) => item.content.includes("synthetic_secret")), false);
  assert.ok(packet.changes.some((item) => item.status === "U"));
  const files = packet.sections.filter((item) => !["diff", "snippet"].includes(item.kind)).map((item) => item.file);
  assert.equal(files.length, new Set(files).size);
});

test("supports staged, base, and ignored comparisons", (t) => {
  const { root, base } = baseline(t);
  fs.appendFileSync(path.join(root, "src/auth.js"), "export const changed = true;\n");
  write(root, "notes.txt", "untracked\n");
  git(root, ["add", "src/auth.js"]);
  const staged = buildPacket(root, { staged: true, budget: 1000 }, {});
  assert.deepEqual(staged.changes.map((item) => item.file), ["src/auth.js"]);
  git(root, ["commit", "-m", "change auth"]);
  const compared = buildPacket(root, { base, head: "HEAD", budget: 1000 }, {});
  assert.deepEqual(compared.changes.map((item) => item.file), ["src/auth.js"]);
  const ignored = buildPacket(root, { budget: 1000 }, { ignore: ["notes.txt"] });
  assert.equal(ignored.changes.some((item) => item.file === "notes.txt"), false);
});

test("validates packet configuration", (t) => {
  const { root } = baseline(t);
  assert.throws(() => buildPacket(root, { budget: 400 }, {}), /between 500/);
  assert.throws(() => buildPacket(root, {}, { alwaysInclude: "README.md" }), /alwaysInclude/);
  assert.equal(estimateTokens("12345"), 2);
});
