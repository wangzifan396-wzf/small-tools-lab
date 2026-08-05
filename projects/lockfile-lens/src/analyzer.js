"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const RULES = {
  LL001: { title: "Malformed or unsupported lockfile", severity: "high", category: "integrity" },
  LL002: { title: "Non-registry dependency source", severity: "high", category: "source" },
  LL003: { title: "Unexpected registry host", severity: "high", category: "source" },
  LL004: { title: "Missing package integrity", severity: "medium", category: "integrity" },
  LL005: { title: "Dependency install script", severity: "medium", category: "execution" },
  LL006: { title: "Insecure dependency transport", severity: "high", category: "source" },
  LL007: { title: "Mutable root dependency specifier", severity: "medium", category: "source" },
  LL008: { title: "Excessive version spread", severity: "low", category: "complexity" },
  LL009: { title: "Large dependency expansion", severity: "medium", category: "change" },
  LL010: { title: "New install-script dependency", severity: "high", category: "change" },
  LL011: { title: "Locked artifact changed without a version change", severity: "high", category: "integrity" }
};

const DEFAULTS = {
  ignore: [],
  allowedRegistries: ["registry.npmjs.org"],
  maxNewPackages: 25,
  maxVersionsPerPackage: 3
};
const DEFAULT_IGNORES = new Set([".git", "node_modules", "coverage", "dist", "build", ".next", "vendor", "target"]);
const SEVERITY_RANK = { low: 1, medium: 2, high: 3 };

function toPosix(value) { return value.split(path.sep).join("/"); }
function severityRank(value) { return SEVERITY_RANK[value] || 0; }

function globToRegExp(pattern) {
  const escaped = toPosix(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "::DOUBLE::").replaceAll("*", "[^/]*").replaceAll("::DOUBLE::", ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function validateConfig(input) {
  const config = { ...DEFAULTS, ...(input || {}) };
  for (const key of ["ignore", "allowedRegistries"]) {
    if (!Array.isArray(config[key]) || config[key].some((item) => typeof item !== "string")) throw new Error(`config.${key} must be an array of strings.`);
  }
  for (const key of ["maxNewPackages", "maxVersionsPerPackage"]) {
    if (!Number.isInteger(config[key]) || config[key] < 1) throw new Error(`config.${key} must be a positive integer.`);
  }
  config.allowedRegistries = config.allowedRegistries.map((item) => item.toLowerCase());
  return config;
}

function listLockfiles(root, config) {
  const found = [];
  const ignores = config.ignore.map(globToRegExp);
  function walk(directory, relative) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && DEFAULT_IGNORES.has(entry.name)) continue;
      const next = relative ? path.join(relative, entry.name) : entry.name;
      const posix = toPosix(next);
      if (ignores.some((pattern) => pattern.test(posix) || pattern.test(`${posix}/`))) continue;
      if (entry.isDirectory()) walk(path.join(directory, entry.name), next);
      else if (entry.name === "package-lock.json") found.push(posix);
    }
  }
  walk(root, "");
  return found.sort();
}

function packageName(location, record) {
  if (record.name) return String(record.name);
  const marker = "node_modules/";
  const index = location.lastIndexOf(marker);
  return index === -1 ? location : location.slice(index + marker.length);
}

function sourceInfo(resolved) {
  if (!resolved) return { type: "none", host: null };
  const value = String(resolved);
  if (/^https?:\/\//i.test(value)) {
    try { return { type: value.toLowerCase().startsWith("http:") ? "http" : "registry", host: new URL(value).hostname.toLowerCase() }; }
    catch (_error) { return { type: "invalid", host: null }; }
  }
  if (/^(?:git\+|git:|github:|gitlab:|bitbucket:)/i.test(value)) return { type: "git", host: null };
  if (/^(?:file:|link:|\.\.?[\\/]|[A-Za-z]:[\\/])/i.test(value)) return { type: "local", host: null };
  return { type: "other", host: null };
}

