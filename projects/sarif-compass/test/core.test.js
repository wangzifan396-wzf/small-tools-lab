"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const C = require("../src/core.js");

function rule(id = "SEC001", level = "warning") {
  return {
    id, name: "HardcodedSecret", shortDescription: { text: "Hardcoded credential" }, fullDescription: { text: "A credential appears in source." },
    help: { markdown: "Remove the secret." }, helpUri: "https://rules.example.com/SEC001", defaultConfiguration: { level },
    properties: { tags: ["security", "credential"], precision: "high", "security-severity": "8.7" },
  };
}

function location(uri = "src/app.js", line = 10, column = 4) {
  return { physicalLocation: { artifactLocation: { uri, uriBaseId: "SRCROOT" }, region: { startLine: line, startColumn: column, endLine: line, endColumn: column + 6, snippet: { text: "const token = 'secret'" } } }, logicalLocations: [{ fullyQualifiedName: "app.start" }] };
}

function result(overrides = {}) {
  return Object.assign({
    ruleId: "SEC001", ruleIndex: 0, level: "error", kind: "fail", message: { text: "Secret committed to source" }, locations: [location()],
    partialFingerprints: { primaryLocationLineHash: "stable-hash" }, baselineState: "new",
    codeFlows: [{ threadFlows: [{ locations: [{ executionOrder: 2, importance: "essential", location: location("src/config.js", 5, 1) }, { executionOrder: 1, location: location("src/input.js", 2, 1) }] }] }],
    fixes: [{ description: { text: "Remove it" }, artifactChanges: [] }],
  }, overrides);
}

function sarif(results = [result()]) {
  return {
    version: "2.1.0", $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [{
      tool: { driver: { name: "CodeScan", semanticVersion: "3.2.1", rules: [rule()] } },
      originalUriBaseIds: { SRCROOT: { uri: "file:///workspace/" } },
      artifacts: [{ location: { uri: "src/app.js", uriBaseId: "SRCROOT" }, contents: { text: "private source" } }], results,
    }],
  };
}

test("parses SARIF objects and BOM-prefixed JSON without mutation", () => {
  const source = sarif(); const before = JSON.stringify(source);
  assert.equal(C.parseSarif(source), source);
  assert.equal(C.parseSarif("\uFEFF" + before).version, "2.1.0");
  C.analyzeSarif(source); assert.equal(JSON.stringify(source), before);
});

test("rejects empty, malformed, array, and missing-runs input", () => {
  assert.throws(() => C.parseSarif(""), /empty/);
  assert.throws(() => C.parseSarif("{bad}"), /Invalid SARIF JSON/);
  assert.throws(() => C.parseSarif([]), /JSON object/);
  assert.throws(() => C.parseSarif({ version: "2.1.0" }), /runs array/);
});

test("warns about unsupported versions and empty runs", () => {
  const report = C.analyzeSarif({ version: "2.0.0", runs: [] });
  assert.deepEqual(report.issues.map((item) => item.code), ["version", "runs-empty"]);
});

test("normalizes run tool, version, rules, tags, and security metadata", () => {
  const report = C.analyzeSarif(sarif()); const normalizedRule = report.rules[0];
  assert.equal(report.runs[0].tool, "CodeScan");
  assert.equal(report.runs[0].version, "3.2.1");
  assert.equal(normalizedRule.id, "SEC001");
  assert.equal(normalizedRule.defaultLevel, "warning");
  assert.deepEqual(normalizedRule.tags, ["security", "credential"]);
  assert.equal(normalizedRule.securitySeverity, 8.7);
});

test("normalizes extension rules and resolves tool-component references", () => {
  const source = sarif();
  source.runs[0].tool.extensions = [{ name: "ExtraRules", rules: [rule("EX001", "note")] }];
  source.runs[0].results = [{ ruleId: "EX001", rule: { id: "EX001", toolComponent: { name: "ExtraRules" } }, message: { text: "Extension finding" }, locations: [location()] }];
  const item = C.analyzeSarif(source).results[0];
  assert.equal(item.rule.componentName, "ExtraRules");
  assert.equal(item.level, "note");
});

