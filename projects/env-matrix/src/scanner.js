"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const RULES = {
  EM001: { title: "Runtime variable missing from examples", severity: "medium", category: "coverage" },
  EM002: { title: "Unused example variable", severity: "low", category: "drift" },
  EM003: { title: "Concrete sensitive default", severity: "high", category: "security" },
  EM004: { title: "Conflicting example defaults", severity: "medium", category: "drift" },
  EM005: { title: "Required variable has an empty example", severity: "medium", category: "coverage" },
  EM006: { title: "Invalid environment declaration", severity: "low", category: "integrity" },
  EM007: { title: "Duplicate environment declaration", severity: "medium", category: "integrity" },
  EM008: { title: "Dynamic environment access", severity: "medium", category: "coverage" },
  EM009: { title: "Committed runtime environment file", severity: "high", category: "security" },
  EM010: { title: "Sensitive fallback in source", severity: "high", category: "security" },
  EM011: { title: "Required variable absent from deployment layers", severity: "low", category: "deployment" }
};

const SEVERITY_RANK = { low: 1, medium: 2, high: 3 };
const DEFAULT_IGNORES = new Set([".git", "node_modules", "dist", "build", "coverage", "vendor", "target", ".next"]);
const EXAMPLE_PATTERN = /(^|\/)(?:\.env\.(?:example|sample|template|defaults?)|env\.example)$/i;
const RUNTIME_ENV_PATTERN = /(^|\/)\.env(?:\.(?:local|development|production|test))?$/i;
const SENSITIVE_NAME = /(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|CLIENT_SECRET|ACCESS_KEY|DATABASE_URL|DB_URL|DSN)/i;

function toPosix(value) { return value.split(path.sep).join("/"); }
function globToRegExp(pattern) { const escaped = toPosix(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "::DOUBLE::").replaceAll("*", "[^/]*").replaceAll("::DOUBLE::", ".*"); return new RegExp(`^${escaped}$`, "i"); }

function listFiles(root, config) {
  let files = [];
  try {
    const top = path.resolve(execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
    if (top !== path.resolve(root)) throw new Error("subdirectory scan");
    files = execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean);
  } catch (_error) {
    const walk = (directory, relative) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && DEFAULT_IGNORES.has(entry.name)) continue;
        const next = relative ? path.join(relative, entry.name) : entry.name;
        if (entry.isDirectory()) walk(path.join(directory, entry.name), next);
        else files.push(next);
      }
    };
    walk(root, "");
  }
  const ignores = (config.ignore || []).map(globToRegExp);
  return files.map(toPosix).filter((file) => !ignores.some((pattern) => pattern.test(file)));
}

function readText(root, relative, limit) {
  const absolute = path.join(root, ...relative.split("/"));
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size > (limit || 1024 * 1024)) return null;
  const buffer = fs.readFileSync(absolute);
  if (buffer.subarray(0, 8192).includes(0)) return null;
  return buffer.toString("utf8");
}

function position(content, offset) { return content.slice(0, Math.max(0, offset)).split("\n").length; }
function createFinding(rule, file, line, variable, message, evidence, suggestion) { const definition = RULES[rule]; return { rule, title: definition.title, severity: definition.severity, category: definition.category, file: file || ".", line: line || 1, variable: variable || null, message, evidence: String(evidence || "").slice(0, 200), suggestion }; }

function variableRecord(name) {
  return { name, sensitive: SENSITIVE_NAME.test(name), requirement: "unknown", layers: { source: [], example: [], ci: [], container: [], docs: [] }, defaults: [] };
}

function addObservation(variables, name, layer, observation) {
  if (!variables.has(name)) variables.set(name, variableRecord(name));
  const record = variables.get(name);
  record.layers[layer].push(observation);
  if (observation.requirement === "required") record.requirement = "required";
  else if (observation.requirement === "optional" && record.requirement === "unknown") record.requirement = "optional";
  if (observation.defaultValue !== undefined) record.defaults.push({ file: observation.file, value: observation.defaultValue });
}

