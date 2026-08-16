"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const S = require("../src/core.js");

function cdxComponent(name, version, ref = `${name}@${version}`) {
  return {
    type: "library", name, version, "bom-ref": ref, purl: `pkg:npm/${name}@${version}`,
    supplier: { name: "Example Org" }, licenses: [{ license: { id: "MIT" } }], hashes: [{ alg: "SHA-256", content: "a".repeat(64) }],
  };
}

function cdx(components = [cdxComponent("app", "1.0.0", "app"), cdxComponent("lib", "2.0.0", "lib")]) {
  return {
    bomFormat: "CycloneDX", specVersion: "1.7", serialNumber: "urn:uuid:test",
    metadata: { timestamp: "2026-08-16T00:00:00Z", tools: { components: [{ name: "generator" }] }, component: components[0] },
    components: components.slice(1), dependencies: [{ ref: components[0]["bom-ref"], dependsOn: components.slice(1).map((item) => item["bom-ref"]) }],
  };
}

function spdx(packages = [
  { SPDXID: "SPDXRef-App", name: "app", versionInfo: "1.0.0", primaryPackagePurpose: "APPLICATION", licenseDeclared: "Apache-2.0", licenseConcluded: "Apache-2.0", supplier: "Organization: Example Org", checksums: [{ algorithm: "SHA256", checksumValue: "b".repeat(64) }], externalRefs: [{ referenceType: "purl", referenceLocator: "pkg:npm/app@1.0.0" }] },
  { SPDXID: "SPDXRef-Lib", name: "lib", versionInfo: "2.0.0", primaryPackagePurpose: "LIBRARY", licenseDeclared: "MIT", licenseConcluded: "MIT", externalRefs: [{ referenceType: "cpe23Type", referenceLocator: "cpe:2.3:a:example:lib:2.0.0:*:*:*:*:*:*:*" }] },
]) {
  return {
    spdxVersion: "SPDX-2.3", SPDXID: "SPDXRef-DOCUMENT", name: "Example SPDX", documentNamespace: "https://example.com/spdx/test",
    creationInfo: { created: "2026-08-16T00:00:00Z", creators: ["Tool: generator-1.0", "Organization: Example Org"] }, packages,
    relationships: [{ spdxElementId: "SPDXRef-DOCUMENT", relationshipType: "DESCRIBES", relatedSpdxElement: packages[0].SPDXID }, { spdxElementId: packages[0].SPDXID, relationshipType: "DEPENDS_ON", relatedSpdxElement: packages[1].SPDXID }],
  };
}

test("parses JSON text and objects without mutating input", () => {
  const source = cdx(); const before = JSON.stringify(source);
  assert.equal(S.parseDocument(source), source);
  assert.equal(S.parseDocument("\uFEFF" + before).bomFormat, "CycloneDX");
  S.analyzeSbom(source); assert.equal(JSON.stringify(source), before);
});

test("rejects empty, malformed, array, and unknown SBOM documents", () => {
  assert.throws(() => S.parseDocument(""), /empty/);
  assert.throws(() => S.parseDocument("{bad}"), /Invalid SBOM JSON/);
  assert.throws(() => S.parseDocument([]), /JSON object/);
  assert.throws(() => S.detectFormat({ components: [] }), /Unsupported SBOM/);
});

test("detects CycloneDX and SPDX format versions", () => {
  assert.deepEqual(S.detectFormat(cdx()), { format: "CycloneDX", version: "1.7" });
  assert.deepEqual(S.detectFormat(spdx()), { format: "SPDX", version: "2.3" });
});

test("normalizes CycloneDX root metadata and dependency components", () => {
  const report = S.analyzeSbom(cdx());
  assert.equal(report.format, "CycloneDX");
  assert.equal(report.metadata.name, "app");
  assert.equal(report.metadata.toolCount, 1);
  assert.deepEqual(report.rootIds, ["app"]);
  assert.deepEqual(report.components.map((item) => item.id), ["app", "lib"]);
});

test("normalizes CycloneDX identities, suppliers, licenses, hashes, and references", () => {
  const raw = cdxComponent("lib", "2.0.0", "lib");
  raw.externalReferences = [{ type: "website", url: "https://example.com/lib" }];
  const component = S.analyzeSbom(cdx([cdxComponent("app", "1", "app"), raw])).components[1];
  assert.equal(component.purl, "pkg:npm/lib@2.0.0");
  assert.equal(component.supplier, "Example Org");
  assert.deepEqual(component.licenses, ["MIT"]);
  assert.equal(component.hashes[0].algorithm, "SHA-256");
  assert.deepEqual(component.externalReferences, [{ type: "website", url: "https://example.com/lib" }]);
});