test("falls back to rule default level and normalizes invalid levels", () => {
  const source = sarif([result({ level: undefined })]);
  assert.equal(C.analyzeSarif(source).results[0].level, "warning");
  source.runs[0].results[0].level = "fatal";
  assert.equal(C.analyzeSarif(source).results[0].level, "warning");
});

test("normalizes primary locations, logical names, regions, and snippets", () => {
  const item = C.analyzeSarif(sarif()).results[0];
  assert.equal(item.primaryLocation.uri, "file:///workspace/src/app.js");
  assert.equal(item.primaryLocation.logicalName, "app.start");
  assert.deepEqual(item.primaryLocation.region, { startLine: 10, startColumn: 4, endLine: 10, endColumn: 10, charOffset: 0, charLength: 0, snippet: "const token = 'secret'" });
  assert.equal(C.formatRegion(item.primaryLocation.region), "10:4-10:10");
});

test("resolves artifact indexes when a location omits its URI", () => {
  const source = sarif([result({ locations: [{ physicalLocation: { artifactLocation: { index: 0 }, region: { startLine: 3 } } }] })]);
  assert.equal(C.analyzeSarif(source).results[0].primaryLocation.uri, "file:///workspace/src/app.js");
});

test("resolves chained URI bases and prevents credential display", () => {
  const source = sarif();
  source.runs[0].originalUriBaseIds = { ROOT: { uri: "https://user:pass@example.com/repo/" }, SRCROOT: { uri: "src/", uriBaseId: "ROOT" } };
  const uri = C.analyzeSarif(source).results[0].primaryLocation.uri;
  assert.equal(uri, "https://example.com/repo/src/src/app.js");
});

test("handles URI-base cycles without hanging", () => {
  const source = sarif(); source.runs[0].originalUriBaseIds = { SRCROOT: { uri: "src/", uriBaseId: "SRCROOT" } };
  assert.equal(C.analyzeSarif(source).results[0].primaryLocation.uri, "src/src/app.js");
});

test("normalizes and sorts code-flow steps by execution order", () => {
  const steps = C.analyzeSarif(sarif()).results[0].codeFlowSteps;
  assert.deepEqual(steps.map((step) => step.executionOrder), [1, 2]);
  assert.equal(steps[0].uri, "file:///workspace/src/input.js");
  assert.equal(steps[1].importance, "essential");
});

test("recognizes fixes, baseline state, rank, and stable fingerprints", () => {
  const source = sarif([result({ rank: 91.5 })]); const item = C.analyzeSarif(source).results[0];
  assert.equal(item.hasFix, true);
  assert.equal(item.baselineState, "new");
  assert.equal(item.rank, 91.5);
  assert.match(item.fingerprint, /primaryLocationLineHash=stable-hash/);
});

test("normalizes accepted and rejected suppressions", () => {
  const source = sarif([result({ suppressions: [{ kind: "external", status: "accepted", justification: "risk accepted" }] }), result({ partialFingerprints: { id: "two" }, suppressions: [{ kind: "inSource", status: "rejected" }] })]);
  assert.deepEqual(C.analyzeSarif(source).results.map((item) => item.suppressed), [true, false]);
});

test("reports unknown rule references and missing locations", () => {
  const source = sarif([{ ruleId: "MISSING", message: { text: "No location" } }]);
  assert.deepEqual(C.analyzeSarif(source).issues.map((item) => item.code), ["rule-ref", "location"]);
});

test("reports malformed runs, drivers, results arrays, and result entries", () => {
  const source = { version: "2.1.0", runs: [null, { tool: { driver: {} }, results: {} }, { tool: { driver: { name: "Tool" } }, results: [null] }] };
  const codes = C.analyzeSarif(source).issues.map((item) => item.code);
  assert.ok(codes.includes("run")); assert.ok(codes.includes("driver")); assert.ok(codes.includes("results")); assert.ok(codes.includes("result"));
});