function parseLockfile(content, filename) {
  const parsed = JSON.parse(content);
  if (![2, 3].includes(parsed.lockfileVersion) || !parsed.packages || typeof parsed.packages !== "object") throw new Error(`${filename} must use npm lockfileVersion 2 or 3 with a packages map.`);
  const records = Object.entries(parsed.packages).filter(([location, record]) => location && record && typeof record === "object" && !record.link).map(([location, record]) => {
    const resolved = record.resolved ? String(record.resolved) : null;
    return {
      location: toPosix(location),
      name: packageName(toPosix(location), record),
      version: record.version ? String(record.version) : null,
      resolved,
      integrity: record.integrity ? String(record.integrity) : null,
      hasInstallScript: record.hasInstallScript === true,
      dev: record.dev === true,
      optional: record.optional === true,
      source: sourceInfo(resolved)
    };
  });
  const root = parsed.packages[""] || {};
  const specs = { ...(root.dependencies || {}), ...(root.optionalDependencies || {}), ...(root.devDependencies || {}) };
  return { lockfileVersion: parsed.lockfileVersion, name: parsed.name || path.basename(path.dirname(filename)), records, specs };
}

function finding(rule, file, dependency, message, evidence, suggestion, severity) {
  return { rule, title: RULES[rule].title, severity: severity || RULES[rule].severity, category: RULES[rule].category, file, dependency: dependency || null, message, evidence: String(evidence || "").slice(0, 240), suggestion };
}

