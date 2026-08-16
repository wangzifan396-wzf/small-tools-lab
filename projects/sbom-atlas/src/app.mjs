const Core = window.SbomAtlas;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const state = { report: null, selectedId: null, fileName: "sbom.json", comparison: null, compareName: "" };
const $ = (id) => document.getElementById(id);
const elements = {
  importPanel: $("import-panel"), dashboard: $("dashboard"), status: $("status"), primaryFile: $("primary-file"), compareFile: $("compare-file"), drop: $("drop-zone"), sampleCdx: $("sample-cdx"), sampleSpdx: $("sample-spdx"), theme: $("theme"),
  fileName: $("file-name"), documentMeta: $("document-meta"), openAnother: $("open-another"), compare: $("compare"), exportCsv: $("export-csv"), componentCount: $("component-count"), dependencyCount: $("dependency-count"), rootCount: $("root-count"), vulnerabilityCount: $("vulnerability-count"), coverageScore: $("coverage-score"), coverage: $("coverage"),
  diffPanel: $("diff-panel"), compareName: $("compare-name"), diffSummary: $("diff-summary"), diffList: $("diff-list"), closeDiff: $("close-diff"), search: $("search"), typeFilter: $("type-filter"), licenseFilter: $("license-filter"), reachFilter: $("reach-filter"), vulnerabilityFilter: $("vulnerability-filter"), resetFilters: $("reset-filters"), componentList: $("component-list"), componentEmpty: $("component-empty"), visibleCount: $("visible-count"), findings: $("findings"), findingEmpty: $("finding-empty"), findingCount: $("finding-count"), detail: $("detail"),
};

function component(ref, name, version, type, options = {}) {
  const value = { type, name, version, "bom-ref": ref, purl: `pkg:${options.ecosystem || "npm"}/${name}@${version}` };
  if (options.group) value.group = options.group;
  if (options.license !== null) value.licenses = [{ license: { id: options.license || "MIT" } }];
  if (options.hash !== false) value.hashes = [{ alg: "SHA-256", content: (options.hashChar || "a").repeat(64) }];
  if (options.supplier !== false) value.supplier = { name: options.supplier || "Atlas Example" };
  if (options.noPurl) delete value.purl;
  return value;
}

function sampleCycloneDx(updated = false) {
  const app = component("app", "atlas-store", "3.4.0", "application", { license: "Apache-2.0", hashChar: "1" });
  const react = component("react", "react", "19.1.1", "library", { hashChar: "2" });
  const lodash = component("lodash", "lodash", updated ? "4.17.22" : "4.17.21", "library", { hash: updated, hashChar: "3" });
  const express = component("express", "express", "5.1.0", "framework", { license: updated ? "MIT" : null, hashChar: "4" });
  const pg = component("pg", "pg", "8.16.3", "library", { ecosystem: "npm", license: "MIT", hashChar: "5" });
  const internal = component("internal-auth", "internal-auth", "2.8.0", "library", { license: updated ? "LicenseRef-Proprietary" : null, hash: false, supplier: "Example Engineering", noPurl: true });
  const orphan = component("orphan", "old-metrics-adapter", "0.8.0", "library", { license: null, hash: false, supplier: false, noPurl: true });
  const zod = component("zod", "zod", "4.0.17", "library", { hashChar: "6" });
  const components = [react, lodash, express, pg, internal, ...(updated ? [zod] : [orphan])];
  const dependencies = [
    { ref: "app", dependsOn: ["react", "express", "internal-auth", ...(updated ? ["zod"] : [])] },
    { ref: "react", dependsOn: ["lodash"] }, { ref: "express", dependsOn: ["lodash", "pg"] },
    { ref: "lodash", dependsOn: [] }, { ref: "pg", dependsOn: [] }, { ref: "internal-auth", dependsOn: [] },
  ];
  if (updated) dependencies.push({ ref: "zod", dependsOn: [] });
  return {
    bomFormat: "CycloneDX", specVersion: "1.7", serialNumber: updated ? "urn:uuid:atlas-release-341" : "urn:uuid:atlas-release-340",
    metadata: { timestamp: updated ? "2026-08-16T12:00:00Z" : "2026-08-10T12:00:00Z", tools: { components: [{ type: "application", name: "syft", version: "1.30.0" }] }, component: app }, components, dependencies,
    vulnerabilities: updated ? [] : [{ id: "CVE-2026-ATLAS", source: { name: "Example advisory" }, ratings: [{ severity: "high", score: 8.1 }], affects: [{ ref: "lodash" }], analysis: { state: "in_triage" }, description: "Demonstration vulnerability for the local sample." }],
  };
}

