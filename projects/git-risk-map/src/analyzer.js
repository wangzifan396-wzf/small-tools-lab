"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const DEFAULT_THRESHOLDS = { critical: 75, high: 55, medium: 30, low: 0 };
const SOURCE_EXTENSIONS = new Set([".c", ".cc", ".cpp", ".cs", ".dart", ".ex", ".exs", ".go", ".java", ".js", ".jsx", ".kt", ".kts", ".lua", ".m", ".mm", ".php", ".py", ".rb", ".rs", ".scala", ".swift", ".ts", ".tsx", ".vue"]);
const CONFIG_NAMES = new Set(["package.json", "pyproject.toml", "cargo.toml", "go.mod", "gemfile", "composer.json", "pom.xml", "build.gradle", "makefile", "dockerfile", "tsconfig.json"]);
const DEPENDENCY_NAMES = new Set(["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "pyproject.toml", "poetry.lock", "requirements.txt", "pipfile.lock", "cargo.toml", "cargo.lock", "go.mod", "go.sum", "gemfile", "gemfile.lock", "composer.json", "composer.lock"]);

function toPosix(value) { return value.split(path.sep).join("/"); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

function globToRegExp(pattern) {
  const escaped = toPosix(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "::DOUBLE::").replaceAll("*", "[^/]*").replaceAll("::DOUBLE::", ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function git(root, args, options) {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
  } catch (error) {
    const detail = String(error.stderr || error.message).trim();
    throw new Error(`Git command failed (${args.join(" ")}): ${detail}`);
  }
}

function findRepository(start) {
  const location = path.resolve(start || ".");
  if (!fs.existsSync(location)) throw new Error(`Path does not exist: ${location}`);
  return path.resolve(git(location, ["rev-parse", "--show-toplevel"]).trim());
}

function diffArguments(options, flags) {
  const args = ["diff", ...(flags || [])];
  if (options.staged) args.push("--cached");
  else if (options.base) args.push(`${options.base}...${options.head || "HEAD"}`);
  else args.push("HEAD");
  return args;
}

function parseNameStatus(output) {
  const tokens = output.split("\0").filter((token) => token !== "");
  const changes = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    const code = status[0];
    if (code === "R" || code === "C") {
      const oldPath = toPosix(tokens[index++]);
      const file = toPosix(tokens[index++]);
      changes.push({ status: code, similarity: Number(status.slice(1)) || null, oldPath, file });
    } else {
      changes.push({ status: code, file: toPosix(tokens[index++]) });
    }
  }
  return changes;
}

function countUntracked(root, relative) {
  const absolute = path.join(root, ...relative.split("/"));
  const buffer = fs.readFileSync(absolute);
  const binary = buffer.subarray(0, 8192).includes(0);
  if (binary) return { additions: 0, deletions: 0, binary: true, currentLines: 0, bytes: buffer.length };
  const text = buffer.toString("utf8");
  const lines = text.length ? text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0) : 0;
  return { additions: lines, deletions: 0, binary: false, currentLines: lines, bytes: buffer.length };
}

function numstat(root, options, change) {
  if (change.status === "U") return countUntracked(root, change.file);
  const output = git(root, [...diffArguments(options, ["--numstat"]), "--", change.file]).trim();
  const line = output.split(/\r?\n/).find(Boolean);
  if (!line) return { additions: 0, deletions: 0, binary: false, currentLines: 0, bytes: 0 };
  const [added, deleted] = line.split("\t");
  const binary = added === "-" || deleted === "-";
  let currentLines = 0;
  let bytes = 0;
  const absolute = path.join(root, ...change.file.split("/"));
  if (change.status !== "D" && fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
    bytes = fs.statSync(absolute).size;
    if (!binary && bytes <= 2 * 1024 * 1024) {
      const text = fs.readFileSync(absolute, "utf8");
      currentLines = text.length ? text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0) : 0;
    }
  }
  return { additions: binary ? 0 : Number(added) || 0, deletions: binary ? 0 : Number(deleted) || 0, binary, currentLines, bytes };
}

function listChanges(root, options, config) {
  const output = git(root, [...diffArguments(options, ["--name-status", "-z", "--find-renames"]), "--"]);
  const changes = parseNameStatus(output);
  if (!options.base && !options.staged) {
    const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).map((file) => ({ status: "U", file: toPosix(file) }));
    const existing = new Set(changes.map((item) => item.file));
    changes.push(...untracked.filter((item) => !existing.has(item.file)));
  }
  const ignores = (config.ignore || []).map(globToRegExp);
  return changes.filter((change) => !ignores.some((pattern) => pattern.test(change.file)));
}

