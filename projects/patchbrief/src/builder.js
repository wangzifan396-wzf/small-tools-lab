"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const SOURCE_EXTENSIONS = new Set([".c", ".cc", ".cpp", ".cs", ".go", ".java", ".js", ".jsx", ".mjs", ".cjs", ".php", ".py", ".rb", ".rs", ".swift", ".ts", ".tsx", ".vue"]);
const MANIFEST_NAMES = new Set(["package.json", "pyproject.toml", "cargo.toml", "go.mod", "gemfile", "composer.json", "pom.xml", "build.gradle"]);
const INSTRUCTION_NAMES = new Set(["agents.md", "claude.md", "gemini.md"]);

function toPosix(value) { return value.split(path.sep).join("/"); }
function estimateTokens(value) { return Math.ceil(String(value || "").length / 4); }

function globToRegExp(pattern) {
  const escaped = toPosix(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "::DOUBLE::").replaceAll("*", "[^/]*").replaceAll("::DOUBLE::", ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function git(root, args) {
  try {
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
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
    if (code === "R" || code === "C") changes.push({ status: code, similarity: Number(status.slice(1)) || null, oldPath: toPosix(tokens[index++]), file: toPosix(tokens[index++]) });
    else changes.push({ status: code, file: toPosix(tokens[index++]) });
  }
  return changes;
}

function listRepositoryFiles(root, config) {
  const files = git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).map(toPosix);
  const ignores = (config.ignore || []).map(globToRegExp);
  return files.filter((file) => !ignores.some((pattern) => pattern.test(file)));
}

function listChanges(root, options, config) {
  const output = git(root, [...diffArguments(options, ["--name-status", "-z", "--find-renames"]), "--"]);
  const changes = parseNameStatus(output);
  if (!options.base && !options.staged) {
    const existing = new Set(changes.map((item) => item.file));
    const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).map((file) => ({ status: "U", file: toPosix(file) }));
    changes.push(...untracked.filter((item) => !existing.has(item.file)));
  }
  const ignores = (config.ignore || []).map(globToRegExp);
  return changes.filter((change) => !ignores.some((pattern) => pattern.test(change.file)));
}

function readText(root, relative, maximum) {
  const absolute = path.join(root, ...relative.split("/"));
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size > maximum) return null;
  const buffer = fs.readFileSync(absolute);
  if (buffer.subarray(0, 8192).includes(0)) return null;
  return buffer.toString("utf8");
}

function untrackedPatch(file, content) {
  const lines = content.split(/\r?\n/);
  const count = lines.length - (content.endsWith("\n") ? 1 : 0);
  return [`diff --git a/${file} b/${file}`, "new file (untracked)", "--- /dev/null", `+++ b/${file}`, `@@ -0,0 +1,${count} @@`, ...lines.slice(0, count).map((line) => `+${line}`)].join("\n");
}

function patchFor(root, options, change, maximum) {
  if (change.status === "U") {
    const content = readText(root, change.file, maximum);
    return content === null ? `Binary or oversized untracked file: ${change.file}` : untrackedPatch(change.file, content);
  }
  return git(root, [...diffArguments(options, ["--no-color", "--unified=3", "--binary"]), "--", change.file]).trim();
}

function extractChangedRanges(patch) {
  const ranges = [];
  for (const match of patch.matchAll(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    if (count > 0) ranges.push({ start, end: start + count - 1 });
  }
  return ranges;
}

function mergeRanges(ranges, contextLines, maximumLine) {
  const expanded = ranges.map((range) => ({ start: Math.max(1, range.start - contextLines), end: Math.min(maximumLine, range.end + contextLines) })).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const range of expanded) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 1) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

function createSnippet(content, ranges, contextLines) {
  const lines = content.split(/\r?\n/);
  const merged = mergeRanges(ranges, contextLines, lines.length);
  return merged.map((range) => {
    const body = lines.slice(range.start - 1, range.end).map((line, index) => `${String(range.start + index).padStart(5)} | ${line}`).join("\n");
    return `lines ${range.start}-${range.end}\n${body}`;
  }).join("\n\n");
}

