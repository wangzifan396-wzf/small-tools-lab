(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SbomAtlas = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var hasOwn = Function.call.bind(Object.prototype.hasOwnProperty);
  var SEVERITY_ORDER = { unknown: 0, none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  var SPDX_DEPENDENCY_OF = /^(?:BUILD_|DEV_|OPTIONAL_|PROVIDED_|RUNTIME_|TEST_)?DEPENDENCY_OF$/;

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function string(value, fallback) { return typeof value === "string" ? value : fallback || ""; }
  function array(value) { return Array.isArray(value) ? value : []; }
  function unique(values) { return Array.from(new Set(values.filter(Boolean))); }
  function percent(count, total) { return total ? Math.round(count / total * 100) : 100; }
  function issue(severity, code, path, message) { return { severity: severity, code: code, path: path, message: message }; }

  function parseDocument(source) {
    var document = source;
    if (typeof source === "string") {
      var text = source.replace(/^\uFEFF/, "").trim();
      if (!text) throw new SyntaxError("SBOM document is empty");
      try { document = JSON.parse(text); }
      catch (error) { throw new SyntaxError("Invalid SBOM JSON: " + error.message); }
    }
    if (!isObject(document)) throw new TypeError("SBOM root must be a JSON object");
    return document;
  }

  function detectFormat(document) {
    var source = parseDocument(document);
    if (source.bomFormat === "CycloneDX") return { format: "CycloneDX", version: string(source.specVersion, "unknown") };
    if (/^SPDX-2\./.test(string(source.spdxVersion))) return { format: "SPDX", version: source.spdxVersion.replace(/^SPDX-/, "") };
    throw new TypeError("Unsupported SBOM: expected CycloneDX JSON or SPDX 2.x JSON");
  }

  function supplierName(value) {
    if (typeof value === "string") return value.replace(/^(?:Organization|Person):\s*/i, "").trim();
    if (isObject(value)) return string(value.name);
    return "";
  }

  function normalizeHash(item) {
    if (!isObject(item)) return null;
    var algorithm = string(item.alg || item.algorithm).toUpperCase();
    var value = string(item.content || item.checksumValue);
    return algorithm && value ? { algorithm: algorithm, value: value } : null;
  }

  function cdxLicenses(value) {
    return unique(array(value).map(function (item) {
      if (!isObject(item)) return "";
      if (typeof item.expression === "string") return item.expression;
      if (!isObject(item.license)) return "";
      return string(item.license.id) || string(item.license.name);
    }));
  }

  function normalizeCdxComponent(raw, id, isRoot) {
    var component = isObject(raw) ? raw : {};
    var refs = array(component.externalReferences);
    return {
      id: id,
      name: string(component.name, "(unnamed component)"),
      version: string(component.version),
      type: string(component.type, "component").toLowerCase(),
      group: string(component.group),
      namespace: string(component.group),
      purl: string(component.purl),
      cpe: string(component.cpe),
      supplier: supplierName(component.supplier) || supplierName(component.manufacturer) || string(component.publisher),
      licenses: cdxLicenses(component.licenses),
      hashes: array(component.hashes).map(normalizeHash).filter(Boolean),
      scope: string(component.scope),
      description: string(component.description),
      externalReferences: refs.filter(isObject).map(function (item) { return { type: string(item.type), url: string(item.url) }; }),
      isRoot: Boolean(isRoot),
      raw: raw,
    };
  }

  function normalizeSeverity(value) {
    var severity = string(value, "unknown").toLowerCase();
    return hasOwn(SEVERITY_ORDER, severity) ? severity : "unknown";
  }

  function normalizeCdxVulnerability(raw, index) {
    var ratings = array(raw && raw.ratings);
    var severity = ratings.reduce(function (current, rating) {
      var candidate = normalizeSeverity(rating && rating.severity);
      return SEVERITY_ORDER[candidate] > SEVERITY_ORDER[current] ? candidate : current;
    }, "unknown");
    var scores = ratings.map(function (rating) { return rating && typeof rating.score === "number" ? rating.score : null; }).filter(function (score) { return score !== null; });
    var score = scores.length ? Math.max.apply(Math, scores) : null;
    if (severity === "unknown" && score !== null) severity = score >= 9 ? "critical" : score >= 7 ? "high" : score >= 4 ? "medium" : score > 0 ? "low" : "none";
    return {
      id: string(raw && raw.id, "vulnerability-" + (index + 1)),
      severity: severity,
      score: score,
      source: string(raw && raw.source && raw.source.name),
      state: string(raw && raw.analysis && raw.analysis.state),
      justification: string(raw && raw.analysis && raw.analysis.justification),
      affects: unique(array(raw && raw.affects).map(function (item) { return string(item && item.ref); })),
      description: string(raw && (raw.description || raw.detail)),
    };
  }

  function normalizeCycloneDx(document) {
    var issues = [];
    var version = string(document.specVersion, "unknown");
    if (!/^(?:1\.[2-7])$/.test(version)) issues.push(issue("warning", "version", "$.specVersion", "Expected CycloneDX 1.2 through 1.7; attempting compatible parsing of " + version));
    if (!Array.isArray(document.components)) issues.push(issue("warning", "components", "$.components", "CycloneDX components array is missing"));
    var components = [];
    var roots = [];
    var counter = 0;
    var seenObjects = typeof WeakSet === "function" ? new WeakSet() : null;
    var stack = [];
    array(document.components).slice().reverse().forEach(function (component, index, list) { stack.push({ value: component, path: "$.components[" + (list.length - index - 1) + "]", root: false }); });
    if (isObject(document.metadata) && isObject(document.metadata.component)) stack.push({ value: document.metadata.component, path: "$.metadata.component", root: true });
    while (stack.length) {
      var current = stack.pop();
      if (!isObject(current.value)) { issues.push(issue("error", "component", current.path, "Component must be an object")); continue; }
      if (seenObjects && seenObjects.has(current.value)) { issues.push(issue("error", "component-cycle", current.path, "Cyclic or repeated component object was ignored")); continue; }
      if (seenObjects) seenObjects.add(current.value);
      counter += 1;
      var id = string(current.value["bom-ref"]);
      if (!id) { id = "generated:cdx:" + counter; issues.push(issue("warning", "component-ref", current.path + ".[\"bom-ref\"]", "Component has no bom-ref; generated " + id)); }
      var normalized = normalizeCdxComponent(current.value, id, current.root);
      components.push(normalized);
      if (current.root) roots.push(id);
      array(current.value.components).slice().reverse().forEach(function (child, index, list) { stack.push({ value: child, path: current.path + ".components[" + (list.length - index - 1) + "]", root: false }); });
    }
    var edges = [];
    array(document.dependencies).forEach(function (dependency, index) {
      if (!isObject(dependency) || typeof dependency.ref !== "string") { issues.push(issue("warning", "dependency", "$.dependencies[" + index + "]", "Dependency entry requires a ref")); return; }
      array(dependency.dependsOn).forEach(function (target, targetIndex) {
        if (typeof target !== "string") issues.push(issue("warning", "dependency-ref", "$.dependencies[" + index + "].dependsOn[" + targetIndex + "]", "Dependency target must be a string"));
        else edges.push({ from: dependency.ref, to: target, type: "depends-on" });
      });
    });
    return {
      format: "CycloneDX", version: version, document: document, components: components, edges: edges, rootIds: unique(roots),
      vulnerabilities: array(document.vulnerabilities).filter(isObject).map(normalizeCdxVulnerability), issues: issues,
      metadata: { name: string(document.metadata && document.metadata.component && document.metadata.component.name) || string(document.serialNumber, "CycloneDX BOM"), serialNumber: string(document.serialNumber), timestamp: string(document.metadata && document.metadata.timestamp), toolCount: array(document.metadata && document.metadata.tools && (document.metadata.tools.components || document.metadata.tools)).length },
    };
  }

  function spdxExternal(packageItem, kind) {
    var match = array(packageItem && packageItem.externalRefs).find(function (item) {
      var type = string(item && item.referenceType).toLowerCase();
      var locator = string(item && item.referenceLocator);
      return type.includes(kind) || locator.toLowerCase().startsWith(kind === "purl" ? "pkg:" : "cpe:");
    });
    return match ? string(match.referenceLocator) : "";
  }

  function spdxLicenses(packageItem) {
    return unique([string(packageItem.licenseConcluded), string(packageItem.licenseDeclared)]);
  }

  function normalizeSpdxPackage(raw, id) {
    var packageItem = isObject(raw) ? raw : {};
    return {
      id: id,
      name: string(packageItem.name, "(unnamed package)"),
      version: string(packageItem.versionInfo),
      type: string(packageItem.primaryPackagePurpose, "package").toLowerCase(),
      group: "",
      namespace: string(packageItem.originator),
      purl: spdxExternal(packageItem, "purl"),
      cpe: spdxExternal(packageItem, "cpe"),
      supplier: supplierName(packageItem.supplier),
      licenses: spdxLicenses(packageItem),
      hashes: array(packageItem.checksums).map(normalizeHash).filter(Boolean),
      scope: "",
      description: string(packageItem.description || packageItem.summary),
      externalReferences: array(packageItem.externalRefs).filter(isObject).map(function (item) { return { type: string(item.referenceType), url: string(item.referenceLocator) }; }),
      isRoot: false,
      raw: raw,
    };
  }

  function normalizeSpdx(document) {
    var issues = [];
    var version = string(document.spdxVersion).replace(/^SPDX-/, "");
    if (!/^2\.[23]$/.test(version)) issues.push(issue("warning", "version", "$.spdxVersion", "Expected SPDX 2.2 or 2.3; attempting compatible parsing of " + version));
    if (!Array.isArray(document.packages)) issues.push(issue("warning", "packages", "$.packages", "SPDX packages array is missing"));
    var components = array(document.packages).map(function (packageItem, index) {
      if (!isObject(packageItem)) { issues.push(issue("error", "package", "$.packages[" + index + "]", "Package must be an object")); packageItem = {}; }
      var id = string(packageItem.SPDXID);
      if (!id) { id = "generated:spdx:" + (index + 1); issues.push(issue("warning", "package-id", "$.packages[" + index + "].SPDXID", "Package has no SPDXID; generated " + id)); }
      return normalizeSpdxPackage(packageItem, id);
    });
    var documentId = string(document.SPDXID, "SPDXRef-DOCUMENT");
    var roots = unique(array(document.documentDescribes).filter(function (id) { return typeof id === "string"; }));
    var edges = [];
    array(document.relationships).forEach(function (relationship, index) {
      if (!isObject(relationship)) { issues.push(issue("warning", "relationship", "$.relationships[" + index + "]", "Relationship must be an object")); return; }
      var from = string(relationship.spdxElementId); var to = string(relationship.relatedSpdxElement); var type = string(relationship.relationshipType).toUpperCase();
      if (!from || !to || !type) { issues.push(issue("warning", "relationship", "$.relationships[" + index + "]", "Relationship requires source, target, and type")); return; }
      if (type === "DESCRIBES" && from === documentId) roots.push(to);
      else if (type === "DESCRIBED_BY" && to === documentId) roots.push(from);
      else if (type === "DEPENDS_ON") edges.push({ from: from, to: to, type: type.toLowerCase() });
      else if (SPDX_DEPENDENCY_OF.test(type)) edges.push({ from: to, to: from, type: type.toLowerCase() });
    });
    roots = unique(roots);
    components.forEach(function (component) { component.isRoot = roots.includes(component.id); });
    return {
      format: "SPDX", version: version, document: document, components: components, edges: edges, rootIds: roots, vulnerabilities: [], issues: issues,
      metadata: { name: string(document.name, "SPDX document"), serialNumber: string(document.documentNamespace), timestamp: string(document.creationInfo && document.creationInfo.created), toolCount: array(document.creationInfo && document.creationInfo.creators).filter(function (creator) { return /^Tool:/i.test(string(creator)); }).length },
    };
  }

  function normalizeSbom(source) {
    var document = parseDocument(source);
    var detected = detectFormat(document);
    return detected.format === "CycloneDX" ? normalizeCycloneDx(document) : normalizeSpdx(document);
  }

  function buildGraph(components, edges, issues) {
    var ids = new Set(); var duplicates = new Set();
    components.forEach(function (component) { if (ids.has(component.id)) duplicates.add(component.id); else ids.add(component.id); });
    duplicates.forEach(function (id) { issues.push(issue("error", "duplicate-id", "$.components", "Duplicate component identifier: " + id)); });
    var adjacency = new Map(); var reverse = new Map();
    ids.forEach(function (id) { adjacency.set(id, []); reverse.set(id, []); });
    var edgeKeys = new Set();
    edges.forEach(function (edge, index) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) { issues.push(issue("error", "dangling-edge", "$.dependencies[" + index + "]", "Dependency references an unknown component: " + (!ids.has(edge.from) ? edge.from : edge.to))); return; }
      var key = edge.from + "\u0000" + edge.to;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key); adjacency.get(edge.from).push(edge.to); reverse.get(edge.to).push(edge.from);
    });
    return { ids: ids, adjacency: adjacency, reverse: reverse, edges: Array.from(edgeKeys).map(function (key) { var parts = key.split("\u0000"); return { from: parts[0], to: parts[1] }; }) };
  }

  function inferRoots(normalized, graph, issues) {
    var roots = unique(normalized.rootIds.filter(function (id) { return graph.ids.has(id); }));
    normalized.rootIds.filter(function (id) { return !graph.ids.has(id); }).forEach(function (id) { issues.push(issue("error", "root-ref", "$.metadata", "Root component is not present in the inventory: " + id)); });
    if (!roots.length) {
      roots = Array.from(graph.ids).filter(function (id) { return graph.reverse.get(id).length === 0; });
      if (roots.length) issues.push(issue("info", "inferred-roots", "$.dependencies", "No explicit document root; inferred " + roots.length + " root component(s) from the dependency graph"));
    }
    return roots;
  }

  function traverse(roots, graph) {
    var depth = new Map(); var queue = roots.slice();
    roots.forEach(function (id) { depth.set(id, 0); });
    for (var cursor = 0; cursor < queue.length; cursor += 1) {
      var id = queue[cursor];
      graph.adjacency.get(id).forEach(function (target) { if (!depth.has(target)) { depth.set(target, depth.get(id) + 1); queue.push(target); } });
    }
    return depth;
  }

  function findCycles(graph, limit) {
    var color = new Map(); var parent = new Map(); var cycles = [];
    var ids = Array.from(graph.ids);
    for (var rootIndex = 0; rootIndex < ids.length && cycles.length < limit; rootIndex += 1) {
      var root = ids[rootIndex]; if (color.get(root)) continue;
      color.set(root, 1); var stack = [{ id: root, next: 0, targets: graph.adjacency.get(root) }];
      while (stack.length && cycles.length < limit) {
        var frame = stack[stack.length - 1];
        if (frame.next >= frame.targets.length) { color.set(frame.id, 2); stack.pop(); continue; }
        var target = frame.targets[frame.next]; frame.next += 1;
        if (!color.get(target)) { parent.set(target, frame.id); color.set(target, 1); stack.push({ id: target, next: 0, targets: graph.adjacency.get(target) }); continue; }
        if (color.get(target) === 1) {
          var cycle = [target]; var cursor = frame.id; var guard = graph.ids.size + 1;
          while (cursor !== target && cursor && guard > 0) { cycle.push(cursor); cursor = parent.get(cursor); guard -= 1; }
          cycle.push(target); cycle.reverse(); cycles.push(cycle);
        }
      }
    }
    return cycles;
  }

  function licenseState(component) {
    if (!component.licenses.length) return "missing";
    if (component.licenses.some(function (license) { return !["NOASSERTION", "NONE"].includes(license.toUpperCase()); })) return "declared";
    if (component.licenses.some(function (license) { return license.toUpperCase() === "NONE"; })) return "none";
    return "noassertion";
  }

  function finding(severity, code, title, detail, componentId) { return { severity: severity, code: code, title: title, detail: detail, componentId: componentId || null }; }

  function analyzeSbom(source) {
    var normalized = normalizeSbom(source);
    var issues = normalized.issues.slice();
    var graph = buildGraph(normalized.components, normalized.edges, issues);
    var roots = inferRoots(normalized, graph, issues); var depth = traverse(roots, graph); var cycles = findCycles(graph, 20);
    var vulnerabilityByComponent = new Map();
    normalized.vulnerabilities.forEach(function (vulnerability) {
      vulnerability.affects.forEach(function (id) {
        if (!graph.ids.has(id)) issues.push(issue("warning", "vulnerability-ref", "$.vulnerabilities", vulnerability.id + " affects unknown component " + id));
        if (!vulnerabilityByComponent.has(id)) vulnerabilityByComponent.set(id, []); vulnerabilityByComponent.get(id).push(vulnerability);
      });
    });
    var components = normalized.components.map(function (component) {
      return Object.assign({}, component, {
        isRoot: roots.includes(component.id), reachable: depth.has(component.id), depth: depth.has(component.id) ? depth.get(component.id) : null,
        dependencyIds: (graph.adjacency.get(component.id) || []).slice(), dependentIds: (graph.reverse.get(component.id) || []).slice(),
        licenseState: licenseState(component), vulnerabilities: (vulnerabilityByComponent.get(component.id) || []).slice(),
      });
    });
    var counts = {
      version: components.filter(function (item) { return item.version; }).length,
      license: components.filter(function (item) { return item.licenseState === "declared" || item.licenseState === "none"; }).length,
      purl: components.filter(function (item) { return item.purl; }).length,
      hash: components.filter(function (item) { return item.hashes.length; }).length,
      supplier: components.filter(function (item) { return item.supplier; }).length,
    };
    var coverage = { version: percent(counts.version, components.length), license: percent(counts.license, components.length), purl: percent(counts.purl, components.length), hash: percent(counts.hash, components.length), supplier: percent(counts.supplier, components.length) };
    coverage.overall = Math.round((coverage.version + coverage.license + coverage.purl + coverage.hash + coverage.supplier) / 5);
    var findings = [];
    issues.forEach(function (item) { findings.push(finding(item.severity, item.code, item.severity === "error" ? "Invalid SBOM reference" : "SBOM compatibility notice", item.message)); });
    if (components.length > 1 && !graph.edges.length) findings.push(finding("warning", "missing-graph", "Dependency graph is missing", "The inventory has " + components.length + " components but no usable dependency edges"));
    if (cycles.length) findings.push(finding("warning", "cycles", "Dependency cycle detected", cycles[0].join(" → ")));
    var unreachable = components.filter(function (item) { return !item.reachable; });
    if (roots.length && unreachable.length) findings.push(finding("warning", "unreachable", "Components outside the root graph", unreachable.length + " component(s) cannot be reached from an explicit or inferred root"));
    var missingLicense = components.filter(function (item) { return item.licenseState === "missing" || item.licenseState === "noassertion"; });
    if (missingLicense.length) findings.push(finding("warning", "license-coverage", "License coverage is incomplete", missingLicense.length + " of " + components.length + " components lack a declared license"));
    var missingVersion = components.filter(function (item) { return !item.version; });
    if (missingVersion.length) findings.push(finding("warning", "version-coverage", "Version coverage is incomplete", missingVersion.length + " of " + components.length + " components have no version"));
    var missingHash = components.filter(function (item) { return !item.hashes.length; });
    if (missingHash.length) findings.push(finding("info", "hash-coverage", "Integrity hashes are incomplete", missingHash.length + " of " + components.length + " components have no hash"));
    var missingPurl = components.filter(function (item) { return !item.purl; });
    if (missingPurl.length) findings.push(finding("info", "purl-coverage", "Package URLs are incomplete", missingPurl.length + " of " + components.length + " components have no purl"));
    normalized.vulnerabilities.forEach(function (vulnerability) {
      if (vulnerability.severity === "critical" || vulnerability.severity === "high") findings.push(finding("error", "vulnerability", vulnerability.severity.toUpperCase() + " vulnerability " + vulnerability.id, vulnerability.affects.length + " affected component reference(s)" + (vulnerability.state ? " · state: " + vulnerability.state : ""), vulnerability.affects[0]));
      else if (vulnerability.severity === "medium") findings.push(finding("warning", "vulnerability", "MEDIUM vulnerability " + vulnerability.id, vulnerability.affects.length + " affected component reference(s)", vulnerability.affects[0]));
    });
    var rank = { error: 0, warning: 1, info: 2 };
    findings.sort(function (a, b) { return rank[a.severity] - rank[b.severity]; });
    var maxDepth = components.reduce(function (max, item) { return item.depth === null ? max : Math.max(max, item.depth); }, 0);
    return {
      format: normalized.format, version: normalized.version, document: normalized.document, metadata: normalized.metadata,
      components: components, edges: graph.edges, rootIds: roots, vulnerabilities: normalized.vulnerabilities, issues: issues, cycles: cycles, findings: findings, coverage: coverage,
      summary: { componentCount: components.length, dependencyCount: graph.edges.length, rootCount: roots.length, directDependencyCount: unique(roots.flatMap(function (id) { return graph.adjacency.get(id) || []; })).length, unreachableCount: unreachable.length, vulnerabilityCount: normalized.vulnerabilities.length, maxDepth: maxDepth },
    };
  }

  function shortestPath(report, targetId) {
    if (!report || !Array.isArray(report.components)) return [];
    var ids = new Set(report.components.map(function (item) { return item.id; })); if (!ids.has(targetId)) return [];
    var adjacency = new Map(report.components.map(function (item) { return [item.id, item.dependencyIds || []]; }));
    var queue = report.rootIds.slice(); var previous = new Map(); var seen = new Set(queue);
    for (var cursor = 0; cursor < queue.length; cursor += 1) {
      var id = queue[cursor]; if (id === targetId) { var path = [id]; while (previous.has(path[0])) path.unshift(previous.get(path[0])); return path; }
      (adjacency.get(id) || []).forEach(function (next) { if (!seen.has(next)) { seen.add(next); previous.set(next, id); queue.push(next); } });
    }
    return [];
  }

  function filterComponents(components, options) {
    var settings = options || {}; var query = string(settings.query).toLowerCase();
    return components.filter(function (component) {
      if (settings.type && settings.type !== "all" && component.type !== settings.type) return false;
      if (settings.license && settings.license !== "all" && component.licenseState !== settings.license) return false;
      if (settings.reachability === "reachable" && !component.reachable) return false;
      if (settings.reachability === "unreachable" && component.reachable) return false;
      if (settings.vulnerable === "yes" && !component.vulnerabilities.length) return false;
      if (query && ![component.name, component.version, component.group, component.purl, component.cpe, component.supplier, component.licenses.join(" ")].join(" ").toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function identityKey(component) {
    if (component.purl) return "purl:" + component.purl.toLowerCase().replace(/@[^?#]+(?=[?#]|$)/, "").replace(/[?#].*$/, "");
    return [component.type, component.group || component.namespace, component.name].map(function (value) { return string(value).trim().toLowerCase(); }).join("|");
  }

  function sorted(values) { return values.slice().sort().join("\u0000"); }
  function compareSboms(beforeSource, afterSource) {
    var before = beforeSource && beforeSource.summary ? beforeSource : analyzeSbom(beforeSource);
    var after = afterSource && afterSource.summary ? afterSource : analyzeSbom(afterSource);
    var beforeMap = new Map(); var afterMap = new Map();
    before.components.forEach(function (component) { var key = identityKey(component); if (!beforeMap.has(key)) beforeMap.set(key, []); beforeMap.get(key).push(component); });
    after.components.forEach(function (component) { var key = identityKey(component); if (!afterMap.has(key)) afterMap.set(key, []); afterMap.get(key).push(component); });
    var added = []; var removed = []; var changed = []; var unchanged = 0;
    var keys = new Set(Array.from(beforeMap.keys()).concat(Array.from(afterMap.keys())));
    keys.forEach(function (key) {
      var oldItems = beforeMap.get(key) || []; var newItems = afterMap.get(key) || [];
      if (!oldItems.length) { added.push.apply(added, newItems); return; }
      if (!newItems.length) { removed.push.apply(removed, oldItems); return; }
      if (oldItems.length !== 1 || newItems.length !== 1) {
        var oldByVersion = new Map(oldItems.map(function (item) { return [item.version, item]; })); var newByVersion = new Map(newItems.map(function (item) { return [item.version, item]; }));
        oldItems.forEach(function (item) { if (!newByVersion.has(item.version)) removed.push(item); else unchanged += 1; });
        newItems.forEach(function (item) { if (!oldByVersion.has(item.version)) added.push(item); }); return;
      }
      var oldItem = oldItems[0]; var newItem = newItems[0]; var changes = [];
      if (oldItem.version !== newItem.version) changes.push({ field: "version", before: oldItem.version, after: newItem.version });
      if (sorted(oldItem.licenses) !== sorted(newItem.licenses)) changes.push({ field: "licenses", before: oldItem.licenses.join(", "), after: newItem.licenses.join(", ") });
      if (sorted(oldItem.hashes.map(function (item) { return item.algorithm + ":" + item.value; })) !== sorted(newItem.hashes.map(function (item) { return item.algorithm + ":" + item.value; }))) changes.push({ field: "hashes", before: oldItem.hashes.length + " hash(es)", after: newItem.hashes.length + " hash(es)" });
      if (oldItem.supplier !== newItem.supplier) changes.push({ field: "supplier", before: oldItem.supplier, after: newItem.supplier });
      if (changes.length) changed.push({ key: key, before: oldItem, after: newItem, changes: changes }); else unchanged += 1;
    });
    function byName(a, b) { return a.name.localeCompare(b.name) || a.version.localeCompare(b.version); }
    added.sort(byName); removed.sort(byName); changed.sort(function (a, b) { return a.after.name.localeCompare(b.after.name); });
    return { before: before, after: after, added: added, removed: removed, changed: changed, unchangedCount: unchanged, summary: { added: added.length, removed: removed.length, changed: changed.length, unchanged: unchanged } };
  }

  function csvCell(value) {
    var text = String(value === undefined || value === null ? "" : value); if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function componentsToCsv(components) {
    var rows = [["id", "name", "version", "type", "group", "purl", "supplier", "licenses", "hashes", "root", "reachable", "depth", "dependencies", "vulnerabilities"]];
    components.forEach(function (item) { rows.push([item.id, item.name, item.version, item.type, item.group, item.purl, item.supplier, item.licenses.join(" OR "), item.hashes.length, item.isRoot, item.reachable, item.depth === null ? "" : item.depth, item.dependencyIds.length, item.vulnerabilities.length]); });
    return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\n") + "\n";
  }

  return {
    parseDocument: parseDocument, detectFormat: detectFormat, normalizeSbom: normalizeSbom, analyzeSbom: analyzeSbom,
    shortestPath: shortestPath, filterComponents: filterComponents, compareSboms: compareSboms, componentsToCsv: componentsToCsv,
  };
});