function classifyPath(filename) {
  const lower = filename.toLowerCase();
  const base = path.posix.basename(lower);
  const extension = path.posix.extname(lower);
  const tags = new Set();
  if (/(^|\/)(?:__tests__|tests?|specs?|e2e|fixtures)(\/|$)|\.(?:test|spec)\.[^.]+$/.test(lower)) tags.add("test");
  if (/(^|\/)(?:docs?|documentation)(\/|$)|\.(?:md|mdx|rst|adoc)$/.test(lower)) tags.add("docs");
  if (/(^|\/)(?:migrations?|schema|database\/migrations?)(\/|$)|(?:^|\.)migration\./.test(lower)) tags.add("migration");
  if (/(^|\/)(?:auth|authentication|authorization|security|permissions?|payments?|billing|crypto|secrets?|sessions?)(\/|$)/.test(lower)) tags.add("security");
  if (DEPENDENCY_NAMES.has(base)) tags.add("dependency");
  if (CONFIG_NAMES.has(base) || /\.(?:json|ya?ml|toml|ini|conf|config)$/.test(lower)) tags.add("config");
  if (/(^|\/)(?:\.github\/workflows|terraform|infra|k8s|kubernetes|deploy|ops)(\/|$)|(?:dockerfile|\.tf)$/.test(lower)) tags.add("infrastructure");
  if (/(^|\/)(?:dist|build|coverage|vendor|generated)(\/|$)|\.min\.(?:js|css)$/.test(lower)) tags.add("generated");
  if (SOURCE_EXTENSIONS.has(extension) && !tags.has("test")) tags.add("source");
  if (!tags.size) tags.add("other");
  return [...tags];
}

function historyFor(root, filename, days) {
  const output = git(root, ["log", `--since=${days}.days`, "--format=%H%x09%ae", "--", filename]);
  const rows = output.split(/\r?\n/).filter(Boolean);
  const authors = new Set(rows.map((row) => row.split("\t").slice(1).join("\t")).filter(Boolean));
  return { commits: rows.length, authors: authors.size };
}

function riskLevel(score, thresholds) {
  if (score >= thresholds.critical) return "critical";
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  return "low";
}

function scoreFile(change, context) {
  const signals = [];
  const add = (label, points, detail) => signals.push({ label, points, detail });
  const volume = change.additions + change.deletions;
  if (volume) add("Change volume", Math.min(24, Math.round(Math.log2(volume + 1) * 4)), `${volume} changed lines`);
  if (change.history.commits) add("Recent hotspot", Math.min(18, Math.round(change.history.commits * 1.5)), `${change.history.commits} commits in ${context.historyDays} days`);
  if (change.history.authors > 1) add("Shared ownership", Math.min(8, (change.history.authors - 1) * 2), `${change.history.authors} recent authors`);
  if (change.tags.includes("security")) add("Security-sensitive path", 24, "Authentication, permission, payment, or secret handling path");
  if (change.tags.includes("migration")) add("Migration or schema", 22, "May require ordering, compatibility, and rollback review");
  if (change.tags.includes("dependency")) add("Dependency surface", 16, "Manifest or lockfile changed");
  if (change.tags.includes("infrastructure")) add("Deployment surface", 14, "CI, infrastructure, or deployment path");
  if (change.tags.includes("config")) add("Configuration", 8, "Configuration behavior can vary by environment");
  if (change.tags.includes("source")) add("Runtime code", 4, "Executable source changed");
  if (change.tags.includes("test")) add("Test-only reduction", -8, "Change is in a test path");
  if (change.tags.includes("docs")) add("Documentation reduction", -12, "Change is documentation-only or documentation-focused");
  if (change.tags.includes("generated")) add("Generated-path reduction", -14, "Generated artifacts are reviewed through their source");
  if (change.binary) add("Binary change", 12, "Line-level review is unavailable");
  if (change.status === "D") add("File deletion", 6, "Downstream references may remain");
  if (change.status === "U") add("Untracked file", 3, "File is not yet in Git history");
  if (volume >= 20 && change.deletions / volume >= 0.6) add("Deletion-heavy", 8, `${Math.round((change.deletions / volume) * 100)}% deletions`);
  if (change.currentLines >= 700) add("Large file", 8, `${change.currentLines} current lines`);
  if (change.tags.includes("source") && !context.testsChanged) add("No tests changed", 10, "Runtime code changed without a test-file change in this diff");
  for (const rule of context.pathRules) {
    if (rule.pattern.test(change.file)) add(rule.label, rule.weight, `Custom path rule: ${rule.source}`);
  }
  const score = clamp(signals.reduce((total, signal) => total + signal.points, 0), 0, 100);
  return { score, level: riskLevel(score, context.thresholds), signals };
}

function createRecommendations(files, summary) {
  const recommendations = [];
  const has = (tag) => files.some((file) => file.tags.includes(tag));
  if (summary.sourceFiles > 0 && summary.testFiles === 0) recommendations.push("Add or identify focused tests for the changed runtime behavior before merge.");
  if (has("migration")) recommendations.push("Review migration ordering, backward compatibility, and a tested rollback path first.");
  if (has("security")) recommendations.push("Assign an explicit security-aware reviewer to authentication, permission, payment, or secret-handling changes.");
  if (has("dependency")) recommendations.push("Inspect manifest and lockfile changes together; verify provenance and release notes for upgraded dependencies.");
  if (files.some((file) => file.binary)) recommendations.push("Manually inspect binary artifacts because line-level diff analysis is unavailable.");
  if (summary.files >= 20) recommendations.push("Split or stage the review by subsystem; this change spans many files.");
  if (!recommendations.length) recommendations.push("Review files in the suggested order and run the repository's normal validation commands.");
  return recommendations;
}