test("flattens nested CycloneDX components without inventing dependency edges", () => {
  const root = cdxComponent("app", "1", "app");
  root.components = [cdxComponent("embedded", "1", "embedded")];
  const source = cdx([root]); source.dependencies = [];
  const report = S.analyzeSbom(source);
  assert.equal(report.components.length, 2);
  assert.equal(report.edges.length, 0);
});

test("generates identifiers and warnings for CycloneDX components without bom-ref", () => {
  const source = cdx([{ type: "application", name: "app", version: "1" }]); source.dependencies = [];
  const report = S.analyzeSbom(source);
  assert.match(report.components[0].id, /^generated:cdx:/);
  assert.ok(report.issues.some((item) => item.code === "component-ref"));
});

test("detects cyclic component objects passed through the JavaScript API", () => {
  const root = cdxComponent("app", "1", "app"); root.components = [root];
  const source = cdx([root]); source.dependencies = [];
  assert.ok(S.analyzeSbom(source).issues.some((item) => item.code === "component-cycle"));
});

test("warns about unsupported CycloneDX versions and absent components", () => {
  const source = { bomFormat: "CycloneDX", specVersion: "1.1", metadata: {} };
  assert.deepEqual(S.analyzeSbom(source).issues.slice(0, 2).map((item) => item.code), ["version", "components"]);
});

test("builds dependency counts, direct dependencies, depth, and shortest paths", () => {
  const app = cdxComponent("app", "1", "app"); const a = cdxComponent("a", "1", "a"); const b = cdxComponent("b", "1", "b");
  const source = cdx([app, a, b]); source.dependencies = [{ ref: "app", dependsOn: ["a"] }, { ref: "a", dependsOn: ["b"] }];
  const report = S.analyzeSbom(source);
  assert.equal(report.summary.dependencyCount, 2);
  assert.equal(report.summary.directDependencyCount, 1);
  assert.equal(report.summary.maxDepth, 2);
  assert.deepEqual(S.shortestPath(report, "b"), ["app", "a", "b"]);
  assert.deepEqual(S.shortestPath(report, "missing"), []);
});

test("deduplicates repeated dependency edges", () => {
  const source = cdx(); source.dependencies[0].dependsOn.push("lib");
  assert.equal(S.analyzeSbom(source).summary.dependencyCount, 1);
});

test("reports dangling dependency references", () => {
  const source = cdx(); source.dependencies.push({ ref: "lib", dependsOn: ["missing"] });
  const report = S.analyzeSbom(source);
  assert.ok(report.issues.some((item) => item.code === "dangling-edge"));
  assert.equal(report.edges.length, 1);
});

test("reports duplicate component identifiers", () => {
  const source = cdx([cdxComponent("app", "1", "same"), cdxComponent("lib", "1", "same")]);
  assert.ok(S.analyzeSbom(source).issues.some((item) => item.code === "duplicate-id"));
});

test("detects dependency cycles without recursive traversal", () => {
  const source = cdx(); source.dependencies = [{ ref: "app", dependsOn: ["lib"] }, { ref: "lib", dependsOn: ["app"] }];
  const report = S.analyzeSbom(source);
  assert.equal(report.cycles.length, 1);
  assert.ok(report.findings.some((item) => item.code === "cycles"));
});

test("identifies components unreachable from an explicit root", () => {
  const source = cdx([cdxComponent("app", "1", "app"), cdxComponent("lib", "1", "lib"), cdxComponent("orphan", "1", "orphan")]);
  source.dependencies = [{ ref: "app", dependsOn: ["lib"] }];
  const report = S.analyzeSbom(source);
  assert.equal(report.summary.unreachableCount, 1);
  assert.equal(report.components.find((item) => item.id === "orphan").reachable, false);
});

test("computes transparent metadata coverage and aggregate findings", () => {
  const root = { type: "application", name: "app", "bom-ref": "app", licenses: [{ expression: "NOASSERTION" }] };
  const source = cdx([root]); source.dependencies = [];
  const report = S.analyzeSbom(source);
  assert.deepEqual(report.coverage, { version: 0, license: 0, purl: 0, hash: 0, supplier: 0, overall: 0 });
  assert.ok(report.findings.some((item) => item.code === "license-coverage"));
  assert.ok(report.findings.some((item) => item.code === "version-coverage"));
});