function readBefore(root, relative, options, lockfileCount) {
  if (options.before) {
    if (lockfileCount !== 1) throw new Error("--before requires the scan to contain exactly one package-lock.json.");
    return fs.readFileSync(path.resolve(options.before), "utf8");
  }
  if (!options.base) return null;
  try { return execFileSync("git", ["-C", root, "show", `${options.base}:${relative}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch (_error) { return null; }
}

function compareRecords(before, current) {
  const previous = new Map((before?.records || []).map((item) => [item.location, item]));
  const next = new Map(current.records.map((item) => [item.location, item]));
  const added = current.records.filter((item) => !previous.has(item.location));
  const removed = (before?.records || []).filter((item) => !next.has(item.location));
  const changed = current.records.filter((item) => {
    const old = previous.get(item.location);
    return old && ["version", "resolved", "integrity", "hasInstallScript"].some((key) => old[key] !== item[key]);
  }).map((item) => ({ before: previous.get(item.location), after: item }));
  return { added, removed, changed };
}

function analyzeParsed(file, parsed, before, config) {
  const findings = [];
  const allowed = new Set(config.allowedRegistries);
  const changes = compareRecords(before, parsed);
  const newlyAdded = new Set(changes.added.map((item) => item.location));

  for (const record of parsed.records) {
    if (["git", "local", "other", "invalid"].includes(record.source.type)) findings.push(finding("LL002", file, record.name, `${record.name} is locked from a non-registry source.`, record.resolved || "No resolved URL", "Use a reviewed registry release or document the immutable source and ownership."));
    if (record.source.type === "registry" && record.source.host && !allowed.has(record.source.host)) findings.push(finding("LL003", file, record.name, `${record.name} resolves through an unapproved registry host.`, record.source.host, "Add the trusted host to allowedRegistries only after reviewing its ownership and TLS policy."));
    if (record.source.type === "http") findings.push(finding("LL006", file, record.name, `${record.name} uses unencrypted HTTP.`, record.resolved, "Use an HTTPS registry or remove the dependency."));
    if (["registry", "http"].includes(record.source.type) && !record.integrity) findings.push(finding("LL004", file, record.name, `${record.name} has no integrity digest.`, record.resolved, "Regenerate the lockfile with a supported npm version and trusted registry."));
    if (record.hasInstallScript) findings.push(finding(newlyAdded.has(record.location) && before ? "LL010" : "LL005", file, record.name, newlyAdded.has(record.location) && before ? `${record.name} is newly added and can execute an install script.` : `${record.name} can execute an install script.`, `${record.location}@${record.version || "unknown"}`, "Review the package scripts and maintainer provenance before installation."));
  }

  for (const [name, spec] of Object.entries(parsed.specs)) {
    if (/^(?:latest|next|\*|https?:|git\+|git:|github:|file:|link:)/i.test(String(spec))) findings.push(finding("LL007", file, name, `${name} uses a mutable or non-registry root specifier.`, spec, "Use a bounded semver range or a reviewed immutable source."));
  }

  const versions = new Map();
  for (const record of parsed.records) {
    if (!versions.has(record.name)) versions.set(record.name, new Set());
    if (record.version) versions.get(record.name).add(record.version);
  }
  for (const [name, values] of versions) if (values.size > config.maxVersionsPerPackage) findings.push(finding("LL008", file, name, `${name} is installed at ${values.size} versions.`, [...values].sort().join(", "), "Align parent dependency ranges or document why the version spread is necessary."));

  for (const change of changes.changed) {
    if (change.before.version === change.after.version && (change.before.integrity !== change.after.integrity || change.before.resolved !== change.after.resolved)) findings.push(finding("LL011", file, change.after.name, `${change.after.name}@${change.after.version} changed its locked artifact.`, `${change.before.resolved || "none"} -> ${change.after.resolved || "none"}`, "Treat same-version artifact drift as a supply-chain event and verify the registry response."));
  }
  return { findings, changes, versions: [...versions.values()].reduce((sum, set) => sum + set.size, 0) };
}

function analyzeRepository(root, inputConfig, options) {
  const config = validateConfig(inputConfig);
  const settings = options || {};
  const absoluteRoot = path.resolve(root);
  if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) throw new Error(`Not a directory: ${absoluteRoot}`);
  const files = listLockfiles(absoluteRoot, config);
  const findings = [];
  const lockfiles = [];
  let addedPackages = 0;

  for (const file of files) {
    let parsed;
    let before = null;
    try { parsed = parseLockfile(fs.readFileSync(path.join(absoluteRoot, ...file.split("/")), "utf8"), file); }
    catch (error) {
      findings.push(finding("LL001", file, null, "Lockfile cannot be analyzed.", error.message, "Regenerate the lockfile with npm 7 or newer and review the resulting diff."));
      lockfiles.push({ file, error: error.message, packages: 0, changes: { added: [], removed: [], changed: [] } });
      continue;
    }
    const beforeContent = readBefore(absoluteRoot, file, settings, files.length);
    if (beforeContent) {
      try { before = parseLockfile(beforeContent, file); }
      catch (error) { findings.push(finding("LL001", file, null, "Baseline lockfile cannot be analyzed.", error.message, "Use a valid npm v2/v3 lockfile as the comparison baseline.")); }
    }
    const result = analyzeParsed(file, parsed, before, config);
    findings.push(...result.findings);
    addedPackages += result.changes.added.length;
    lockfiles.push({ file, error: null, lockfileVersion: parsed.lockfileVersion, packages: parsed.records.length, uniqueVersions: result.versions, compared: Boolean(beforeContent), changes: result.changes });
  }

  if (addedPackages > config.maxNewPackages) findings.push(finding("LL009", ".", null, `${addedPackages} packages were added across the lockfile diff.`, `${addedPackages} > ${config.maxNewPackages}`, "Split unrelated dependency updates or raise the reviewed expansion budget in configuration."));
  findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.file.localeCompare(b.file) || (a.dependency || "").localeCompare(b.dependency || "") || a.rule.localeCompare(b.rule));
  const weights = { high: 15, medium: 6, low: 2 };
  const score = Math.max(0, 100 - findings.reduce((sum, item) => sum + weights[item.severity], 0));
  const packages = lockfiles.reduce((sum, item) => sum + item.packages, 0);
  const changes = lockfiles.reduce((summary, item) => ({ added: summary.added + item.changes.added.length, removed: summary.removed + item.changes.removed.length, changed: summary.changed + item.changes.changed.length }), { added: 0, removed: 0, changed: 0 });
  return {
    tool: "lockfile-lens",
    version: require("../package.json").version,
    root: absoluteRoot,
    repository: path.basename(absoluteRoot),
    generatedAt: new Date().toISOString(),
    config,
    summary: { lockfiles: files.length, packages, ...changes, score, grade: score >= 95 ? "A" : score >= 85 ? "B" : score >= 70 ? "C" : score >= 55 ? "D" : "F" },
    counts: { high: findings.filter((item) => item.severity === "high").length, medium: findings.filter((item) => item.severity === "medium").length, low: findings.filter((item) => item.severity === "low").length },
    lockfiles,
    findings,
    rules: RULES
  };
}

module.exports = { DEFAULTS, RULES, analyzeRepository, globToRegExp, listLockfiles, parseLockfile, severityRank, sourceInfo, validateConfig };