function redactContent(content, enabled) {
  if (!enabled) return { content, count: 0, types: [] };
  const patterns = [
    ["GITHUB_TOKEN", /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/g],
    ["API_TOKEN", /\bsk-[A-Za-z0-9_-]{20,}\b/g],
    ["AWS_KEY", /\bAKIA[0-9A-Z]{16}\b/g],
    ["PRIVATE_KEY", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ["SECRET_VALUE", /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret)\s*[:=]\s*["'][^"'\r\n]{12,}["']/gi]
  ];
  let output = content;
  let count = 0;
  const types = new Set();
  for (const [type, pattern] of patterns) {
    output = output.replace(pattern, () => { count += 1; types.add(type); return `[REDACTED:${type}]`; });
  }
  return { content: output, count, types: [...types] };
}

function localImportSpecifiers(content, extension) {
  const values = new Set();
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue"].includes(extension)) {
    for (const match of content.matchAll(/(?:from\s*|require\s*\(|import\s*\()\s*["'](\.{1,2}\/[^"']+)["']/g)) values.add(match[1]);
  }
  if (extension === ".py") {
    for (const match of content.matchAll(/^from\s+(\.+[\w.]*)\s+import\s+/gm)) values.add(match[1]);
  }
  return [...values];
}

function resolveLocalImport(root, importer, specifier) {
  const importerDirectory = path.posix.dirname(importer);
  if (specifier.startsWith("." ) && path.posix.extname(importer) === ".py" && !specifier.includes("/")) {
    const dots = /^\.+/.exec(specifier)[0].length;
    let base = importerDirectory;
    for (let index = 1; index < dots; index += 1) base = path.posix.dirname(base);
    const suffix = specifier.slice(dots).replaceAll(".", "/");
    const candidate = path.posix.join(base, suffix || "__init__");
    for (const value of [`${candidate}.py`, `${candidate}/__init__.py`]) if (fs.existsSync(path.join(root, ...value.split("/")))) return value;
    return null;
  }
  const base = path.posix.normalize(path.posix.join(importerDirectory, specifier));
  const candidates = [base, ...[".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py"].map((extension) => `${base}${extension}`), ...["index.js", "index.ts", "index.tsx", "__init__.py"].map((name) => `${base}/${name}`)];
  return candidates.find((candidate) => fs.existsSync(path.join(root, ...candidate.split("/"))) && fs.statSync(path.join(root, ...candidate.split("/"))).isFile()) || null;
}

function applicableInstructions(files, changes) {
  return files.filter((file) => {
    const base = path.posix.basename(file).toLowerCase();
    if (!INSTRUCTION_NAMES.has(base) && base !== "skill.md") return false;
    const directory = path.posix.dirname(file) === "." ? "" : `${path.posix.dirname(file)}/`;
    return changes.some((change) => change.file.startsWith(directory));
  });
}

function relatedTests(files, changedFiles) {
  const tests = files.filter((file) => /(^|\/)(?:__tests__|tests?|specs?)(\/|$)|\.(?:test|spec)\.[^.]+$/i.test(file));
  const result = new Set();
  for (const changed of changedFiles) {
    const stem = path.posix.basename(changed, path.posix.extname(changed)).replace(/\.(?:test|spec)$/i, "").toLowerCase();
    tests.filter((file) => path.posix.basename(file).toLowerCase().includes(stem)).slice(0, 5).forEach((file) => result.add(file));
  }
  return [...result];
}

function truncateMiddle(content, maximumTokens) {
  const marker = "\n... [TRUNCATED TO FIT TOKEN BUDGET] ...\n";
  const maximumCharacters = Math.max(0, maximumTokens * 4 - marker.length);
  if (content.length <= maximumTokens * 4) return { content, truncated: false };
  const head = Math.ceil(maximumCharacters * 0.62);
  return { content: `${content.slice(0, head)}${marker}${content.slice(content.length - (maximumCharacters - head))}`, truncated: true };
}

function selectCandidates(candidates, budget, metadataTokens) {
  const contextBudget = Math.max(0, budget - metadataTokens);
  const essential = candidates.filter((item) => item.essential).sort((a, b) => b.priority - a.priority || a.file.localeCompare(b.file));
  const optional = candidates.filter((item) => !item.essential).sort((a, b) => b.priority - a.priority || a.kind.localeCompare(b.kind) || a.file.localeCompare(b.file));
  const selected = [];
  const excluded = [];
  let used = 0;
  const essentialTokens = essential.reduce((total, item) => total + item.tokens, 0);
  const essentialTarget = optional.length && essentialTokens > Math.floor(contextBudget * 0.75) ? Math.floor(contextBudget * 0.75) : Math.min(essentialTokens, contextBudget);
  if (essentialTokens <= essentialTarget) {
    for (const candidate of essential) {
      selected.push(candidate);
      used += candidate.tokens;
    }
  }
  let essentialRemaining = essentialTarget;
  if (essentialTokens > essentialTarget) essential.forEach((candidate, index) => {
    const slots = essential.length - index;
    const allowance = Math.max(0, Math.floor(essentialRemaining / slots));
    if (allowance < 20) { excluded.push({ ...candidate, exclusionReason: "Token budget cannot provide a useful essential slice" }); return; }
    const rendered = truncateMiddle(candidate.content, allowance);
    const tokens = estimateTokens(rendered.content);
    selected.push({ ...candidate, content: rendered.content, tokens, truncated: rendered.truncated });
    used += tokens;
    essentialRemaining -= tokens;
  });
  for (const candidate of optional) {
    const remaining = contextBudget - used;
    if (candidate.tokens <= remaining) {
      selected.push(candidate);
      used += candidate.tokens;
    } else if (remaining >= 120) {
      const rendered = truncateMiddle(candidate.content, remaining);
      const tokens = estimateTokens(rendered.content);
      selected.push({ ...candidate, content: rendered.content, tokens, truncated: true });
      used += tokens;
    } else excluded.push({ ...candidate, exclusionReason: "Token budget exhausted" });
  }
  const selectedIds = new Set(selected.map((item) => item.id));
  for (const candidate of candidates) if (!selectedIds.has(candidate.id) && !excluded.some((item) => item.id === candidate.id)) excluded.push({ ...candidate, exclusionReason: "Token budget exhausted" });
  return { selected, excluded, usedTokens: used + metadataTokens, contextTokens: used };
}

function addCandidate(candidates, seen, candidate, redactionEnabled, redactionSummary) {
  if (!candidate.content || seen.has(candidate.id)) return;
  const redacted = redactContent(candidate.content, redactionEnabled);
  redactionSummary.count += redacted.count;
  redacted.types.forEach((type) => redactionSummary.types.add(type));
  const item = { ...candidate, content: redacted.content, tokens: estimateTokens(redacted.content), redactions: redacted.count };
  candidates.push(item);
  seen.add(candidate.id);
}

function buildPacket(start, options, config) {
  const settings = options || {};
  const userConfig = config || {};
  if (settings.base && settings.staged) throw new Error("--base and --staged cannot be used together.");
  if (userConfig.ignore !== undefined && (!Array.isArray(userConfig.ignore) || userConfig.ignore.some((item) => typeof item !== "string"))) throw new Error("config.ignore must be an array of glob strings.");
  if (userConfig.alwaysInclude !== undefined && (!Array.isArray(userConfig.alwaysInclude) || userConfig.alwaysInclude.some((item) => typeof item !== "string"))) throw new Error("config.alwaysInclude must be an array of glob strings.");
  const budget = Number(settings.budget || userConfig.budget || 12000);
  const contextLines = Number(settings.contextLines ?? userConfig.contextLines ?? 20);
  const maximumFileBytes = Number(userConfig.maxFileBytes || 1024 * 1024);
  if (!Number.isFinite(budget) || budget < 500 || budget > 1000000) throw new Error("Token budget must be between 500 and 1000000.");
  if (!Number.isFinite(contextLines) || contextLines < 0 || contextLines > 200) throw new Error("Context lines must be between 0 and 200.");
  if (!Number.isFinite(maximumFileBytes) || maximumFileBytes < 1024 || maximumFileBytes > 100 * 1024 * 1024) throw new Error("maxFileBytes must be between 1024 and 104857600.");
  const root = findRepository(start);
  const files = listRepositoryFiles(root, userConfig);
  const changes = listChanges(root, settings, userConfig);
  const changedSet = new Set(changes.map((item) => item.file));
  const candidates = [];
  const seen = new Set();
  const redactionSummary = { count: 0, types: new Set() };
  const redact = settings.redact !== false;
  const add = (candidate) => addCandidate(candidates, seen, candidate, redact, redactionSummary);

  for (const change of changes) {
    const patch = patchFor(root, settings, change, maximumFileBytes);
    add({ id: `diff:${change.file}`, kind: "diff", title: `Diff: ${change.file}`, file: change.file, priority: 100, essential: true, reason: "Changed file patch", language: "diff", content: patch });
    if (change.status === "D") continue;
    const current = readText(root, change.file, maximumFileBytes);
    if (current !== null) {
      const zeroPatch = change.status === "U" ? untrackedPatch(change.file, current) : git(root, [...diffArguments(settings, ["--no-color", "--unified=0"]), "--", change.file]);
      const ranges = extractChangedRanges(zeroPatch);
      const snippet = createSnippet(current, ranges.length ? ranges : [{ start: 1, end: Math.min(current.split(/\r?\n/).length, 1) }], contextLines);
      add({ id: `snippet:${change.file}`, kind: "snippet", title: `Changed context: ${change.file}`, file: change.file, priority: 85, essential: false, reason: `${contextLines} lines around changed ranges`, language: path.posix.extname(change.file).slice(1) || "text", content: snippet });
    }
  }

  for (const file of applicableInstructions(files, changes)) {
    const content = readText(root, file, maximumFileBytes);
    if (content !== null) add({ id: `instruction:${file}`, kind: "instruction", title: `Applicable instructions: ${file}`, file, priority: 95, essential: true, reason: "Instruction scope contains a changed file", language: "markdown", content });
  }

  const manifestFiles = files.filter((file) => MANIFEST_NAMES.has(path.posix.basename(file).toLowerCase()) && (path.posix.dirname(file) === "." || changes.some((change) => change.file.startsWith(`${path.posix.dirname(file)}/`))));
  for (const file of manifestFiles) {
    const content = readText(root, file, maximumFileBytes);
    if (content !== null) add({ id: `manifest:${file}`, kind: "manifest", title: `Manifest: ${file}`, file, priority: 80, essential: false, reason: "Build and dependency context", language: path.posix.extname(file).slice(1) || "text", content });
  }

  for (const file of relatedTests(files, [...changedSet])) {
    if (changedSet.has(file)) continue;
    const content = readText(root, file, maximumFileBytes);
    if (content !== null) add({ id: `test:${file}`, kind: "test", title: `Related test: ${file}`, file, priority: 75, essential: false, reason: "Test filename matches a changed file", language: path.posix.extname(file).slice(1) || "text", content });
  }

  const dependencyFiles = new Set();
  for (const file of changedSet) {
    const content = readText(root, file, maximumFileBytes);
    if (content === null || !SOURCE_EXTENSIONS.has(path.posix.extname(file).toLowerCase())) continue;
    for (const specifier of localImportSpecifiers(content, path.posix.extname(file).toLowerCase())) {
      const resolved = resolveLocalImport(root, file, specifier);
      if (resolved && !changedSet.has(resolved)) dependencyFiles.add(resolved);
    }
  }
  for (const file of [...dependencyFiles].sort()) {
    const content = readText(root, file, maximumFileBytes);
    if (content !== null) add({ id: `dependency:${file}`, kind: "dependency", title: `Local dependency: ${file}`, file, priority: 65, essential: false, reason: "Imported by a changed source file", language: path.posix.extname(file).slice(1) || "text", content });
  }

  const importerLimit = Number(userConfig.importerScanLimit || 2000);
  if (!Number.isFinite(importerLimit) || importerLimit < 0 || importerLimit > 100000) throw new Error("importerScanLimit must be between 0 and 100000.");
  const sourceFiles = files.filter((file) => SOURCE_EXTENSIONS.has(path.posix.extname(file).toLowerCase()) && !changedSet.has(file)).slice(0, importerLimit);
  let importerCount = 0;
  for (const file of sourceFiles) {
    if (importerCount >= 10) break;
    const content = readText(root, file, Math.min(maximumFileBytes, 256 * 1024));
    if (content === null) continue;
    const importsChanged = localImportSpecifiers(content, path.posix.extname(file).toLowerCase()).some((specifier) => changedSet.has(resolveLocalImport(root, file, specifier)));
    if (importsChanged && !candidates.some((candidate) => candidate.file === file && ["test", "dependency", "manifest", "explicit"].includes(candidate.kind))) {
      add({ id: `importer:${file}`, kind: "importer", title: `Direct importer: ${file}`, file, priority: 55, essential: false, reason: "Imports a changed source file", language: path.posix.extname(file).slice(1) || "text", content });
      importerCount += 1;
    }
  }

  for (const pattern of userConfig.alwaysInclude || []) {
    const matcher = globToRegExp(pattern);
    for (const file of files.filter((item) => matcher.test(item))) {
      if (candidates.some((candidate) => candidate.file === file && !["diff", "snippet"].includes(candidate.kind))) continue;
      const content = readText(root, file, maximumFileBytes);
      if (content !== null) add({ id: `explicit:${file}`, kind: "explicit", title: `Configured context: ${file}`, file, priority: 70, essential: false, reason: `Matched alwaysInclude pattern ${pattern}`, language: path.posix.extname(file).slice(1) || "text", content });
    }
  }

  const comparison = settings.staged ? "staged changes vs HEAD" : settings.base ? `${settings.base}...${settings.head || "HEAD"}` : "working tree vs HEAD";
  const metadataTokens = Math.min(500, 120 + changes.length * 8 + candidates.length * 4);
  const selection = selectCandidates(candidates, budget, metadataTokens);
  const kindCounts = selection.selected.reduce((result, item) => { result[item.kind] = (result[item.kind] || 0) + 1; return result; }, {});
  return {
    tool: "patchbrief",
    version: require("../package.json").version,
    root,
    repository: path.basename(root),
    generatedAt: new Date().toISOString(),
    comparison,
    budget,
    estimatedTokens: selection.usedTokens,
    remainingTokens: Math.max(0, budget - selection.usedTokens),
    contextLines,
    redaction: { enabled: redact, count: redactionSummary.count, types: [...redactionSummary.types].sort() },
    changes,
    sections: selection.selected,
    excluded: selection.excluded.map((item) => ({ id: item.id, kind: item.kind, file: item.file, tokens: item.tokens, reason: item.exclusionReason })),
    kindCounts
  };
}

module.exports = { buildPacket, createSnippet, estimateTokens, extractChangedRanges, findRepository, globToRegExp, localImportSpecifiers, mergeRanges, parseNameStatus, redactContent, resolveLocalImport, selectCandidates, truncateMiddle };
