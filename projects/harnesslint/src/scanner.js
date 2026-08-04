"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const RULES = {
  HL001: { title: "Broken path reference", severity: "medium", category: "integrity" },
  HL002: { title: "Broken validation command", severity: "medium", category: "integrity" },
  HL003: { title: "Oversized context file", severity: "medium", category: "quality" },
  HL004: { title: "Secret-like value", severity: "high", category: "security" },
  HL005: { title: "Destructive shell instruction", severity: "high", category: "security" },
  HL006: { title: "Potential data exfiltration", severity: "high", category: "security" },
  HL007: { title: "Unpinned package execution", severity: "medium", category: "supply-chain" },
  HL008: { title: "Broad tool permission", severity: "high", category: "permissions" },
  HL009: { title: "Conflicting instructions", severity: "medium", category: "integrity" },
  HL010: { title: "Duplicated instruction", severity: "low", category: "quality" },
  HL011: { title: "Invalid skill frontmatter", severity: "medium", category: "integrity" },
  HL012: { title: "Hidden Unicode control", severity: "high", category: "security" },
  HL013: { title: "Shell-wrapped MCP server", severity: "high", category: "supply-chain" },
  HL014: { title: "Insecure MCP transport", severity: "medium", category: "security" },
  HL015: { title: "Malformed JSON configuration", severity: "high", category: "integrity" },
  HL100: { title: "Missing root instructions", severity: "low", category: "readiness" },
  HL101: { title: "Missing validation guidance", severity: "low", category: "readiness" }
};

const SEVERITY = { info: 0, low: 1, medium: 2, high: 3 };
const INSTRUCTION_NAMES = new Set(["agents.md", "claude.md", "gemini.md", ".cursorrules", "copilot-instructions.md", "skill.md"]);
const DEFAULT_IGNORES = [".git", "node_modules", "dist", "build", "coverage", ".next", "vendor", "target"];

function severityRank(value) { return SEVERITY[value] ?? -1; }
function toPosix(value) { return value.split(path.sep).join("/"); }

function globToRegExp(pattern) {
  const escaped = toPosix(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "::DOUBLE::").replaceAll("*", "[^/]*").replaceAll("::DOUBLE::", ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function listRepositoryFiles(root, config) {
  let files;
  try {
    const output = execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    files = output.split("\0").filter(Boolean);
  } catch (_error) {
    files = [];
    const walk = (directory, relative) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (DEFAULT_IGNORES.includes(entry.name)) continue;
        const nextRelative = relative ? path.join(relative, entry.name) : entry.name;
        if (entry.isDirectory()) walk(path.join(directory, entry.name), nextRelative);
        else files.push(nextRelative);
      }
    };
    walk(root, "");
  }
  const ignores = [...(config.ignore || []), ...(config.excludes || [])].map(globToRegExp);
  return files.map(toPosix).filter((file) => !ignores.some((pattern) => pattern.test(file)));
}

function isHarnessFile(relative) {
  const lower = relative.toLowerCase();
  const base = path.posix.basename(lower);
  return INSTRUCTION_NAMES.has(base)
    || lower === ".mcp.json"
    || /(^|\/)mcp\.json$/.test(lower)
    || /^\.cursor\/rules\/.*\.mdc$/.test(lower)
    || /^\.claude\/(commands|agents|skills)\/.*\.md$/.test(lower)
    || /^\.claude\/settings(?:\.local)?\.json$/.test(lower)
    || /(^|\/)claude_desktop_config\.json$/.test(lower);
}

