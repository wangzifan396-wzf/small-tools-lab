(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SarifCompass = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LEVELS = ["error", "warning", "note", "none"];
  var hasOwn = Function.call.bind(Object.prototype.hasOwnProperty);

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function string(value, fallback) { return typeof value === "string" ? value : fallback || ""; }
  function array(value) { return Array.isArray(value) ? value : []; }
  function number(value, fallback) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
  function unique(values) { return Array.from(new Set(values.filter(Boolean))); }
  function issue(severity, code, path, message) { return { severity: severity, code: code, path: path, message: message }; }

  function parseSarif(source) {
    var document = source;
    if (typeof source === "string") {
      var text = source.replace(/^\uFEFF/, "").trim();
      if (!text) throw new SyntaxError("SARIF document is empty");
      try { document = JSON.parse(text); }
      catch (error) { throw new SyntaxError("Invalid SARIF JSON: " + error.message); }
    }
    if (!isObject(document)) throw new TypeError("SARIF root must be a JSON object");
    if (!Array.isArray(document.runs)) throw new TypeError("SARIF root must contain a runs array");
    return document;
  }

  function messageText(message) {
    if (typeof message === "string") return message;
    if (!isObject(message)) return "";
    return string(message.text) || string(message.markdown) || (typeof message.id === "string" ? "[message id: " + message.id + "]" : "");
  }

  function normalizeLevel(value, fallback) {
    var level = string(value).toLowerCase();
    if (LEVELS.includes(level)) return level;
    var backup = string(fallback, "warning").toLowerCase();
    return LEVELS.includes(backup) ? backup : "warning";
  }

  function normalizeRule(raw, index, componentName) {
    var rule = isObject(raw) ? raw : {};
    var properties = isObject(rule.properties) ? rule.properties : {};
    var securityScore = Number(properties["security-severity"]);
    return {
      id: string(rule.id, "rule-" + index), index: index, componentName: componentName,
      name: string(rule.name), shortDescription: messageText(rule.shortDescription), fullDescription: messageText(rule.fullDescription),
      help: messageText(rule.help), helpUri: string(rule.helpUri), defaultLevel: normalizeLevel(rule.defaultConfiguration && rule.defaultConfiguration.level, "warning"),
      tags: unique(array(properties.tags).filter(function (tag) { return typeof tag === "string"; })),
      precision: string(properties.precision), securitySeverity: Number.isFinite(securityScore) ? securityScore : null, raw: raw,
    };
  }

  function ruleCatalog(run, issues, runIndex) {
    var driver = isObject(run.tool) && isObject(run.tool.driver) ? run.tool.driver : {};
    if (!string(driver.name)) issues.push(issue("warning", "driver", "$.runs[" + runIndex + "].tool.driver", "Run tool driver name is missing"));
    var components = [{ value: driver, name: string(driver.name, "Unknown tool"), driver: true }].concat(array(run.tool && run.tool.extensions).filter(isObject).map(function (extension, index) { return { value: extension, name: string(extension.name, "extension-" + index), driver: false }; }));
    var rules = []; var byId = new Map(); var driverRules = [];
    components.forEach(function (component) {
      array(component.value.rules).forEach(function (rawRule, index) {
        var rule = normalizeRule(rawRule, index, component.name); rules.push(rule);
        var key = component.name + "\u0000" + rule.id; if (!byId.has(key)) byId.set(key, rule);
        if (!byId.has(rule.id)) byId.set(rule.id, rule);
        if (component.driver) driverRules[index] = rule;
      });
    });
    return { rules: rules, byId: byId, driverRules: driverRules, driver: driver };
  }

  function artifactFromIndex(run, index) {
    var artifact = array(run.artifacts)[index];
    return isObject(artifact) && isObject(artifact.location) ? artifact.location : {};
  }

  function uriBase(run, id, seen) {
    if (!id || !isObject(run.originalUriBaseIds)) return "";
    var visited = seen || new Set(); if (visited.has(id)) return ""; visited.add(id);
    var base = run.originalUriBaseIds[id]; if (!isObject(base)) return "";
    var uri = string(base.uri); var parent = string(base.uriBaseId);
    if (parent) {
      var parentUri = uriBase(run, parent, visited);
      if (parentUri) { try { return new URL(uri || "", parentUri).toString(); } catch (_) { return parentUri + uri; } }
    }
    return uri;
  }

  function resolveArtifact(run, artifactLocation) {
    var location = isObject(artifactLocation) ? artifactLocation : {};
    if (!string(location.uri) && Number.isInteger(location.index)) location = Object.assign({}, artifactFromIndex(run, location.index), location);
    var raw = string(location.uri); if (!raw) return "(unknown artifact)";
    var base = uriBase(run, string(location.uriBaseId));
    if (base) {
      try { var resolved = new URL(raw, base); resolved.username = ""; resolved.password = ""; return resolved.toString(); }
      catch (_) { return base + raw; }
    }
    try {
      var parsed = new URL(raw); parsed.username = ""; parsed.password = ""; return parsed.toString();
    } catch (_) { return raw.replace(/\\/g, "/"); }
  }

  function normalizeRegion(raw) {
    var region = isObject(raw) ? raw : {};
    return {
      startLine: Math.max(0, number(region.startLine, 0)), startColumn: Math.max(0, number(region.startColumn, 0)),
      endLine: Math.max(0, number(region.endLine, 0)), endColumn: Math.max(0, number(region.endColumn, 0)),
      charOffset: Math.max(0, number(region.charOffset, 0)), charLength: Math.max(0, number(region.charLength, 0)), snippet: messageText(region.snippet),
    };
  }

  function normalizeLocation(raw, run) {
    var location = isObject(raw) ? raw : {};
    var physical = isObject(location.physicalLocation) ? location.physicalLocation : {};
    var region = normalizeRegion(physical.region);
    var logical = array(location.logicalLocations)[0] || {};
    return {
      uri: resolveArtifact(run, physical.artifactLocation), region: region,
      logicalName: string(logical.fullyQualifiedName) || string(logical.decoratedName) || string(logical.name),
      message: messageText(location.message), raw: raw,
    };
  }

  function normalizeCodeFlows(rawFlows, run) {
    var steps = [];
    array(rawFlows).forEach(function (flow, flowIndex) {
      array(flow && flow.threadFlows).forEach(function (thread, threadIndex) {
        array(thread && thread.locations).forEach(function (threadLocation, stepIndex) {
          var location = normalizeLocation(threadLocation && threadLocation.location, run);
          steps.push({ flowIndex: flowIndex, threadIndex: threadIndex, stepIndex: stepIndex, executionOrder: number(threadLocation && threadLocation.executionOrder, stepIndex + 1), importance: string(threadLocation && threadLocation.importance), message: location.message, uri: location.uri, region: location.region, state: isObject(threadLocation && threadLocation.state) ? threadLocation.state : {} });
        });
      });
    });
    return steps.sort(function (a, b) { return a.flowIndex - b.flowIndex || a.threadIndex - b.threadIndex || a.executionOrder - b.executionOrder; });
  }

  function pickRule(rawResult, catalog) {
    var result = isObject(rawResult) ? rawResult : {};
    var id = string(result.ruleId) || string(result.rule && result.rule.id);
    var component = string(result.rule && result.rule.toolComponent && result.rule.toolComponent.name);
    if (component && id && catalog.byId.has(component + "\u0000" + id)) return catalog.byId.get(component + "\u0000" + id);
    if (id && catalog.byId.has(id)) return catalog.byId.get(id);
    var index = Number.isInteger(result.ruleIndex) ? result.ruleIndex : Number.isInteger(result.rule && result.rule.index) ? result.rule.index : -1;
    return index >= 0 ? catalog.driverRules[index] || null : null;
  }

  function fingerprint(rawResult) {
    var partial = isObject(rawResult.partialFingerprints) ? rawResult.partialFingerprints : {};
    var full = isObject(rawResult.fingerprints) ? rawResult.fingerprints : {};
    var source = Object.keys(partial).length ? partial : full;
    var keys = Object.keys(source).sort();
    return keys.length ? keys.map(function (key) { return key + "=" + String(source[key]); }).join("|") : "";
  }

  function normalizeResult(raw, run, runIndex, resultIndex, catalog, issues) {
    if (!isObject(raw)) { issues.push(issue("error", "result", "$.runs[" + runIndex + "].results[" + resultIndex + "]", "Result must be an object")); raw = {}; }
    var rule = pickRule(raw, catalog); var ruleId = string(raw.ruleId) || string(raw.rule && raw.rule.id) || (rule ? rule.id : "(no rule)");
    if (!rule && ruleId !== "(no rule)") issues.push(issue("warning", "rule-ref", "$.runs[" + runIndex + "].results[" + resultIndex + "].ruleId", "Result references rule metadata that is not present: " + ruleId));
    var locations = array(raw.locations).map(function (location) { return normalizeLocation(location, run); });
    if (!locations.length) issues.push(issue("warning", "location", "$.runs[" + runIndex + "].results[" + resultIndex + "].locations", "Result has no primary location"));
    var primary = locations[0] || normalizeLocation({}, run); var level = normalizeLevel(raw.level, rule && rule.defaultLevel);
    var suppressions = array(raw.suppressions).filter(isObject).map(function (suppression) { return { kind: string(suppression.kind), status: string(suppression.status), justification: string(suppression.justification) }; });
    var suppressed = suppressions.some(function (suppression) { return suppression.status.toLowerCase() !== "rejected"; });
    var stableFingerprint = fingerprint(raw);
    var identity = stableFingerprint ? ruleId + "|fingerprint|" + stableFingerprint : [ruleId, primary.uri, primary.region.startLine, primary.region.startColumn].join("|");
    return {
      id: "run-" + runIndex + "-result-" + resultIndex, runIndex: runIndex, resultIndex: resultIndex,
      tool: string(catalog.driver.name, "Unknown tool"), toolVersion: string(catalog.driver.semanticVersion) || string(catalog.driver.version),
      ruleId: ruleId, rule: rule, level: level, kind: string(raw.kind, "fail"), message: messageText(raw.message),
      locations: locations, primaryLocation: primary, relatedLocations: array(raw.relatedLocations).map(function (location) { return normalizeLocation(location, run); }),
      codeFlowSteps: normalizeCodeFlows(raw.codeFlows, run), hasFix: array(raw.fixes).length > 0, suppressions: suppressions, suppressed: suppressed,
      baselineState: string(raw.baselineState, "unknown").toLowerCase(), rank: number(raw.rank, null), fingerprint: stableFingerprint, identity: identity,
      properties: isObject(raw.properties) ? raw.properties : {}, raw: raw,
    };
  }

  function normalizeRun(raw, runIndex, issues) {
    if (!isObject(raw)) { issues.push(issue("error", "run", "$.runs[" + runIndex + "]", "Run must be an object")); raw = {}; }
    var catalog = ruleCatalog(raw, issues, runIndex);
    if (raw.results !== undefined && !Array.isArray(raw.results)) issues.push(issue("error", "results", "$.runs[" + runIndex + "].results", "Run results must be an array"));
    var results = array(raw.results).map(function (result, index) { return normalizeResult(result, raw, runIndex, index, catalog, issues); });
    return { index: runIndex, tool: string(catalog.driver.name, "Unknown tool"), version: string(catalog.driver.semanticVersion) || string(catalog.driver.version), rules: catalog.rules, results: results, raw: raw };
  }

  function analyzeSarif(source) {
    var document = parseSarif(source); var issues = [];
    if (document.version !== "2.1.0") issues.push(issue("warning", "version", "$.version", "Expected SARIF 2.1.0; attempting compatible parsing of " + string(document.version, "a document without a version")));
    if (!document.runs.length) issues.push(issue("warning", "runs-empty", "$.runs", "SARIF document contains no runs"));
    var runs = document.runs.map(function (run, index) { return normalizeRun(run, index, issues); });
    var results = runs.flatMap(function (run) { return run.results; }); var rules = runs.flatMap(function (run) { return run.rules; });
    var levelCounts = { error: 0, warning: 0, note: 0, none: 0 }; results.forEach(function (result) { levelCounts[result.level] += 1; });
    var files = new Set(results.map(function (result) { return result.primaryLocation.uri; }).filter(function (uri) { return uri !== "(unknown artifact)"; }));
    return {
      document: document, runs: runs, results: results, rules: rules, issues: issues,
      summary: { runCount: runs.length, resultCount: results.length, ruleCount: rules.length, fileCount: files.size, toolCount: new Set(runs.map(function (run) { return run.tool; })).size, suppressedCount: results.filter(function (result) { return result.suppressed; }).length, codeFlowCount: results.filter(function (result) { return result.codeFlowSteps.length; }).length, fixCount: results.filter(function (result) { return result.hasFix; }).length, baselineNewCount: results.filter(function (result) { return result.baselineState === "new"; }).length, levelCounts: levelCounts },
    };
  }

  function filterResults(results, options) {
    var settings = options || {}; var query = string(settings.query).toLowerCase();
    return results.filter(function (result) {
      if (settings.level && settings.level !== "all" && result.level !== settings.level) return false;
      if (settings.tool && settings.tool !== "all" && result.tool !== settings.tool) return false;
      if (settings.rule && settings.rule !== "all" && result.ruleId !== settings.rule) return false;
      if (settings.file && settings.file !== "all" && result.primaryLocation.uri !== settings.file) return false;
      if (settings.baseline && settings.baseline !== "all" && result.baselineState !== settings.baseline) return false;
      if (settings.suppressed === "yes" && !result.suppressed) return false;
      if (settings.suppressed === "no" && result.suppressed) return false;
      if (settings.hasFlow === "yes" && !result.codeFlowSteps.length) return false;
      if (query && ![result.tool, result.ruleId, result.rule && result.rule.name, result.message, result.primaryLocation.uri, result.primaryLocation.logicalName, result.rule && result.rule.tags.join(" ")].join(" ").toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function compareSarif(beforeSource, afterSource) {
    var before = beforeSource && beforeSource.summary ? beforeSource : analyzeSarif(beforeSource);
    var after = afterSource && afterSource.summary ? afterSource : analyzeSarif(afterSource);
    var beforeMap = new Map(); var afterMap = new Map();
    before.results.forEach(function (result) { if (!beforeMap.has(result.identity)) beforeMap.set(result.identity, []); beforeMap.get(result.identity).push(result); });
    after.results.forEach(function (result) { if (!afterMap.has(result.identity)) afterMap.set(result.identity, []); afterMap.get(result.identity).push(result); });
    var added = []; var removed = []; var updated = []; var unchanged = [];
    new Set(Array.from(beforeMap.keys()).concat(Array.from(afterMap.keys()))).forEach(function (key) {
      var oldItems = beforeMap.get(key) || []; var newItems = afterMap.get(key) || []; var matched = Math.min(oldItems.length, newItems.length);
      for (var index = 0; index < matched; index += 1) {
        var oldItem = oldItems[index]; var newItem = newItems[index]; var changes = [];
        if (oldItem.level !== newItem.level) changes.push({ field: "level", before: oldItem.level, after: newItem.level });
        if (oldItem.message !== newItem.message) changes.push({ field: "message", before: oldItem.message, after: newItem.message });
        var oldLocation = formatLocation(oldItem.primaryLocation); var newLocation = formatLocation(newItem.primaryLocation);
        if (oldLocation !== newLocation) changes.push({ field: "location", before: oldLocation, after: newLocation });
        if (oldItem.suppressed !== newItem.suppressed) changes.push({ field: "suppressed", before: oldItem.suppressed, after: newItem.suppressed });
        if (changes.length) updated.push({ before: oldItem, after: newItem, changes: changes }); else unchanged.push(newItem);
      }
      removed.push.apply(removed, oldItems.slice(matched)); added.push.apply(added, newItems.slice(matched));
    });
    function byRule(a, b) { return a.ruleId.localeCompare(b.ruleId) || a.primaryLocation.uri.localeCompare(b.primaryLocation.uri); }
    added.sort(byRule); removed.sort(byRule); unchanged.sort(byRule); updated.sort(function (a, b) { return byRule(a.after, b.after); });
    return { before: before, after: after, added: added, removed: removed, updated: updated, unchanged: unchanged, summary: { added: added.length, removed: removed.length, updated: updated.length, unchanged: unchanged.length } };
  }

  function stripSnippets(value, seen) {
    if (!value || typeof value !== "object") return;
    var visited = seen || new WeakSet(); if (visited.has(value)) return; visited.add(value);
    if (Array.isArray(value)) { value.forEach(function (item) { stripSnippets(item, visited); }); return; }
    Object.keys(value).forEach(function (key) { if (key === "snippet") delete value[key]; else stripSnippets(value[key], visited); });
  }

  function scrubUris(value, seen) {
    if (!value || typeof value !== "object") return;
    var visited = seen || new WeakSet(); if (visited.has(value)) return; visited.add(value);
    if (Array.isArray(value)) { value.forEach(function (item) { scrubUris(item, visited); }); return; }
    if (typeof value.uri === "string") {
      try { var parsed = new URL(value.uri); parsed.username = ""; parsed.password = ""; parsed.search = ""; parsed.hash = ""; value.uri = parsed.toString(); }
      catch (_) { value.uri = value.uri.replace(/[?#].*$/, ""); }
    }
    Object.keys(value).forEach(function (key) { scrubUris(value[key], visited); });
  }

  function sanitizeSarif(source, options) {
    var settings = Object.assign({ stripSnippets: true, stripFixes: true, stripInvocationDetails: true, stripUriBases: true, stripWebTraffic: true, stripUriQueries: true }, options || {});
    var document = parseSarif(source); var copy = JSON.parse(JSON.stringify(document));
    copy.runs.forEach(function (run) {
      if (!isObject(run)) return;
      if (settings.stripInvocationDetails) delete run.invocations;
      if (settings.stripUriBases) delete run.originalUriBaseIds;
      if (settings.stripWebTraffic) { delete run.webRequests; delete run.webResponses; }
      array(run.artifacts).forEach(function (artifact) { if (isObject(artifact)) delete artifact.contents; });
      array(run.results).forEach(function (result) {
        if (!isObject(result)) return;
        if (settings.stripFixes) delete result.fixes;
        delete result.attachments; delete result.webRequest; delete result.webResponse;
        if (settings.stripSnippets) stripSnippets(result);
      });
      if (settings.stripUriQueries) scrubUris(run);
    });
    return copy;
  }

  function formatRegion(region) {
    if (!region || !region.startLine) return "";
    var start = String(region.startLine) + (region.startColumn ? ":" + region.startColumn : "");
    var end = region.endLine ? String(region.endLine) + (region.endColumn ? ":" + region.endColumn : "") : "";
    return end && end !== start ? start + "-" + end : start;
  }
  function formatLocation(location) { return location ? location.uri + (formatRegion(location.region) ? ":" + formatRegion(location.region) : "") : ""; }

  function csvCell(value) { var text = String(value === undefined || value === null ? "" : value); if (/^[=+\-@]/.test(text)) text = "'" + text; return '"' + text.replace(/"/g, '""') + '"'; }
  function resultsToCsv(results) {
    var rows = [["tool", "toolVersion", "level", "ruleId", "message", "artifact", "region", "baselineState", "suppressed", "codeFlowSteps", "hasFix", "fingerprint"]];
    results.forEach(function (result) { rows.push([result.tool, result.toolVersion, result.level, result.ruleId, result.message, result.primaryLocation.uri, formatRegion(result.primaryLocation.region), result.baselineState, result.suppressed, result.codeFlowSteps.length, result.hasFix, result.fingerprint]); });
    return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\n") + "\n";
  }

  return { parseSarif: parseSarif, analyzeSarif: analyzeSarif, filterResults: filterResults, compareSarif: compareSarif, sanitizeSarif: sanitizeSarif, resultsToCsv: resultsToCsv, formatRegion: formatRegion, formatLocation: formatLocation };
});