function sampleSpdx() {
  const pkg = (id, name, version, purpose, license, purl) => ({ SPDXID: id, name, versionInfo: version, primaryPackagePurpose: purpose, licenseDeclared: license, licenseConcluded: license, supplier: "Organization: Atlas Example", checksums: [{ algorithm: "SHA256", checksumValue: id.slice(-1).repeat(64) }], externalRefs: purl ? [{ referenceCategory: "PACKAGE-MANAGER", referenceType: "purl", referenceLocator: purl }] : [] });
  const packages = [pkg("SPDXRef-App", "payments-service", "2.6.0", "APPLICATION", "Apache-2.0", "pkg:docker/payments-service@2.6.0"), pkg("SPDXRef-Fastify", "fastify", "5.5.0", "FRAMEWORK", "MIT", "pkg:npm/fastify@5.5.0"), pkg("SPDXRef-Pino", "pino", "9.9.0", "LIBRARY", "MIT", "pkg:npm/pino@9.9.0"), pkg("SPDXRef-Driver", "database-driver", "1.4.0", "LIBRARY", "NOASSERTION", "")];
  return { spdxVersion: "SPDX-2.3", SPDXID: "SPDXRef-DOCUMENT", name: "Payments service SBOM", documentNamespace: "https://example.invalid/spdx/payments-2.6.0", creationInfo: { created: "2026-08-16T10:30:00Z", creators: ["Tool: spdx-sbom-generator-0.0.17", "Organization: Atlas Example"] }, packages, relationships: [{ spdxElementId: "SPDXRef-DOCUMENT", relationshipType: "DESCRIBES", relatedSpdxElement: "SPDXRef-App" }, { spdxElementId: "SPDXRef-App", relationshipType: "DEPENDS_ON", relatedSpdxElement: "SPDXRef-Fastify" }, { spdxElementId: "SPDXRef-App", relationshipType: "DEPENDS_ON", relatedSpdxElement: "SPDXRef-Driver" }, { spdxElementId: "SPDXRef-Pino", relationshipType: "RUNTIME_DEPENDENCY_OF", relatedSpdxElement: "SPDXRef-Fastify" }] };
}

function setStatus(message, kind = "") { elements.status.textContent = message; elements.status.className = `status ${kind}`.trim(); }
function option(value, label) { const item = document.createElement("option"); item.value = value; item.textContent = label; return item; }

function populateTypes() {
  const types = [...new Set(state.report.components.map((item) => item.type))].sort();
  elements.typeFilter.replaceChildren(option("all", "All types")); types.forEach((type) => elements.typeFilter.append(option(type, type)));
}

function resetFilters() { elements.search.value = ""; elements.typeFilter.value = "all"; elements.licenseFilter.value = "all"; elements.reachFilter.value = "all"; elements.vulnerabilityFilter.value = "all"; }

function loadPrimary(source, fileName) {
  try {
    state.report = Core.analyzeSbom(source); state.fileName = fileName || "sbom.json"; state.selectedId = state.report.rootIds[0] || state.report.components[0]?.id || null; state.comparison = null; state.compareName = "";
    populateTypes(); resetFilters(); elements.importPanel.hidden = true; elements.dashboard.hidden = false; elements.diffPanel.hidden = true; setStatus(""); render();
  } catch (error) { setStatus(error instanceof Error ? error.message : "Could not analyze this SBOM.", "error"); }
}