test("summarizes levels, runs, tools, rules, files, suppression, flows, fixes, and baseline", () => {
  const secondRun = sarif([result({ level: "note", partialFingerprints: { id: "second" }, suppressions: [{ kind: "external" }], baselineState: "unchanged", codeFlows: [], fixes: [] })]).runs[0];
  secondRun.tool.driver.name = "LintScan";
  const source = sarif(); source.runs.push(secondRun);
  const summary = C.analyzeSarif(source).summary;
  assert.equal(summary.runCount, 2); assert.equal(summary.resultCount, 2); assert.equal(summary.toolCount, 2); assert.equal(summary.ruleCount, 2); assert.equal(summary.fileCount, 1);
  assert.equal(summary.suppressedCount, 1); assert.equal(summary.codeFlowCount, 1); assert.equal(summary.fixCount, 1); assert.equal(summary.baselineNewCount, 1);
  assert.deepEqual(summary.levelCounts, { error: 1, warning: 0, note: 1, none: 0 });
});

test("filters results by level, tool, rule, file, baseline, suppression, flow, and search", () => {
  const source = sarif([result(), result({ ruleId: "STYLE001", ruleIndex: 1, level: "note", message: { text: "Naming style" }, locations: [location("src/style.js", 4, 1)], partialFingerprints: { id: "style" }, baselineState: "unchanged", codeFlows: [], fixes: [], suppressions: [{ kind: "external" }] })]);
  source.runs[0].tool.driver.rules.push(rule("STYLE001", "note")); const results = C.analyzeSarif(source).results;
  assert.equal(C.filterResults(results, { level: "error" }).length, 1);
  assert.equal(C.filterResults(results, { tool: "CodeScan" }).length, 2);
  assert.equal(C.filterResults(results, { rule: "STYLE001" }).length, 1);
  assert.equal(C.filterResults(results, { file: "file:///workspace/src/style.js" }).length, 1);
  assert.equal(C.filterResults(results, { baseline: "new" }).length, 1);
  assert.equal(C.filterResults(results, { suppressed: "yes" }).length, 1);
  assert.equal(C.filterResults(results, { suppressed: "no" }).length, 1);
  assert.equal(C.filterResults(results, { hasFlow: "yes" }).length, 1);
  assert.equal(C.filterResults(results, { query: "naming style" }).length, 1);
});

test("compares stable fingerprint matches as unchanged", () => {
  const report = C.analyzeSarif(sarif());
  assert.deepEqual(C.compareSarif(report, report).summary, { added: 0, removed: 0, updated: 0, unchanged: 1 });
});

test("compares changed level, message, location, and suppression as updates", () => {
  const before = sarif(); const after = sarif();
  after.runs[0].results[0].level = "warning"; after.runs[0].results[0].message.text = "Updated message"; after.runs[0].results[0].locations = [location("src/app.js", 12, 4)]; after.runs[0].results[0].suppressions = [{ kind: "external" }];
  const diff = C.compareSarif(before, after);
  assert.deepEqual(diff.summary, { added: 0, removed: 0, updated: 1, unchanged: 0 });
  assert.deepEqual(diff.updated[0].changes.map((item) => item.field), ["level", "message", "location", "suppressed"]);
});

test("compares unmatched fingerprints as added and removed", () => {
  const before = sarif(); const after = sarif(); after.runs[0].results[0].partialFingerprints.primaryLocationLineHash = "different";
  assert.deepEqual(C.compareSarif(before, after).summary, { added: 1, removed: 1, updated: 0, unchanged: 0 });
});

test("uses rule and primary location as comparison fallback without fingerprints", () => {
  const before = sarif([result({ partialFingerprints: undefined })]); const after = sarif([result({ partialFingerprints: undefined, message: { text: "Changed" } })]);
  assert.equal(C.compareSarif(before, after).summary.updated, 1);
});

