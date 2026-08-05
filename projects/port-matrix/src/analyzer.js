"use strict";

const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const VERSION = "0.1.0";
const DEFAULTS = { ignore: ["**/node_modules/**", "**/.git/**", "**/coverage/**", "**/dist/**"], allowedPrivilegedPorts: [80, 443], allowDocsOnlyPorts: [11434], reportDynamic: false };
const SOURCE_EXTENSIONS = new Set([".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".py", ".go", ".rb", ".java", ".cs"]);

function toPosix(value) { return value.split(path.sep).join("/"); }
function escapeRegex(value) { return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"); }
function globRegex(pattern) { let source = escapeRegex(toPosix(pattern)); source = source.replace(/\*\*/g, "::D::").replace(/\*/g, "[^/]*").replace(/::D::/g, ".*").replace(/\?/g, "[^/]"); return new RegExp(`^${source}$`, "i"); }
function ignored(relative, patterns) { return patterns.some((pattern) => globRegex(pattern).test(toPosix(relative))); }
function lineNumber(content, offset) { return content.slice(0, offset).split(/\r?\n/).length; }
function evidence(file, line, layer, role, port, details = {}) { return { file, line, layer, role, port: Number(port), service: details.service || "", variable: details.variable || "", scope: details.scope || ".", protocol: details.protocol || "tcp", evidence: details.evidence || String(port) }; }
function walk(root, config) {
  const files = [];
  function visit(current) {
    let entries; try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name); const relative = toPosix(path.relative(root, absolute));
      if (ignored(relative, config.ignore)) continue;
      if (entry.isDirectory()) visit(absolute); else if (entry.isFile()) files.push(relative);
    }
  }
  visit(root); return files.sort();
}
function packageScopes(root, files) { return files.filter((file) => path.posix.basename(file) === "package.json").map((file) => path.posix.dirname(file) === "." ? "" : path.posix.dirname(file)).sort((a, b) => b.length - a.length); }
function scopeFor(file, scopes) { return scopes.find((scope) => !scope || file === scope || file.startsWith(`${scope}/`)) || ""; }
function parseEnv(file, content, scope) {
  const results = [];
  content.split(/\r?\n/).forEach((line, index) => { const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']?(\d+)["']?\s*(?:#.*)?$/); if (match && /PORT/i.test(match[1])) results.push(evidence(file, index + 1, "env", "runtime", match[2], { variable: match[1], scope, evidence: line.trim() })); });
  return results;
}
function parseDocker(file, content, scope) {
  const results = [];
  content.split(/\r?\n/).forEach((line, index) => { const match = line.match(/^\s*EXPOSE\s+(.+)$/i); if (!match) return; for (const token of match[1].trim().split(/\s+/)) { const port = token.match(/^(\d+)(?:\/(tcp|udp))?$/i); if (port) results.push(evidence(file, index + 1, "docker", "container", port[1], { scope, protocol: port[2] || "tcp", evidence: line.trim() })); } });
  return results;
}
function parsePortMapping(value) {
  if (typeof value === "number") return { container: value };
  if (value && typeof value === "object") return { host: Number(value.published), container: Number(value.target), protocol: value.protocol || "tcp" };
  const clean = String(value).split("/")[0]; const parts = clean.split(":"); const numbers = parts.filter((part) => /^\d+$/.test(part)).map(Number); if (numbers.length >= 2) return { host: numbers[numbers.length - 2], container: numbers[numbers.length - 1], protocol: String(value).includes("/udp") ? "udp" : "tcp" }; if (numbers.length === 1) return { container: numbers[0] }; return {};
}
function parseCompose(file, content, scope) {
  let document; try { document = YAML.parse(content); } catch (error) { return { evidence: [], errors: [error.message], builds: [] }; }
  const results = []; const builds = [];
  for (const [service, definition] of Object.entries(document?.services || {})) {
    const context = typeof definition?.build === "string" ? definition.build : definition?.build?.context;
    const dockerfile = typeof definition?.build === "object" && definition.build?.dockerfile ? definition.build.dockerfile : "Dockerfile";
    if (context) builds.push({ service, context: toPosix(path.posix.normalize(path.posix.join(path.posix.dirname(file), context))), dockerfile });
    for (const mapping of definition?.ports || []) { const parsed = parsePortMapping(mapping); if (Number.isFinite(parsed.host)) results.push(evidence(file, 0, "compose", "host", parsed.host, { service, scope, protocol: parsed.protocol, evidence: String(typeof mapping === "object" ? JSON.stringify(mapping) : mapping) })); if (Number.isFinite(parsed.container)) results.push(evidence(file, 0, "compose", "container", parsed.container, { service, scope, protocol: parsed.protocol, evidence: String(typeof mapping === "object" ? JSON.stringify(mapping) : mapping) })); }
    for (const port of definition?.expose || []) { const parsed = Number(String(port).split("/")[0]); if (Number.isFinite(parsed)) results.push(evidence(file, 0, "compose", "container", parsed, { service, scope, evidence: String(port) })); }
  }
  return { evidence: results, errors: [], builds };
}
function collectContainers(spec, file, layer, scope, name, results) {
  for (const container of spec?.containers || []) for (const item of container?.ports || []) if (item?.containerPort !== undefined) results.push(evidence(file, 0, layer, "container", item.containerPort, { service: name || container.name, scope, protocol: String(item.protocol || "tcp").toLowerCase(), evidence: JSON.stringify(item) }));
}
function parseKubernetes(file, content, scope) {
  const results = []; const errors = [];
  let documents; try { documents = YAML.parseAllDocuments(content); } catch (error) { return { evidence: [], errors: [error.message] }; }
  for (const yamlDocument of documents) {
    if (yamlDocument.errors.length) { errors.push(...yamlDocument.errors.map((error) => error.message)); continue; }
    const document = yamlDocument.toJSON(); if (!document || typeof document !== "object") continue; const kind = String(document.kind || ""); const name = document.metadata?.name || "";
    if (["Deployment", "StatefulSet", "DaemonSet", "Job"].includes(kind)) collectContainers(document.spec?.template?.spec, file, "kubernetes", scope, name, results);
    else if (kind === "Pod") collectContainers(document.spec, file, "kubernetes", scope, name, results);
    else if (kind === "Service") for (const item of document.spec?.ports || []) { if (item.port !== undefined) results.push(evidence(file, 0, "kubernetes", "service", item.port, { service: name, scope, evidence: JSON.stringify(item) })); if (typeof item.targetPort === "number") results.push(evidence(file, 0, "kubernetes", "target", item.targetPort, { service: name, scope, evidence: JSON.stringify(item) })); if (item.nodePort !== undefined) results.push(evidence(file, 0, "kubernetes", "host", item.nodePort, { service: name, scope, evidence: JSON.stringify(item) })); }
  }
  return { evidence: results, errors };
}
function parsePackage(file, content, scope) {
  let document; try { document = JSON.parse(content); } catch { return []; } const results = [];
  for (const [name, command] of Object.entries(document.scripts || {})) { const pattern = /(?:--port(?:=|\s+)|(?:^|\s)-p\s+)(\d+)/g; let match; while ((match = pattern.exec(String(command)))) results.push(evidence(file, 0, "script", "runtime", match[1], { service: name, scope, evidence: command })); }
  return results;
}
function parseSource(file, content, scope) {
  const results = []; const patterns = [/(?:process\.env\.([A-Z0-9_]*PORT[A-Z0-9_]*)[^\n]{0,35}?(?:\|\||\?\?)\s*)(\d+)/gi, /\.listen\(\s*(\d+)/g, /ListenAndServe\(\s*["']:(\d+)/g, /app\.run\([^\n]*?port\s*=\s*(\d+)/g, /\b(?:const|let|var)\s+(?:port(?:[A-Z_]\w*)?|[A-Za-z_]\w*Port|PORT(?:_[A-Z0-9_]+)?)\s*=[^\n]{0,120}?\|\|\s*(\d+)/g, /add_argument\(\s*["']--port["'][^\n]*?default\s*=\s*(\d+)/g];
  patterns.forEach((pattern, patternIndex) => { let match; while ((match = pattern.exec(content))) { const port = patternIndex === 0 ? match[2] : match[1]; results.push(evidence(file, lineNumber(content, match.index), "source", "runtime", port, { variable: patternIndex === 0 ? match[1] : "", scope, evidence: match[0] })); } });
  if (/\.config\.[cm]?[jt]s$/.test(file)) { const pattern = /\bport\s*:\s*(\d+)/g; let match; while ((match = pattern.exec(content))) results.push(evidence(file, lineNumber(content, match.index), "source", "runtime", match[1], { scope, evidence: match[0] })); }
  return results;
}
function parseDocs(file, content, scope) { const results = []; const pattern = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):([0-9]{1,5})/g; let match; while ((match = pattern.exec(content))) results.push(evidence(file, lineNumber(content, match.index), "docs", "documented", match[1], { scope, evidence: match[0] })); return results; }
function counts(findings) { return { high: findings.filter((item) => item.severity === "high").length, medium: findings.filter((item) => item.severity === "medium").length, low: findings.filter((item) => item.severity === "low").length }; }
function finding(rule, severity, item, message, suggestion) { return { rule, severity, file: item.file, line: item.line, service: item.service, port: item.port, message, evidence: item.evidence, suggestion }; }
function grade(score) { return score >= 95 ? "A" : score >= 85 ? "B" : score >= 70 ? "C" : score >= 55 ? "D" : "F"; }

function analyzeRepository(root, configuration = {}) {
  const absoluteRoot = path.resolve(root); if (!fs.statSync(absoluteRoot, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Not a directory: ${absoluteRoot}`);
  const config = { ...DEFAULTS, ...configuration }; if (![config.ignore, config.allowedPrivilegedPorts, config.allowDocsOnlyPorts].every(Array.isArray)) throw new Error("ignore, allowedPrivilegedPorts, and allowDocsOnlyPorts must be arrays");
  const files = walk(absoluteRoot, config); const scopes = packageScopes(absoluteRoot, files); const matrix = []; const parseErrors = []; const builds = [];
  for (const file of files) {
    const absolute = path.join(absoluteRoot, file); const content = fs.readFileSync(absolute, "utf8"); const basename = path.posix.basename(file); const scope = scopeFor(file, scopes) || ".";
    if (/^\.env(?:\.|$)/.test(basename)) matrix.push(...parseEnv(file, content, scope));
    if (/^Dockerfile(?:\.|$)/i.test(basename)) matrix.push(...parseDocker(file, content, scope));
    if (/^(?:docker-)?compose(?:\.[^.]+)?\.ya?ml$/i.test(basename)) { const parsed = parseCompose(file, content, scope); matrix.push(...parsed.evidence); builds.push(...parsed.builds.map((item) => ({ ...item, file }))); parseErrors.push(...parsed.errors.map((message) => ({ file, message })) ); }
    else if (/\.ya?ml$/i.test(file)) { const parsed = parseKubernetes(file, content, scope); matrix.push(...parsed.evidence); parseErrors.push(...parsed.errors.map((message) => ({ file, message }))); }
    if (basename === "package.json") matrix.push(...parsePackage(file, content, scope));
    if (SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())) matrix.push(...parseSource(file, content, scope));
    if (/\.(?:md|mdx|txt)$/i.test(file)) matrix.push(...parseDocs(file, content, scope));
  }
  const uniqueDeclarations = new Map();
  for (const item of matrix) {
    const key = `${item.file}:${item.line}:${item.layer}:${item.role}:${item.port}:${item.service}:${item.protocol}`;
    const previous = uniqueDeclarations.get(key);
    if (!previous || (!previous.variable && item.variable)) uniqueDeclarations.set(key, item);
  }
  matrix.splice(0, matrix.length, ...uniqueDeclarations.values());
  const findings = [];
  for (const item of matrix) {
    if (!Number.isInteger(item.port) || item.port < 1 || item.port > 65535) findings.push(finding("PM001", "high", item, `Invalid port ${item.port}.`, "Use an integer between 1 and 65535."));
    if (item.role === "host" && item.port < 1024 && !config.allowedPrivilegedPorts.includes(item.port)) findings.push(finding("PM007", "low", item, `Host port ${item.port} is privileged.`, "Use an unprivileged host port or document the required capability."));
  }
  const composeHosts = new Map(); for (const item of matrix.filter((entry) => entry.layer === "compose" && entry.role === "host")) { const key = `${item.file}:${item.port}/${item.protocol}`; if (composeHosts.has(key) && composeHosts.get(key).service !== item.service) findings.push(finding("PM002", "high", item, `Host port ${item.port}/${item.protocol} is published by multiple Compose services.`, "Assign a unique host port to each concurrently running service.")); else composeHosts.set(key, item); }
  for (const build of builds) {
    const dockerPath = toPosix(path.posix.join(build.context, build.dockerfile)); const exposed = matrix.filter((item) => item.layer === "docker" && item.file === dockerPath).map((item) => item.port); const targets = matrix.filter((item) => item.layer === "compose" && item.file === build.file && item.service === build.service && item.role === "container");
    if (exposed.length) for (const target of targets) if (!exposed.includes(target.port)) findings.push(finding("PM003", "medium", target, `Compose target ${target.port} is absent from ${dockerPath} EXPOSE.`, "Align the mapping and Dockerfile or document why the metadata differs."));
  }
  const workloads = new Set(matrix.filter((item) => item.layer === "kubernetes" && item.role === "container").map((item) => `${item.file}:${item.port}`)); for (const item of matrix.filter((entry) => entry.layer === "kubernetes" && entry.role === "target")) if (!workloads.has(`${item.file}:${item.port}`)) findings.push(finding("PM004", "medium", item, `Service targetPort ${item.port} has no workload containerPort in this manifest.`, "Align targetPort with a workload containerPort or use a named port."));
  const variables = new Map(); for (const item of matrix.filter((entry) => entry.variable)) { const key = `${item.scope}:${item.variable.toUpperCase()}`; if (!variables.has(key)) variables.set(key, []); variables.get(key).push(item); } for (const items of variables.values()) { const ports = new Set(items.map((item) => item.port)); if (ports.size > 1) findings.push(finding("PM005", "medium", items[items.length - 1], `${items[0].variable} has conflicting defaults: ${[...ports].sort((a,b)=>a-b).join(", ")}.`, "Choose one default per project scope or use distinct variable names.")); }
  for (const item of matrix.filter((entry) => entry.layer === "docs")) { if (config.allowDocsOnlyPorts.includes(item.port)) continue; const declared = matrix.some((candidate) => candidate.scope === item.scope && candidate.layer !== "docs" && candidate.port === item.port); if (!declared) findings.push(finding("PM006", "medium", item, `Documented localhost port ${item.port} is not declared in the same project scope.`, "Update the documentation or add the missing runtime/container declaration.")); }
  parseErrors.forEach((error) => findings.push({ rule: "PM008", severity: "medium", file: error.file, line: 0, service: "", port: null, message: "Structured configuration could not be parsed.", evidence: error.message, suggestion: "Fix the YAML syntax or ignore generated input explicitly." }));
  const order = { high: 0, medium: 1, low: 2 }; findings.sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file) || (a.port || 0) - (b.port || 0));
  const severity = counts(findings); const score = Math.max(0, 100 - Math.min(60, severity.high * 20) - Math.min(35, severity.medium * 8) - Math.min(15, severity.low * 3));
  const layers = Object.fromEntries([...new Set(matrix.map((item) => item.layer))].sort().map((layer) => [layer, matrix.filter((item) => item.layer === layer).length]));
  return { tool: "port-matrix", version: VERSION, generatedAt: new Date().toISOString(), repository: path.basename(absoluteRoot), root: absoluteRoot, config, summary: { score, grade: grade(score), declarations: matrix.length, uniquePorts: new Set(matrix.map((item) => item.port)).size, findings: findings.length }, counts: severity, layers, declarations: matrix.sort((a, b) => a.port - b.port || a.file.localeCompare(b.file)), findings };
}

module.exports = { analyzeRepository, parseCompose, parseDocker, parseDocs, parseEnv, parseKubernetes, parsePackage, parsePortMapping, parseSource };