function loadComparison(source, fileName) {
  try { state.comparison = Core.compareSboms(state.report, source); state.compareName = fileName || "comparison.json"; elements.diffPanel.hidden = false; setStatus(`Compared current inventory with ${state.compareName}.`, "ok"); renderDiff(); elements.diffPanel.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  catch (error) { setStatus(error instanceof Error ? error.message : "Could not compare this SBOM.", "error"); }
}

function render() {
  const { report } = state; const { summary } = report;
  elements.fileName.textContent = state.fileName; elements.documentMeta.textContent = `${report.format} ${report.version} · ${report.metadata.name} · ${report.issues.length} parser ${report.issues.length === 1 ? "notice" : "notices"}`;
  elements.componentCount.textContent = String(summary.componentCount); elements.dependencyCount.textContent = String(summary.dependencyCount); elements.rootCount.textContent = String(summary.rootCount); elements.vulnerabilityCount.textContent = String(summary.vulnerabilityCount); elements.coverageScore.textContent = `${report.coverage.overall}%`;
  renderCoverage(); renderComponents(); renderFindings(); renderDetail();
}

function renderCoverage() {
  elements.coverage.replaceChildren(); const labels = { version: "Versions", license: "Licenses", purl: "PURLs", hash: "Hashes", supplier: "Suppliers" };
  Object.keys(labels).forEach((key) => { const item = document.createElement("div"); item.className = "coverage-item"; const heading = document.createElement("div"); const label = document.createElement("span"); label.textContent = labels[key]; const value = document.createElement("strong"); value.textContent = `${state.report.coverage[key]}%`; heading.append(label, value); const progress = document.createElement("progress"); progress.max = 100; progress.value = state.report.coverage[key]; progress.setAttribute("aria-label", `${labels[key]} ${state.report.coverage[key]} percent`); item.append(heading, progress); elements.coverage.append(item); });
}

function filters() { return { query: elements.search.value.trim(), type: elements.typeFilter.value, license: elements.licenseFilter.value, reachability: elements.reachFilter.value, vulnerable: elements.vulnerabilityFilter.value }; }
function filteredComponents() { return Core.filterComponents(state.report.components, filters()); }

function renderComponents() {
  const visible = filteredComponents(); elements.componentList.replaceChildren(); elements.visibleCount.textContent = String(visible.length); elements.componentEmpty.hidden = visible.length !== 0;
  visible.forEach((component) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "component-row"; button.setAttribute("role", "listitem"); if (component.id === state.selectedId) button.classList.add("selected");
    const copy = document.createElement("span"); copy.className = "component-copy"; const name = document.createElement("strong"); name.textContent = `${component.name}${component.version ? ` @ ${component.version}` : ""}`; const identity = document.createElement("small"); identity.textContent = component.purl || component.id; copy.append(name, identity);
    const type = document.createElement("span"); type.className = "tag"; type.textContent = component.type;
    const license = document.createElement("span"); license.className = `tag ${component.licenseState}`; license.textContent = component.licenses[0] || component.licenseState;
    const depth = document.createElement("span"); depth.className = "metric"; depth.textContent = component.depth === null ? "outside" : component.isRoot ? "root" : String(component.depth);
    const dependencies = document.createElement("span"); dependencies.className = "metric"; dependencies.textContent = String(component.dependencyIds.length);
    const vulnerabilities = document.createElement("span"); vulnerabilities.className = component.vulnerabilities.length ? "metric vulnerability-badge" : "metric"; vulnerabilities.textContent = component.vulnerabilities.length ? String(component.vulnerabilities.length) : "0";
    button.append(copy, type, license, depth, dependencies, vulnerabilities); button.addEventListener("click", () => { state.selectedId = component.id; renderComponents(); renderDetail(); }); elements.componentList.append(button);
  });
}

function renderFindings() {
  elements.findings.replaceChildren(); elements.findingCount.textContent = String(state.report.findings.length); elements.findingEmpty.hidden = state.report.findings.length !== 0;
  state.report.findings.forEach((finding) => { const button = document.createElement("button"); button.type = "button"; button.className = `finding ${finding.severity}`; const body = document.createElement("span"); const title = document.createElement("strong"); title.textContent = finding.title; const detail = document.createElement("small"); detail.textContent = finding.detail; body.append(title, detail); button.append(body); if (finding.componentId) button.addEventListener("click", () => { state.selectedId = finding.componentId; renderComponents(); renderDetail(); }); elements.findings.append(button); });
}

