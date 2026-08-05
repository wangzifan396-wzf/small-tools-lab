"use strict";

const fs = require("node:fs");
const path = require("node:path");

const VERSION = "0.1.0";
const IGNORE_NAMES = new Set([".gitignore", ".dockerignore", ".npmignore", ".eslintignore", ".prettierignore", ".ignore"]);
const SKIP_DIRS = new Set([".git", "node_modules", "coverage", "dist", "build", ".next", ".venv", "__pycache__"]);
const DEFAULTS = {
  ignore: [],
  maxRulesPerFile: 250,
  requiredDockerPatterns: [".git", "node_modules", ".env"],
  sensitivePatterns: [".env", ".env.*", "*.pem", "*.key", "credentials.json", "secrets.json"],
};

function toPosix(value) { return value.split(path.sep).join("/"); }
function escapeRegex(value) { return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"); }
function globRegex(pattern) {
  let source = escapeRegex(pattern.replace(/^\.\//, ""));
  source = source.replace(/\*\*/g, "::DOUBLE::").replace(/\*/g, "[^/]*").replace(/::DOUBLE::/g, ".*").replace(/\?/g, "[^/]");
  return new RegExp(`^${source}$`, "i");
}
function matchesGlob(value, pattern) {
  const clean = toPosix(value).replace(/^\.\//, "");
  const target = toPosix(pattern).replace(/^\//, "").replace(/\/$/, "");
  if (!target.includes("/")) return clean.split("/").some((segment) => globRegex(target).test(segment));
  return globRegex(target).test(clean);
}

function parseIgnore(content) {
  const rules = [];
  content.split(/\r?\n/).forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const negated = trimmed.startsWith("!");
    const body = negated ? trimmed.slice(1) : trimmed;
    const directoryOnly = body.endsWith("/");
    const anchored = body.startsWith("/");
    const pattern = body.replace(/^\//, "").replace(/\/$/, "");
    rules.push({ line: index + 1, raw: trimmed, pattern, normalized: pattern.replaceAll("\\", "/"), negated, directoryOnly, anchored });
  });
  return rules;
}

function ruleMatches(relative, isDirectory, rule) {
  const clean = toPosix(relative).replace(/^\.\//, "");
  if (rule.directoryOnly && !isDirectory && !clean.includes(`${rule.pattern}/`)) {
    if (!clean.startsWith(`${rule.pattern}/`)) return false;
  }
  if (rule.anchored || rule.pattern.includes("/")) {
    if (globRegex(rule.pattern).test(clean)) return true;
    return rule.directoryOnly && clean.startsWith(`${rule.pattern}/`);
  }
  return clean.split("/").some((segment) => globRegex(rule.pattern).test(segment));
}

function isIgnored(relative, isDirectory, rules) {
  let ignored = false;
  for (const rule of rules) if (ruleMatches(relative, isDirectory, rule)) ignored = !rule.negated;
  return ignored;
}

function ignoredByConfig(relative, patterns) { return patterns.some((pattern) => matchesGlob(relative, pattern)); }
function walk(root, options = {}) {
  const files = []; const directories = [];
  function visit(current) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name); const relative = toPosix(path.relative(root, absolute));
      if (ignoredByConfig(relative, options.ignore || [])) continue;
      if (entry.isDirectory()) {
        directories.push(relative);
        if (!SKIP_DIRS.has(entry.name)) visit(absolute);
      } else if (entry.isFile()) files.push(relative);
    }
  }
  visit(root); return { files, directories };
}

function severityCounts(findings) { return { high: findings.filter((item) => item.severity === "high").length, medium: findings.filter((item) => item.severity === "medium").length, low: findings.filter((item) => item.severity === "low").length }; }
function grade(score) { return score >= 95 ? "A" : score >= 85 ? "B" : score >= 70 ? "C" : score >= 55 ? "D" : "F"; }
function sensitiveMatch(value, patterns) { return patterns.some((pattern) => matchesGlob(value, pattern)) && !/(^|\/)\.env\.example$|\.example$|\.sample$|\.template$/i.test(value); }
function finding(rule, severity, file, line, message, evidence, suggestion) { return { rule, severity, file, line, message, evidence, suggestion }; }

function analyzeRepository(root, configuration = {}) {
  const absoluteRoot = path.resolve(root);
  if (!fs.statSync(absoluteRoot, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Not a directory: ${absoluteRoot}`);
  const config = { ...DEFAULTS, ...configuration };
  if (!Array.isArray(config.ignore) || !Array.isArray(config.sensitivePatterns) || !Array.isArray(config.requiredDockerPatterns)) throw new Error("ignore, sensitivePatterns, and requiredDockerPatterns must be arrays");
  if (!Number.isInteger(config.maxRulesPerFile) || config.maxRulesPerFile < 1) throw new Error("maxRulesPerFile must be a positive integer");
  const inventory = walk(absoluteRoot, config);
  const ignorePaths = inventory.files.filter((file) => IGNORE_NAMES.has(path.posix.basename(file))).sort();
  const parsed = ignorePaths.map((file) => {
    const rules = parseIgnore(fs.readFileSync(path.join(absoluteRoot, file), "utf8"));
    return { file, scope: path.posix.dirname(file) === "." ? "" : path.posix.dirname(file), kind: path.posix.basename(file), rules };
  });
  const findings = [];
  for (const ignoreFile of parsed) {
    const seen = new Map();
    for (const rule of ignoreFile.rules) {
      const key = `${rule.negated ? "!" : ""}${rule.normalized}`;
      if (seen.has(key)) findings.push(finding("ID005", "low", ignoreFile.file, rule.line, "Duplicate ignore rule.", `${rule.raw} duplicates line ${seen.get(key)}`, "Remove the duplicate so rule order remains easy to review."));
      else seen.set(key, rule.line);
      if (rule.negated && sensitiveMatch(rule.pattern, config.sensitivePatterns)) findings.push(finding("ID001", "high", ignoreFile.file, rule.line, "Sensitive content is explicitly re-included.", rule.raw, "Remove the negation or narrow it to a documented safe example file."));
      if (/^[A-Za-z]:\\|\\/.test(rule.raw)) findings.push(finding("ID006", "low", ignoreFile.file, rule.line, "Ignore rule is not portable across operating systems.", rule.raw, "Use repository-relative paths with forward slashes."));
      if (!rule.negated && ["*", "**", "**/*"].includes(rule.pattern)) findings.push(finding("ID007", "medium", ignoreFile.file, rule.line, "Blanket rule hides the entire scope.", rule.raw, "Replace the blanket rule with explicit generated or private paths."));
      if (rule.negated && !ignoreFile.rules.slice(0, ignoreFile.rules.indexOf(rule)).some((prior) => !prior.negated)) findings.push(finding("ID008", "low", ignoreFile.file, rule.line, "Negation appears before any excluding rule.", rule.raw, "Move the negation after the rule it is intended to override."));
    }
    if (ignoreFile.rules.length > config.maxRulesPerFile) findings.push(finding("ID009", "medium", ignoreFile.file, 0, "Ignore file exceeds the reviewed rule budget.", `${ignoreFile.rules.length} rules > ${config.maxRulesPerFile}`, "Split generated scopes or simplify redundant patterns."));
    if (ignoreFile.kind === ".dockerignore") {
      for (const required of config.requiredDockerPatterns) if (!isIgnored(required, required !== ".env", ignoreFile.rules)) findings.push(finding("ID004", "medium", ignoreFile.file, 0, `Docker context does not exclude ${required}.`, required, "Add an explicit Docker ignore rule to reduce context size and disclosure risk."));
    }
  }
  const gitIgnores = parsed.filter((item) => item.kind === ".gitignore").sort((a, b) => b.scope.length - a.scope.length);
  function effectiveGitRules(relative) {
    const applicable = gitIgnores.filter((item) => !item.scope || relative === item.scope || relative.startsWith(`${item.scope}/`)).sort((a, b) => a.scope.length - b.scope.length);
    return applicable.flatMap((item) => item.rules.map((rule) => ({ ...rule, pattern: item.scope ? `${item.scope}/${rule.pattern}` : rule.pattern, anchored: true })));
  }
  for (const file of inventory.files) {
    if (!sensitiveMatch(file, config.sensitivePatterns)) continue;
    if (!isIgnored(file, false, effectiveGitRules(file))) findings.push(finding("ID002", "high", file, 0, "Sensitive-looking file is visible to Git.", file, "Ignore the file, remove it from the repository, and rotate real credentials if needed."));
  }
  for (const directory of inventory.directories.filter((item) => /(^|\/)(node_modules|\.venv|coverage)$/.test(item))) {
    if (!isIgnored(directory, true, effectiveGitRules(directory))) findings.push(finding("ID003", "medium", directory, 0, "Generated or dependency directory is visible to Git.", directory, "Add the directory to the nearest .gitignore."));
  }
  const severityOrder = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
  const counts = severityCounts(findings); const score = Math.max(0, 100 - Math.min(60, counts.high * 20) - Math.min(35, counts.medium * 8) - Math.min(15, counts.low * 3));
  return {
    tool: "ignore-doctor", version: VERSION, generatedAt: new Date().toISOString(), repository: path.basename(absoluteRoot), root: absoluteRoot, config,
    summary: { score, grade: grade(score), ignoreFiles: parsed.length, rules: parsed.reduce((sum, item) => sum + item.rules.length, 0), findings: findings.length }, counts,
    files: parsed.map((item) => ({ file: item.file, kind: item.kind, scope: item.scope || ".", rules: item.rules.length, negations: item.rules.filter((rule) => rule.negated).length })), findings,
  };
}

module.exports = { analyzeRepository, globRegex, isIgnored, matchesGlob, parseIgnore, ruleMatches, sensitiveMatch };