test("normalizes CycloneDX vulnerabilities, VEX state, and affected components", () => {
  const source = cdx();
  source.vulnerabilities = [{ id: "CVE-2026-0001", source: { name: "NVD" }, ratings: [{ severity: "critical", score: 9.8 }], affects: [{ ref: "lib" }], analysis: { state: "exploitable", justification: "requires_configuration" } }];
  const report = S.analyzeSbom(source); const vulnerability = report.vulnerabilities[0];
  assert.equal(vulnerability.severity, "critical");
  assert.equal(vulnerability.score, 9.8);
  assert.equal(vulnerability.state, "exploitable");
  assert.equal(report.components[1].vulnerabilities.length, 1);
  assert.equal(report.findings[0].code, "vulnerability");
});

test("reports vulnerability references to unknown components", () => {
  const source = cdx(); source.vulnerabilities = [{ id: "CVE-X", affects: [{ ref: "missing" }] }];
  assert.ok(S.analyzeSbom(source).issues.some((item) => item.code === "vulnerability-ref"));
});

test("derives vulnerability severity from a numeric score when needed", () => {
  const source = cdx(); source.vulnerabilities = [{ id: "CVE-SCORE", ratings: [{ score: 8.2 }], affects: [{ ref: "lib" }] }];
  assert.equal(S.analyzeSbom(source).vulnerabilities[0].severity, "high");
});

test("normalizes SPDX packages, metadata, purl, CPE, suppliers, licenses, and checksums", () => {
  const report = S.analyzeSbom(spdx()); const app = report.components[0]; const lib = report.components[1];
  assert.equal(report.format, "SPDX");
  assert.equal(report.metadata.name, "Example SPDX");
  assert.equal(report.metadata.toolCount, 1);
  assert.equal(app.purl, "pkg:npm/app@1.0.0");
  assert.equal(lib.cpe.startsWith("cpe:2.3"), true);
  assert.equal(app.supplier, "Example Org");
  assert.deepEqual(app.licenses, ["Apache-2.0"]);
  assert.equal(app.hashes[0].algorithm, "SHA256");
});

test("normalizes SPDX DEPENDS_ON and reverse DEPENDENCY_OF relationships", () => {
  const source = spdx();
  source.relationships.push({ spdxElementId: "SPDXRef-Tool", relationshipType: "BUILD_DEPENDENCY_OF", relatedSpdxElement: "SPDXRef-Lib" });
  source.packages.push({ SPDXID: "SPDXRef-Tool", name: "tool", versionInfo: "1" });
  const report = S.analyzeSbom(source);
  assert.ok(report.edges.some((edge) => edge.from === "SPDXRef-App" && edge.to === "SPDXRef-Lib"));
  assert.ok(report.edges.some((edge) => edge.from === "SPDXRef-Lib" && edge.to === "SPDXRef-Tool"));
});

test("uses SPDX documentDescribes and DESCRIBED_BY roots", () => {
  const source = spdx(); source.documentDescribes = ["SPDXRef-Lib"]; source.relationships = [{ spdxElementId: "SPDXRef-App", relationshipType: "DESCRIBED_BY", relatedSpdxElement: "SPDXRef-DOCUMENT" }];
  assert.deepEqual(S.analyzeSbom(source).rootIds.sort(), ["SPDXRef-App", "SPDXRef-Lib"]);
});

test("infers SPDX roots from dependency indegree when no subject is explicit", () => {
  const source = spdx(); source.relationships = [{ spdxElementId: "SPDXRef-App", relationshipType: "DEPENDS_ON", relatedSpdxElement: "SPDXRef-Lib" }];
  const report = S.analyzeSbom(source);
  assert.deepEqual(report.rootIds, ["SPDXRef-App"]);
  assert.ok(report.issues.some((item) => item.code === "inferred-roots"));
});

test("warns about unsupported SPDX versions, absent packages, and malformed relationships", () => {
  const source = { spdxVersion: "SPDX-2.1", relationships: [{}] };
  const codes = S.analyzeSbom(source).issues.map((item) => item.code);
  assert.ok(codes.includes("version")); assert.ok(codes.includes("packages")); assert.ok(codes.includes("relationship"));
});