test("comparison preserves duplicate occurrences sharing one identity", () => {
  const one = result(); const two = result({ message: { text: "Second occurrence" } });
  const before = sarif([one, two]); const after = sarif([one]);
  assert.deepEqual(C.compareSarif(before, after).summary, { added: 0, removed: 1, updated: 0, unchanged: 1 });
});

test("sanitized export strips invocations, URI bases, web traffic, artifacts, fixes, attachments, and snippets", () => {
  const source = sarif(); const run = source.runs[0]; const item = run.results[0];
  run.invocations = [{ commandLine: "scanner --token secret", environmentVariables: { TOKEN: "secret" } }]; run.webRequests = [{ headers: { Authorization: "secret" } }]; run.webResponses = [{ statusCode: 200 }];
  item.attachments = [{ description: { text: "private" } }]; item.webRequest = { headers: { Cookie: "secret" } }; item.webResponse = { body: "private" };
  const clean = C.sanitizeSarif(source); const cleanRun = clean.runs[0]; const cleanResult = cleanRun.results[0];
  assert.equal("invocations" in cleanRun, false); assert.equal("originalUriBaseIds" in cleanRun, false); assert.equal("webRequests" in cleanRun, false); assert.equal("webResponses" in cleanRun, false);
  assert.equal("contents" in cleanRun.artifacts[0], false); assert.equal("fixes" in cleanResult, false); assert.equal("attachments" in cleanResult, false); assert.equal("webRequest" in cleanResult, false); assert.equal("webResponse" in cleanResult, false);
  assert.equal("snippet" in cleanResult.locations[0].physicalLocation.region, false);
});

test("sanitized export removes URI credentials, queries, and fragments", () => {
  const source = sarif(); source.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri = "https://user:pass@example.com/app.js?token=secret#L1";
  assert.equal(C.sanitizeSarif(source).runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, "https://example.com/app.js");
});

test("sanitizer options can retain snippets, fixes, invocations, URI bases, and queries", () => {
  const source = sarif(); source.runs[0].invocations = [{ commandLine: "scanner" }]; source.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri = "src/app.js?view=1";
  const clean = C.sanitizeSarif(source, { stripSnippets: false, stripFixes: false, stripInvocationDetails: false, stripUriBases: false, stripUriQueries: false });
  assert.ok(clean.runs[0].invocations); assert.ok(clean.runs[0].originalUriBaseIds); assert.ok(clean.runs[0].results[0].fixes); assert.ok(clean.runs[0].results[0].locations[0].physicalLocation.region.snippet); assert.match(clean.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, /\?view=1/);
});

test("sanitization does not mutate the imported document", () => {
  const source = sarif(); const before = JSON.stringify(source); C.sanitizeSarif(source); assert.equal(JSON.stringify(source), before);
});

test("formats regions and locations with missing or complete coordinates", () => {
  assert.equal(C.formatRegion({ startLine: 7, startColumn: 2 }), "7:2");
  assert.equal(C.formatRegion({ startLine: 7, startColumn: 2, endLine: 8, endColumn: 3 }), "7:2-8:3");
  assert.equal(C.formatRegion({}), "");
  assert.equal(C.formatLocation({ uri: "a.js", region: { startLine: 1 } }), "a.js:1");
});

test("exports stable quoted CSV with formula injection protection", () => {
  const results = C.analyzeSarif(sarif()).results; results[0].message = "=cmd,\"quoted\"";
  const csv = C.resultsToCsv(results);
  assert.match(csv, /^"tool","toolVersion"/);
  assert.match(csv, /"'=cmd,""quoted"""/);
  assert.equal(csv.endsWith("\n"), true);
});

test("message fallback displays markdown and message identifiers as plain text", () => {
  const source = sarif([result({ message: { markdown: "**bold**" } }), result({ partialFingerprints: { id: "two" }, message: { id: "msg-id" } })]);
  assert.deepEqual(C.analyzeSarif(source).results.map((item) => item.message), ["**bold**", "[message id: msg-id]"]);
});