function fact(label, value) { const item = document.createElement("div"); item.className = "fact"; const key = document.createElement("span"); key.textContent = label; const output = document.createElement("strong"); output.textContent = String(value || "—"); item.append(key, output); return item; }
function pair(label, value) { const row = document.createElement("div"); row.className = "pair"; const key = document.createElement("span"); key.textContent = label; const output = document.createElement("code"); output.textContent = String(value || "—"); row.append(key, output); return row; }
function heading(text) { const title = document.createElement("h3"); title.textContent = text; return title; }

function relationshipList(title, ids) {
  const fragment = document.createDocumentFragment(); fragment.append(heading(title)); const list = document.createElement("div"); list.className = "link-list";
  if (!ids.length) { const empty = document.createElement("span"); empty.className = "empty"; empty.textContent = "None"; list.append(empty); }
  ids.forEach((id) => { const component = state.report.components.find((item) => item.id === id); const button = document.createElement("button"); button.type = "button"; button.className = "component-link"; button.textContent = component ? `${component.name}${component.version ? ` @ ${component.version}` : ""}` : id; button.addEventListener("click", () => { state.selectedId = id; renderComponents(); renderDetail(); }); list.append(button); }); fragment.append(list); return fragment;
}

function renderDetail() {
  elements.detail.replaceChildren(); const component = state.report.components.find((item) => item.id === state.selectedId);
  if (!component) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "Select a component to inspect it."; elements.detail.append(empty); return; }
  const title = document.createElement("h3"); title.className = "detail-title"; title.textContent = `${component.name}${component.version ? ` @ ${component.version}` : ""}`; const subtitle = document.createElement("p"); subtitle.className = "detail-subtitle"; subtitle.textContent = component.purl || component.id;
  const facts = document.createElement("div"); facts.className = "facts"; facts.append(fact("Type", component.type), fact("Supplier", component.supplier), fact("Graph", component.isRoot ? "Root" : component.reachable ? `Depth ${component.depth}` : "Outside roots"), fact("Relationships", `${component.dependencyIds.length} deps / ${component.dependentIds.length} parents`));
  elements.detail.append(title, subtitle, facts);
  const pathIds = Core.shortestPath(state.report, component.id); if (pathIds.length) { const path = document.createElement("div"); path.className = "path"; pathIds.forEach((id) => { const node = document.createElement("span"); node.textContent = state.report.components.find((item) => item.id === id)?.name || id; path.append(node); }); elements.detail.append(heading("Shortest path from root"), path); }
  elements.detail.append(heading("Identity"), pair("Identifier", component.id), pair("PURL", component.purl), pair("CPE", component.cpe), pair("License", component.licenses.join(" OR ") || component.licenseState), pair("Hashes", component.hashes.map((item) => item.algorithm).join(", ") || "None"));
  if (component.vulnerabilities.length) { elements.detail.append(heading("Vulnerabilities / VEX")); component.vulnerabilities.forEach((item) => { const box = document.createElement("div"); box.className = "vulnerability"; const name = document.createElement("strong"); name.textContent = `${item.severity.toUpperCase()} · ${item.id}${item.score === null ? "" : ` · ${item.score}`}`; const meta = document.createElement("span"); meta.textContent = [item.source, item.state && `state: ${item.state}`, item.justification].filter(Boolean).join(" · ") || "No analysis state"; box.append(name, meta); elements.detail.append(box); }); }
  elements.detail.append(relationshipList("Direct dependencies", component.dependencyIds), relationshipList("Used by", component.dependentIds));
}

function summaryItem(label, value) { const item = document.createElement("div"); const name = document.createElement("span"); name.textContent = label; const count = document.createElement("strong"); count.textContent = String(value); item.append(name, count); return item; }
function diffItem(component, detail) { const item = document.createElement("div"); item.className = "diff-item"; const name = document.createElement("strong"); name.textContent = `${component.name}${component.version ? ` @ ${component.version}` : ""}`; const copy = document.createElement("span"); copy.textContent = detail || component.purl || component.type; item.append(name, copy); return item; }