test("generates identifiers for SPDX packages without SPDXID", () => {
  const source = spdx(); source.packages = [{ name: "anonymous" }]; source.relationships = [];
  const report = S.analyzeSbom(source);
  assert.match(report.components[0].id, /^generated:spdx:/);
  assert.ok(report.issues.some((item) => item.code === "package-id"));
});

test("distinguishes declared, missing, NONE, and NOASSERTION license states", () => {
  const packages = ["MIT", "", "NONE", "NOASSERTION"].map((license, index) => ({ SPDXID: `SPDXRef-${index}`, name: `p${index}`, licenseDeclared: license, licenseConcluded: license }));
  const source = spdx(packages); source.relationships = [];
  assert.deepEqual(S.analyzeSbom(source).components.map((item) => item.licenseState), ["declared", "missing", "none", "noassertion"]);
});

test("counts an SPDX declared license when the concluded value is NOASSERTION", () => {
  const source = spdx(); source.packages[0].licenseConcluded = "NOASSERTION";
  assert.equal(S.analyzeSbom(source).components[0].licenseState, "declared");
});

test("filters components by query, type, license, reachability, and vulnerability", () => {
  const source = cdx([cdxComponent("app", "1", "app"), cdxComponent("lib", "2", "lib"), cdxComponent("orphan", "3", "orphan")]);
  source.dependencies = [{ ref: "app", dependsOn: ["lib"] }]; source.vulnerabilities = [{ id: "CVE-X", ratings: [{ severity: "low" }], affects: [{ ref: "lib" }] }];
  const components = S.analyzeSbom(source).components;
  assert.equal(S.filterComponents(components, { query: "pkg:npm/lib" }).length, 1);
  assert.equal(S.filterComponents(components, { type: "library" }).length, 3);
  assert.equal(S.filterComponents(components, { license: "declared" }).length, 3);
  assert.equal(S.filterComponents(components, { reachability: "unreachable" }).length, 1);
  assert.equal(S.filterComponents(components, { vulnerable: "yes" }).length, 1);
});

test("compares added, removed, changed, and unchanged components", () => {
  const before = cdx([cdxComponent("app", "1", "app"), cdxComponent("alpha", "1", "alpha"), cdxComponent("gone", "1", "gone")]);
  const changed = cdxComponent("alpha", "2", "alpha2"); changed.licenses = [{ license: { id: "Apache-2.0" } }];
  const after = cdx([cdxComponent("app", "1", "app"), changed, cdxComponent("new", "1", "new")]);
  const diff = S.compareSboms(before, after);
  assert.deepEqual(diff.summary, { added: 1, removed: 1, changed: 1, unchanged: 1 });
  assert.deepEqual(diff.changed[0].changes.map((item) => item.field), ["version", "licenses"]);
});

test("comparison accepts already analyzed reports", () => {
  const report = S.analyzeSbom(cdx());
  assert.deepEqual(S.compareSboms(report, report).summary, { added: 0, removed: 0, changed: 0, unchanged: 2 });
});

test("comparison handles multiple versions of the same package without collapsing them", () => {
  const app = cdxComponent("app", "1", "app");
  const before = cdx([app, cdxComponent("lib", "1", "lib1"), cdxComponent("lib", "2", "lib2")]);
  const after = cdx([app, cdxComponent("lib", "2", "lib2"), cdxComponent("lib", "3", "lib3")]);
  const summary = S.compareSboms(before, after).summary;
  assert.equal(summary.added, 1); assert.equal(summary.removed, 1); assert.equal(summary.unchanged, 2);
});

test("exports quoted CSV with spreadsheet formula protection", () => {
  const report = S.analyzeSbom(cdx()); report.components[0].name = "=1+1,\"formula\"";
  const csv = S.componentsToCsv(report.components);
  assert.match(csv, /^"id","name"/);
  assert.match(csv, /"'=1\+1,""formula"""/);
  assert.equal(csv.endsWith("\n"), true);
});

test("findings prioritize errors before warnings and information", () => {
  const source = cdx(); source.dependencies.push({ ref: "lib", dependsOn: ["missing"] });
  const findings = S.analyzeSbom(source).findings;
  const rank = { error: 0, warning: 1, info: 2 };
  assert.deepEqual(findings.map((item) => rank[item.severity]), findings.map((item) => rank[item.severity]).slice().sort());
});