function sourcePatterns() {
  return [
    { language: "JavaScript", regex: /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g },
    { language: "JavaScript", regex: /\bprocess\.env\[["']([A-Z][A-Z0-9_]*)["']\]/g },
    { language: "Vite", regex: /\bimport\.meta\.env\.([A-Z][A-Z0-9_]*)\b/g },
    { language: "Deno", regex: /\bDeno\.env\.get\(["']([A-Z][A-Z0-9_]*)["']\)/g },
    { language: "Bun", regex: /\bBun\.env\.([A-Z][A-Z0-9_]*)\b/g },
    { language: "Python", regex: /\bos\.environ\[["']([A-Z][A-Z0-9_]*)["']\]/g, required: true },
    { language: "Python", regex: /\bos\.(?:getenv|environ\.get)\(["']([A-Z][A-Z0-9_]*)["']/g },
    { language: "Go", regex: /\bos\.(?:Getenv|LookupEnv)\(["']([A-Z][A-Z0-9_]*)["']\)/g },
    { language: "Rust", regex: /\b(?:std::)?env::var\(["']([A-Z][A-Z0-9_]*)["']\)|\b(?:env|option_env)!\(["']([A-Z][A-Z0-9_]*)["']\)/g },
    { language: "Java", regex: /\bSystem\.getenv\(["']([A-Z][A-Z0-9_]*)["']\)/g },
    { language: "Ruby", regex: /\bENV(?:\[["']([A-Z][A-Z0-9_]*)["']\]|\.fetch\(["']([A-Z][A-Z0-9_]*)["'])/g },
    { language: "PHP", regex: /\bgetenv\(["']([A-Z][A-Z0-9_]*)["']\)|\$_ENV\[["']([A-Z][A-Z0-9_]*)["']\]/g },
    { language: "C#", regex: /\bEnvironment\.GetEnvironmentVariable\(["']([A-Z][A-Z0-9_]*)["']\)/g }
  ];
}

function sourceFile(relative) { return /\.(?:c|cc|cpp|cs|go|java|js|jsx|mjs|cjs|php|py|rb|rs|swift|ts|tsx|vue)$/i.test(relative); }

function scanSource(root, files, variables, findings, config) {
  const required = new Set(config.required || []);
  const optional = new Set(config.optional || []);
  const dynamicPatterns = [/\bprocess\.env\[(?!["'])[^\]]+\]/g, /\bos\.(?:getenv|environ\.get)\((?!["'])[^)]+\)/g, /\bSystem\.getenv\((?!["'])[^)]+\)/g];
  for (const file of files.filter(sourceFile)) {
    const content = readText(root, file);
    if (content === null) continue;
    for (const definition of sourcePatterns()) {
      for (const match of content.matchAll(definition.regex)) {
        const name = match.slice(1).find(Boolean);
        const lineText = content.split("\n")[position(content, match.index) - 1] || "";
        const hasFallback = /(?:\?\?|\|\|)\s*[^;,)]+/.test(lineText) || /(?:getenv|\.get)\([^,]+,\s*[^)]+\)/.test(lineText);
        const requirement = required.has(name) || definition.required ? "required" : optional.has(name) || hasFallback ? "optional" : "unknown";
        const fallback = hasFallback ? lineText.slice(match.index - content.lastIndexOf("\n", match.index) - 1).match(/(?:\?\?|\|\||,)[\s]*(["'][^"']*["']|[^;,)]+)/)?.[1]?.trim() : undefined;
        addObservation(variables, name, "source", { file, line: position(content, match.index), language: definition.language, requirement, defaultValue: fallback });
        if (SENSITIVE_NAME.test(name) && fallback && !/^(?:["']?(?:|changeme|example|placeholder)["']?)$/i.test(fallback)) findings.push(createFinding("EM010", file, position(content, match.index), name, `${name} has a source-code fallback.`, "Sensitive fallback value is present", "Remove the fallback and require secret injection at runtime."));
      }
    }
    for (const pattern of dynamicPatterns) for (const match of content.matchAll(pattern)) findings.push(createFinding("EM008", file, position(content, match.index), null, "Variable name is computed dynamically and cannot be added to the contract.", match[0], "Use a static variable name or add the expected names to config.required/config.optional."));
  }
}

function placeholder(value) { return !value || /^(?:<[^>]+>|\$\{[^}]+\}|changeme|change_me|example|placeholder|your[_-].*|xxx+|todo)$/i.test(value.trim().replace(/^['"]|['"]$/g, "")); }

function scanExamples(root, files, variables, findings, config) {
  const patterns = (config.exampleFiles || []).map(globToRegExp);
  const examples = files.filter((file) => EXAMPLE_PATTERN.test(file) || patterns.some((pattern) => pattern.test(file)));
  for (const file of examples) {
    const content = readText(root, file) || "";
    const seen = new Map();
    content.split(/\r?\n/).forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
      if (!match || !/^[A-Z_][A-Z0-9_]*$/.test(match[1])) {
        findings.push(createFinding("EM006", file, index + 1, match?.[1], "Environment declaration is not a valid uppercase NAME=value entry.", trimmed, "Use an uppercase portable environment-variable name."));
        return;
      }
      const [name, value] = [match[1], match[2].trim()];
      if (seen.has(name)) findings.push(createFinding("EM007", file, index + 1, name, `${name} is declared more than once.`, `First declaration at line ${seen.get(name)}`, "Keep one authoritative declaration per example file."));
      seen.set(name, index + 1);
      addObservation(variables, name, "example", { file, line: index + 1, requirement: value ? "optional" : "unknown", defaultValue: value });
      if (SENSITIVE_NAME.test(name) && !placeholder(value)) findings.push(createFinding("EM003", file, index + 1, name, `${name} contains a concrete value in an example file.`, `Non-placeholder value (${value.length} characters)`, "Replace it with an empty value or an unmistakable placeholder and rotate any active credential."));
    });
  }
  return examples;
}

function scanDeployment(root, files, variables) {
  for (const file of files) {
    const lower = file.toLowerCase();
    const isCi = /^\.github\/workflows\/.*\.ya?ml$/.test(lower);
    const isContainer = /(^|\/)(?:dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml)$/.test(lower) || /(^|\/)(?:k8s|kubernetes|deploy)\//.test(lower);
    if (!isCi && !isContainer) continue;
    const content = readText(root, file) || "";
    const observations = new Map();
    if (isCi) {
      for (const match of content.matchAll(/\b(?:secrets|vars|env)\.([A-Z][A-Z0-9_]*)\b/g)) observations.set(match[1], position(content, match.index));
      for (const match of content.matchAll(/^\s{2,}([A-Z][A-Z0-9_]*)\s*:/gm)) observations.set(match[1], position(content, match.index));
      for (const [name, line] of observations) addObservation(variables, name, "ci", { file, line, requirement: "unknown" });
    }
    if (isContainer) {
      for (const match of content.matchAll(/^(?:\s*)(?:ARG|ENV)\s+([A-Z][A-Z0-9_]*)\b|^\s*-?\s*([A-Z][A-Z0-9_]*)\s*(?::|=)/gm)) observations.set(match[1] || match[2], position(content, match.index));
      for (const [name, line] of observations) addObservation(variables, name, "container", { file, line, requirement: "unknown" });
    }
  }
}

function scanDocs(root, files, variables) {
  const docs = files.filter((file) => /(^|\/)(?:readme|docs?\/).*\.(?:md|mdx|rst|adoc)$/i.test(file));
  for (const file of docs) {
    const content = readText(root, file) || "";
    for (const name of variables.keys()) {
      const match = new RegExp(`\\b${name}\\b`).exec(content);
      if (match) addObservation(variables, name, "docs", { file, line: position(content, match.index), requirement: "unknown" });
    }
  }
}

function finalize(variables, exampleFiles, findings, config) {
  const ignored = new Set(config.ignoreVariables || []);
  const allowUnused = new Set(config.allowUnused || []);
  const configuredRequired = new Set(config.required || []);
  const configuredOptional = new Set(config.optional || []);
  for (const record of variables.values()) {
    if (ignored.has(record.name)) continue;
    if (configuredRequired.has(record.name)) record.requirement = "required";
    else if (configuredOptional.has(record.name) && record.requirement === "unknown") record.requirement = "optional";
    const runtime = record.layers.source.length > 0;
    const example = record.layers.example.length > 0;
    if (runtime && !example) findings.push(createFinding("EM001", record.layers.source[0].file, record.layers.source[0].line, record.name, `${record.name} is read at runtime but absent from all example files.`, `${record.layers.source.length} source reference(s)`, "Add it to the canonical example with an empty value or safe placeholder."));
    if (example && !runtime && !allowUnused.has(record.name)) findings.push(createFinding("EM002", record.layers.example[0].file, record.layers.example[0].line, record.name, `${record.name} is declared in an example but never read by supported source patterns.`, `${record.layers.example.length} example declaration(s)`, "Remove stale configuration or add its runtime consumer to a supported/static contract."));
    if (record.requirement === "required" && record.layers.example.some((item) => !item.defaultValue)) findings.push(createFinding("EM005", record.layers.example[0]?.file || ".", record.layers.example[0]?.line || 1, record.name, `${record.name} is required but its example declaration is empty.`, "Required with empty example", "Use a descriptive placeholder that communicates the expected value shape."));
    if (record.requirement === "required" && !record.layers.ci.length && !record.layers.container.length) findings.push(createFinding("EM011", record.layers.source[0]?.file || ".", record.layers.source[0]?.line || 1, record.name, `${record.name} is required but absent from discovered CI and container configuration.`, "No deployment-layer reference", "Confirm external injection or document the deployment source."));
    const exampleDefaults = record.layers.example.map((item) => item.defaultValue);
    const normalized = new Set(exampleDefaults.map((value) => record.sensitive ? (placeholder(value) ? value : "[REDACTED]") : value));
    if (normalized.size > 1 && exampleFiles.length > 1) findings.push(createFinding("EM004", record.layers.example[0]?.file || ".", record.layers.example[0]?.line || 1, record.name, `${record.name} has conflicting defaults across example files.`, [...normalized].join(" vs "), "Choose one default or document environment-specific overrides."));
  }
}

function scanRepository(root, config) {
  const userConfig = config || {};
  for (const key of ["ignore", "exampleFiles", "required", "optional", "ignoreVariables", "allowUnused"]) if (userConfig[key] !== undefined && (!Array.isArray(userConfig[key]) || userConfig[key].some((item) => typeof item !== "string"))) throw new Error(`config.${key} must be an array of strings.`);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
  const files = listFiles(root, userConfig);
  const variables = new Map();
  const findings = [];
  scanSource(root, files, variables, findings, userConfig);
  const exampleFiles = scanExamples(root, files, variables, findings, userConfig);
  scanDeployment(root, files, variables);
  scanDocs(root, files, variables);
  for (const file of files.filter((item) => RUNTIME_ENV_PATTERN.test(item) && !EXAMPLE_PATTERN.test(item))) findings.push(createFinding("EM009", file, 1, null, `${file} appears in the repository publish set.`, file, "Remove it from Git history, rotate active values, and commit only a sanitized example."));
  finalize(variables, exampleFiles, findings, userConfig);
  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || (a.variable || "").localeCompare(b.variable || "") || a.file.localeCompare(b.file) || a.line - b.line);
  const rows = [...variables.values()].filter((item) => !(userConfig.ignoreVariables || []).includes(item.name)).sort((a, b) => a.name.localeCompare(b.name)).map((record) => ({
    ...record,
    layers: Object.fromEntries(Object.entries(record.layers).map(([layer, observations]) => [layer, observations.map((observation) => ({
      ...observation,
      ...(record.sensitive && observation.defaultValue !== undefined ? { defaultValue: "[REDACTED]" } : {})
    }))])),
    defaults: record.defaults.map((item) => ({ file: item.file, value: record.sensitive ? "[REDACTED]" : item.value }))
  }));
  const runtimeVariables = rows.filter((item) => item.layers.source.length);
  const covered = runtimeVariables.filter((item) => item.layers.example.length).length;
  const coverage = runtimeVariables.length ? Math.round((covered / runtimeVariables.length) * 100) : 100;
  const weights = { high: 15, medium: 6, low: 2 };
  const score = Math.max(0, 100 - findings.reduce((total, item) => total + weights[item.severity], 0));
  return { tool: "env-matrix", version: require("../package.json").version, root: path.resolve(root), repository: path.basename(path.resolve(root)), generatedAt: new Date().toISOString(), filesScanned: files.length, exampleFiles, variables: rows, summary: { variables: rows.length, runtimeVariables: runtimeVariables.length, coveredVariables: covered, coverage, sensitiveVariables: rows.filter((item) => item.sensitive).length, score, grade: score >= 95 ? "A" : score >= 85 ? "B" : score >= 70 ? "C" : score >= 55 ? "D" : "F" }, counts: { high: findings.filter((item) => item.severity === "high").length, medium: findings.filter((item) => item.severity === "medium").length, low: findings.filter((item) => item.severity === "low").length }, findings, rules: RULES };
}

module.exports = { EXAMPLE_PATTERN, RULES, SENSITIVE_NAME, addObservation, globToRegExp, placeholder, scanRepository, sourcePatterns };