function lineAndColumn(content, offset) {
  const before = content.slice(0, Math.max(0, offset));
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function fingerprint(rule, file, line, evidence) {
  return crypto.createHash("sha256").update(`${rule}\0${file}\0${line}\0${String(evidence).trim().toLowerCase()}`).digest("hex").slice(0, 20);
}

function finding(rule, file, content, offset, message, evidence, suggestion, severity) {
  const position = lineAndColumn(content, offset);
  return {
    rule,
    severity: severity || RULES[rule].severity,
    category: RULES[rule].category,
    file,
    line: position.line,
    column: position.column,
    message,
    evidence: String(evidence || "").trim().slice(0, 240),
    suggestion,
    fingerprint: fingerprint(rule, file, position.line, evidence || message)
  };
}

function readFiles(root, relativeFiles) {
  return relativeFiles.filter(isHarnessFile).map((relative) => {
    const absolute = path.join(root, ...relative.split("/"));
    const stat = fs.statSync(absolute);
    if (stat.size > 1024 * 1024) return { relative, absolute, size: stat.size, content: "", skipped: true };
    return { relative, absolute, size: stat.size, content: fs.readFileSync(absolute, "utf8") };
  });
}

function scanTextSecurity(file, findings) {
  const patterns = [
    ["HL004", /(?:sk-[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|(?:api[_-]?key|token|password)\s*[:=]\s*["'][^"'\s]{12,}["'])/gi, "Secret-like literal found in an agent-readable file.", "Replace the value with an environment variable or secret-store reference."],
    ["HL005", /(?:rm\s+-rf\s+(?:\/|~|\$HOME)|git\s+reset\s+--hard|git\s+clean\s+-[a-z]*f|--no-preserve-root|Remove-Item\s+[^\n]*-Recurse\s+-Force|chmod\s+777)/gi, "Destructive shell operation can cause irreversible data loss.", "Require explicit human approval and constrain the command to a validated project path."],
    ["HL006", /(?:curl[^\n]*(?:-d|--data|--upload-file|-T)[^\n]*https?:\/\/|(?:env|printenv|Get-ChildItem\s+Env:)\s*\|[^\n]*(?:curl|wget|nc\b)|nc\s+(?:-w\s+\d+\s+)?[^\s]+\s+\d+)/gi, "Instruction may transmit local data to a remote endpoint.", "Remove the network transfer or document a narrow, reviewable allowlist."],
    ["HL012", /[\u202A-\u202E\u2066-\u2069\u200B\u200C\u200D\uFEFF]/g, "Hidden or bidirectional Unicode control can disguise instructions.", "Remove invisible controls and use plain visible text."]
  ];
  for (const [rule, pattern, message, suggestion] of patterns) {
    for (const match of file.content.matchAll(pattern)) findings.push(finding(rule, file.relative, file.content, match.index, message, match[0], suggestion));
  }
}

function pathCandidates(content) {
  const candidates = [];
  const patterns = [/\]\(([^)\s#]+)(?:#[^)]+)?\)/g, /`([^`\n]+)`/g];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const value = match[1].trim().replace(/[,:;.]$/, "");
      if (/^(?:https?:|mailto:|#|[A-Z_]+\s*=)/i.test(value) || /[<>*{}$]/.test(value)) continue;
      if (/^(?:\.\.?\/|[\w.-]+\/)[\w./-]+$/.test(value) || /^(?:package\.json|tsconfig\.json|pyproject\.toml)$/i.test(value)) candidates.push({ value, offset: match.index + match[0].indexOf(match[1]) });
    }
  }
  return candidates;
}

function resolveLocalPath(root, file, value) {
  return [...new Set([
    path.resolve(path.dirname(file.absolute), value),
    path.resolve(root, value)
  ])];
}

function loadNearestPackageScripts(root, file) {
  let directory = path.dirname(file.absolute);
  while (true) {
    const manifest = path.join(directory, "package.json");
    if (fs.existsSync(manifest)) {
      try { return JSON.parse(fs.readFileSync(manifest, "utf8")).scripts || {}; }
      catch (_error) { return {}; }
    }
    if (directory === root) return {};
    const parent = path.dirname(directory);
    if (parent === directory || path.relative(root, parent).startsWith("..")) return {};
    directory = parent;
  }
}

function scanReferences(root, file, findings) {
  const packageScripts = loadNearestPackageScripts(root, file);
  const seen = new Set();
  for (const candidate of pathCandidates(file.content)) {
    const cleaned = candidate.value.replace(/:\d+(?::\d+)?$/, "").replace(/[?#].*$/, "");
    const locations = resolveLocalPath(root, file, cleaned);
    if (!locations.some(fs.existsSync) && !seen.has(cleaned)) {
      seen.add(cleaned);
      findings.push(finding("HL001", file.relative, file.content, candidate.offset, `Referenced path does not exist: ${cleaned}`, candidate.value, "Update the reference or add the missing file."));
    }
  }

  for (const match of file.content.matchAll(/\bnpm\s+run\s+([\w:-]+)/g)) {
    if (!Object.hasOwn(packageScripts, match[1])) findings.push(finding("HL002", file.relative, file.content, match.index, `Package script does not exist: ${match[1]}`, match[0], "Add the script to package.json or correct the validation command."));
  }
  for (const match of file.content.matchAll(/\b(?:node|python(?:3)?|bash|pwsh)\s+([\w./-]+\.(?:js|mjs|cjs|py|sh|ps1))/g)) {
    if (!resolveLocalPath(root, file, match[1]).some(fs.existsSync)) findings.push(finding("HL002", file.relative, file.content, match.index, `Command target does not exist: ${match[1]}`, match[0], "Correct the command path or add the referenced script."));
  }
}

function packageIsPinned(value) {
  if (!value || value.startsWith("-") || value.startsWith(".")) return true;
  if (value.startsWith("@")) return /^@[^/]+\/[^@]+@(?:\d|[~^<>=])/.test(value);
  return /@(?:\d|[~^<>=])/.test(value);
}

function visitJson(value, callback, trail) {
  callback(value, trail);
  if (Array.isArray(value)) value.forEach((item, index) => visitJson(item, callback, [...trail, index]));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => visitJson(child, callback, [...trail, key]));
}

function scanJsonConfig(file, findings) {
  let parsed;
  try { parsed = JSON.parse(file.content); }
  catch (error) {
    const position = /position\s+(\d+)/i.exec(error.message);
    const offset = position ? Number(position[1]) : 0;
    findings.push(finding("HL015", file.relative, file.content, offset, "Agent configuration is not valid JSON.", error.message, "Fix the JSON syntax before the configuration is loaded by an agent."));
    return;
  }
  visitJson(parsed, (value, trail) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    if (typeof value.command === "string") {
      const command = value.command.toLowerCase();
      const args = Array.isArray(value.args) ? value.args.map(String) : [];
      if (["bash", "sh", "cmd", "cmd.exe", "powershell", "pwsh"].includes(command) && args.some((argument) => /(?:-c|\/c|command)/i.test(argument))) {
        const evidence = `${value.command} ${args.join(" ")}`;
        const offset = file.content.indexOf(`"${value.command}"`);
        findings.push(finding("HL013", file.relative, file.content, Math.max(0, offset), "MCP or hook command is executed through a general-purpose shell.", evidence, "Invoke a fixed executable directly and pass validated arguments."));
      }
      if (["npx", "npx.cmd", "uvx"].includes(command)) {
        const packageName = args.find((argument) => !argument.startsWith("-"));
        const pinned = command === "uvx" ? packageName && /==\d/.test(packageName) : packageIsPinned(packageName);
        if (!pinned) {
          const offset = file.content.indexOf(packageName || value.command);
          findings.push(finding("HL007", file.relative, file.content, Math.max(0, offset), `Package execution is not pinned: ${packageName || "unknown package"}`, `${value.command} ${args.join(" ")}`, "Pin an exact package version and commit the lockfile where applicable."));
        }
      }
    }
    if (typeof value.url === "string" && /^http:\/\//i.test(value.url)) {
      const offset = file.content.indexOf(value.url);
      findings.push(finding("HL014", file.relative, file.content, Math.max(0, offset), "MCP endpoint uses unencrypted HTTP.", value.url, "Use HTTPS or a local transport."));
    }
  }, []);

  for (const match of file.content.matchAll(/"(?:allow|allowedTools)"\s*:\s*\[([^\]]*)\]/gi)) {
    if (/(?:"\*"|Bash\(\*\)|Shell\(\*\))/i.test(match[1])) findings.push(finding("HL008", file.relative, file.content, match.index, "Tool permission allows an unrestricted command surface.", match[0], "Replace wildcards with the narrowest commands and paths required."));
  }
}

function scanSkillFrontmatter(file, findings) {
  if (path.posix.basename(file.relative).toLowerCase() !== "skill.md") return;
  const match = /^---\s*\n([\s\S]*?)\n---/.exec(file.content);
  if (!match || !/^name\s*:/m.test(match[1]) || !/^description\s*:/m.test(match[1])) {
    findings.push(finding("HL011", file.relative, file.content, 0, "SKILL.md must start with frontmatter containing name and description.", file.content.slice(0, 120), "Add a YAML frontmatter block with non-empty name and description fields."));
  }
}

function scanDuplicates(files, findings) {
  const lines = new Map();
  for (const file of files) {
    file.content.split("\n").forEach((line, index) => {
      const normalized = line.trim().toLowerCase().replace(/\s+/g, " ");
      if (normalized.length < 50 || /^(?:```|#|<!--)/.test(normalized)) return;
      if (!lines.has(normalized)) lines.set(normalized, []);
      lines.get(normalized).push({ file, index, line: line.trim() });
    });
  }
  for (const occurrences of lines.values()) {
    occurrences.forEach((item, index) => {
      const directory = path.posix.dirname(item.file.relative);
      const overlaps = occurrences.slice(0, index).some((previous) => {
        if (previous.file.relative === item.file.relative) return false;
        const previousDirectory = path.posix.dirname(previous.file.relative);
        return directory === "." || previousDirectory === "." || directory === previousDirectory || directory.startsWith(`${previousDirectory}/`) || previousDirectory.startsWith(`${directory}/`);
      });
      if (overlaps) findings.push(finding("HL010", item.file.relative, item.file.content, item.file.content.split("\n").slice(0, item.index).join("\n").length + (item.index ? 1 : 0), "Instruction is duplicated in another active scope.", item.line, "Keep the rule in one authoritative file and link to it from inherited scopes."));
    });
  }
}

function scanConflicts(files, findings) {
  const positive = new Map();
  const negative = [];
  for (const file of files) {
    file.content.split("\n").forEach((line, lineIndex) => {
      const negativeMatch = /(?:never|do not|don't|must not)\s+(?:run|use|execute)\s+(.{3,100})/i.exec(line);
      const positiveMatch = /(?:always|must|required to)\s+(?:run|use|execute)\s+(.{3,100})/i.exec(line);
      const normalize = (value) => value.toLowerCase().replace(/[`*_.,;:]/g, "").split(/\s+/).slice(0, 5).join(" ");
      if (positiveMatch) positive.set(normalize(positiveMatch[1]), { file, line, lineIndex });
      if (negativeMatch) negative.push({ key: normalize(negativeMatch[1]), file, line, lineIndex });
    });
  }
  for (const item of negative) {
    if (!positive.has(item.key)) continue;
    const offset = item.file.content.split("\n").slice(0, item.lineIndex).join("\n").length + (item.lineIndex ? 1 : 0);
    findings.push(finding("HL009", item.file.relative, item.file.content, offset, `Instruction conflicts with ${positive.get(item.key).file.relative}.`, item.line.trim(), "Remove the contradiction or narrow each instruction to a distinct scope."));
  }
}

function scoreReport(findings) {
  const weights = { high: 12, medium: 5, low: 2, info: 0 };
  const score = Math.max(0, 100 - findings.reduce((total, item) => total + weights[item.severity], 0));
  const grade = score >= 95 ? "A" : score >= 85 ? "B" : score >= 70 ? "C" : score >= 55 ? "D" : "F";
  return { score, grade };
}

function scanRepository(root, config) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
  const allFiles = listRepositoryFiles(root, config || {});
  const files = readFiles(root, allFiles);
  const findings = [];

  if (!files.some((file) => ["agents.md", "claude.md", "gemini.md"].includes(path.posix.basename(file.relative).toLowerCase()) && !file.relative.includes("/"))) {
    const synthetic = "No root agent instruction file";
    findings.push({ rule: "HL100", severity: "low", category: RULES.HL100.category, file: ".", line: 1, column: 1, message: "Repository has no root AGENTS.md, CLAUDE.md, or GEMINI.md.", evidence: synthetic, suggestion: "Add a concise root instruction file with repository layout and validation commands.", fingerprint: fingerprint("HL100", ".", 1, synthetic) });
  }

  for (const file of files) {
    if (file.size > 32768) findings.push(finding("HL003", file.relative, file.content, 0, `Context file is ${(file.size / 1024).toFixed(1)} KB.`, `${file.size} bytes`, "Split scoped instructions into nested files and remove repeated prose."));
    if (file.skipped) continue;
    scanTextSecurity(file, findings);
    scanReferences(root, file, findings);
    scanSkillFrontmatter(file, findings);
    if (file.relative.toLowerCase().endsWith(".json")) scanJsonConfig(file, findings);
  }
  scanDuplicates(files, findings);
  scanConflicts(files, findings);

  const validationPattern = /(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|lint|check|build)|(?:pytest|cargo\s+test|go\s+test|dotnet\s+test)/i;
  if (files.length && !files.some((file) => validationPattern.test(file.content))) {
    const evidence = "No test, lint, check, or build command found";
    findings.push({ rule: "HL101", severity: "low", category: RULES.HL101.category, file: ".", line: 1, column: 1, message: "Harness files do not tell agents how to validate changes.", evidence, suggestion: "Document the narrowest reliable test, lint, or build commands.", fingerprint: fingerprint("HL101", ".", 1, evidence) });
  }

  findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
  const counts = { high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach((item) => { counts[item.severity] += 1; });
  const result = scoreReport(findings);
  return {
    tool: "harnesslint",
    version: require("../package.json").version,
    root,
    scannedAt: new Date().toISOString(),
    filesScanned: files.length,
    contextBytes: files.reduce((sum, file) => sum + file.size, 0),
    estimatedTokens: Math.ceil(files.reduce((sum, file) => sum + file.content.length, 0) / 4),
    counts,
    score: result.score,
    grade: result.grade,
    findings,
    rules: RULES
  };
}

module.exports = { RULES, fingerprint, globToRegExp, isHarnessFile, listRepositoryFiles, packageIsPinned, scanRepository, severityRank };