function buildReviewPlan(files) {
  const buckets = [
    ["Critical surfaces", (file) => file.tags.some((tag) => ["security", "migration"].includes(tag))],
    ["Dependencies and delivery", (file) => file.tags.some((tag) => ["dependency", "infrastructure", "config"].includes(tag))],
    ["Runtime behavior", (file) => file.tags.includes("source")],
    ["Tests and documentation", (file) => file.tags.some((tag) => ["test", "docs"].includes(tag))],
    ["Other changes", () => true]
  ];
  const assigned = new Set();
  return buckets.map(([title, matches]) => {
    const selected = files.filter((file) => !assigned.has(file.file) && matches(file));
    selected.forEach((file) => assigned.add(file.file));
    return { title, files: selected.map((file) => file.file) };
  }).filter((group) => group.files.length);
}

function validateConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Configuration must be a JSON object.");
  if (config.ignore !== undefined && (!Array.isArray(config.ignore) || config.ignore.some((item) => typeof item !== "string"))) throw new Error("config.ignore must be an array of glob strings.");
  if (config.pathRules !== undefined && (!Array.isArray(config.pathRules) || config.pathRules.some((rule) => !rule || typeof rule.pattern !== "string" || !Number.isFinite(rule.weight)))) throw new Error("config.pathRules must contain pattern and numeric weight values.");
  if (config.thresholds !== undefined) {
    for (const key of ["critical", "high", "medium", "low"]) if (config.thresholds[key] !== undefined && !Number.isFinite(config.thresholds[key])) throw new Error(`config.thresholds.${key} must be numeric.`);
  }
}

function analyzeRepository(start, options, config) {
  const settings = options || {};
  const userConfig = config || {};
  validateConfig(userConfig);
  if (settings.base && settings.staged) throw new Error("--base and --staged cannot be used together.");
  const root = findRepository(start);
  const historyDays = Number(settings.historyDays || userConfig.historyDays || 90);
  if (!Number.isFinite(historyDays) || historyDays < 1 || historyDays > 3650) throw new Error("historyDays must be between 1 and 3650.");
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(userConfig.thresholds || {}) };
  if (!(thresholds.critical > thresholds.high && thresholds.high > thresholds.medium && thresholds.medium >= thresholds.low)) throw new Error("Risk thresholds must descend from critical to low.");
  const changes = listChanges(root, settings, userConfig);
  const pathRules = (userConfig.pathRules || []).map((rule) => ({ pattern: globToRegExp(rule.pattern), source: rule.pattern, label: rule.label || "Custom path risk", weight: clamp(Math.round(rule.weight), -50, 50) }));
  const enriched = changes.map((change) => ({ ...change, ...numstat(root, settings, change), tags: classifyPath(change.file), history: historyFor(root, change.oldPath || change.file, historyDays) }));
  const testsChanged = enriched.some((file) => file.tags.includes("test"));
  const files = enriched.map((change) => ({ ...change, ...scoreFile(change, { testsChanged, historyDays, thresholds, pathRules }) })).sort((a, b) => b.score - a.score || (b.additions + b.deletions) - (a.additions + a.deletions) || a.file.localeCompare(b.file));
  const sourceFiles = files.filter((file) => file.tags.includes("source")).length;
  const testFiles = files.filter((file) => file.tags.includes("test")).length;
  const summary = {
    files: files.length,
    additions: files.reduce((total, file) => total + file.additions, 0),
    deletions: files.reduce((total, file) => total + file.deletions, 0),
    sourceFiles,
    testFiles,
    testChangeRatio: sourceFiles ? Number((testFiles / sourceFiles).toFixed(2)) : null,
    binaryFiles: files.filter((file) => file.binary).length
  };
  const highest = files[0]?.score || 0;
  const blastRadius = files.length ? Math.min(16, Math.round(Math.log2(files.length + 1) * 4)) : 0;
  const overallScore = clamp(highest + blastRadius, 0, 100);
  const comparison = settings.staged ? "staged changes vs HEAD" : settings.base ? `${settings.base}...${settings.head || "HEAD"}` : "working tree vs HEAD";
  return {
    tool: "git-risk-map",
    version: require("../package.json").version,
    root,
    repository: path.basename(root),
    generatedAt: new Date().toISOString(),
    comparison,
    historyDays,
    thresholds,
    overall: { score: overallScore, level: riskLevel(overallScore, thresholds), blastRadius },
    summary,
    files,
    reviewPlan: buildReviewPlan(files),
    recommendations: createRecommendations(files, summary)
  };
}

module.exports = { DEFAULT_THRESHOLDS, analyzeRepository, classifyPath, findRepository, globToRegExp, parseNameStatus, riskLevel, scoreFile, validateConfig };