function renderDiff() {
  if (!state.comparison) return; const diff = state.comparison; elements.compareName.textContent = state.compareName; elements.diffSummary.replaceChildren(summaryItem("Added", diff.summary.added), summaryItem("Removed", diff.summary.removed), summaryItem("Changed", diff.summary.changed), summaryItem("Unchanged", diff.summary.unchanged)); elements.diffList.replaceChildren();
  const groups = [{ title: "Added", items: diff.added.map((item) => diffItem(item)) }, { title: "Removed", items: diff.removed.map((item) => diffItem(item)) }, { title: "Changed", items: diff.changed.map((item) => diffItem(item.after, item.changes.map((change) => `${change.field}: ${change.before || "—"} → ${change.after || "—"}`).join(" · "))) }];
  groups.forEach((group) => { const section = document.createElement("section"); section.className = "diff-group"; const title = document.createElement("h3"); title.textContent = `${group.title} (${group.items.length})`; section.append(title); if (!group.items.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "None"; section.append(empty); } else group.items.forEach((item) => section.append(item)); elements.diffList.append(section); });
}

function readFile(file, callback) { if (!file) return; if (file.size > MAX_FILE_SIZE) { setStatus("Choose a JSON SBOM no larger than 20 MB.", "error"); return; } const reader = new FileReader(); reader.onload = () => callback(String(reader.result), file.name); reader.onerror = () => setStatus("The browser could not read this file.", "error"); reader.readAsText(file); }
function openPrimaryPicker() { elements.primaryFile.value = ""; elements.primaryFile.click(); }
function openComparePicker() { elements.compareFile.value = ""; elements.compareFile.click(); }
function safeBaseName(name) { return name.replace(/\.json$/i, "").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "sbom"; }
function download(name, content) { const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

elements.primaryFile.addEventListener("change", () => readFile(elements.primaryFile.files[0], loadPrimary)); elements.compareFile.addEventListener("change", () => readFile(elements.compareFile.files[0], loadComparison)); elements.drop.addEventListener("click", openPrimaryPicker); elements.drop.addEventListener("dragover", (event) => { event.preventDefault(); elements.drop.classList.add("dragging"); }); elements.drop.addEventListener("dragleave", () => elements.drop.classList.remove("dragging")); elements.drop.addEventListener("drop", (event) => { event.preventDefault(); elements.drop.classList.remove("dragging"); readFile(event.dataTransfer.files[0], loadPrimary); });
elements.sampleCdx.addEventListener("click", () => loadPrimary(sampleCycloneDx(), "atlas-store-3.4.0.cdx.json")); elements.sampleSpdx.addEventListener("click", () => loadPrimary(sampleSpdx(), "payments-service-2.6.0.spdx.json")); elements.openAnother.addEventListener("click", openPrimaryPicker); elements.compare.addEventListener("click", openComparePicker); elements.closeDiff.addEventListener("click", () => { state.comparison = null; elements.diffPanel.hidden = true; setStatus(""); }); elements.theme.addEventListener("click", () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; });
[elements.search, elements.typeFilter, elements.licenseFilter, elements.reachFilter, elements.vulnerabilityFilter].forEach((control) => control.addEventListener("input", renderComponents)); elements.resetFilters.addEventListener("click", () => { resetFilters(); renderComponents(); }); elements.exportCsv.addEventListener("click", () => download(`${safeBaseName(state.fileName)}-components.csv`, Core.componentsToCsv(filteredComponents())));

const sampleMode = new URLSearchParams(window.location.search).get("sample");
if (sampleMode !== null) {
  if (sampleMode === "spdx") loadPrimary(sampleSpdx(), "payments-service-2.6.0.spdx.json");
  else { loadPrimary(sampleCycloneDx(), "atlas-store-3.4.0.cdx.json"); if (sampleMode === "compare") loadComparison(sampleCycloneDx(true), "atlas-store-3.4.1.cdx.json"); }
}
