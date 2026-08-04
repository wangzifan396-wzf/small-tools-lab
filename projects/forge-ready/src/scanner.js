"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const CATEGORY_MAX = { documentation: 25, community: 15, quality: 25, security: 20, release: 15 };
const RULES = {
  FR001: { title: "Missing README", category: "documentation", penalty: 15, effort: "small" },
  FR002: { title: "README lacks essential guidance", category: "documentation", penalty: 5, effort: "small" },
  FR003: { title: "Missing license file", category: "release", penalty: 12, effort: "small" },
  FR004: { title: "Missing contributing guide", category: "community", penalty: 5, effort: "small" },
  FR005: { title: "Missing security policy", category: "security", penalty: 6, effort: "small" },
  FR006: { title: "Missing code of conduct", category: "community", penalty: 2, effort: "small" },
  FR007: { title: "Missing issue templates", category: "community", penalty: 3, effort: "medium" },
  FR008: { title: "Missing pull request template", category: "community", penalty: 3, effort: "small" },
  FR009: { title: "Missing continuous integration", category: "quality", penalty: 10, effort: "medium" },
  FR010: { title: "Missing validation command", category: "quality", penalty: 8, effort: "medium" },
  FR011: { title: "Incomplete package metadata", category: "release", penalty: 4, effort: "small" },
  FR012: { title: "Package is marked private", category: "release", penalty: 8, effort: "small" },
  FR013: { title: "Missing dependency lockfile", category: "quality", penalty: 4, effort: "small" },
  FR014: { title: "Missing changelog", category: "documentation", penalty: 3, effort: "medium" },
  FR015: { title: "Broken README link", category: "documentation", penalty: 5, effort: "small" },
  FR016: { title: "Secret-like content", category: "security", penalty: 15, effort: "immediate" },
  FR017: { title: "Generated artifact in publish set", category: "quality", penalty: 3, effort: "small" },
  FR018: { title: "Large repository file", category: "quality", penalty: 7, effort: "medium" },
  FR019: { title: "Missing gitignore", category: "quality", penalty: 4, effort: "small" },
  FR020: { title: "Missing runtime declaration", category: "release", penalty: 3, effort: "small" },
  FR021: { title: "Missing package publish allowlist", category: "release", penalty: 4, effort: "small" },
  FR022: { title: "Missing repository metadata", category: "release", penalty: 4, effort: "small" },
  FR023: { title: "No test files detected", category: "quality", penalty: 6, effort: "medium" },
  FR024: { title: "Missing visual proof", category: "documentation", penalty: 2, effort: "small" },
  FR025: { title: "Mutable GitHub Action reference", category: "security", penalty: 7, effort: "small" },
  FR026: { title: "Broad workflow permissions", category: "security", penalty: 8, effort: "small" },
  FR027: { title: "Broken package executable", category: "release", penalty: 10, effort: "small" },
  FR028: { title: "Missing release automation", category: "release", penalty: 3, effort: "medium" },
  FR029: { title: "Invalid package manifest", category: "release", penalty: 12, effort: "immediate" }
};

const DEFAULT_IGNORES = new Set([".git", "node_modules", "vendor", "target", ".next"]);

function toPosix(value) { return value.split(path.sep).join("/"); }

function globToRegExp(pattern) {
  const escaped = toPosix(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "::DOUBLE::").replaceAll("*", "[^/]*").replaceAll("::DOUBLE::", ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function listFiles(root, config) {
  let files = [];
  try {
    const topLevel = path.resolve(execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
    if (topLevel !== path.resolve(root)) throw new Error("Scan root is a repository subdirectory");
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
  return files.map(toPosix).filter((file) => fs.existsSync(path.join(root, ...file.split("/"))) && !ignores.some((pattern) => pattern.test(file)));
}

function lineNumber(content, offset) { return content.slice(0, Math.max(0, offset)).split("\n").length; }

function finding(rule, file, message, evidence, suggestion, line) {
  const definition = RULES[rule];
  return {
    rule,
    title: definition.title,
    category: definition.category,
    penalty: definition.penalty,
    severity: definition.penalty >= 10 ? "high" : definition.penalty >= 5 ? "medium" : "low",
    effort: definition.effort,
    file: file || ".",
    line: line || 1,
    message,
    evidence: String(evidence || "").trim().slice(0, 240),
    suggestion
  };
}

function detectProfile(files, packageJson, requested) {
  if (requested && requested !== "auto") return requested;
  if (packageJson && packageJson.bin) return "cli";
  if (packageJson && (packageJson.main || packageJson.module || packageJson.exports)) return "library";
  if (files.some((file) => /(^|\/)index\.html$/i.test(file))) return "app";
  return "general";
}

function readText(root, relative, limit) {
  const absolute = path.join(root, ...relative.split("/"));
  const stat = fs.statSync(absolute);
  if (!stat.isFile() || stat.size > (limit || 1024 * 1024)) return null;
  const buffer = fs.readFileSync(absolute);
  if (buffer.subarray(0, 8192).includes(0)) return null;
  return buffer.toString("utf8");
}

function hasSection(readme, pattern) { return new RegExp(`^#{1,4}\\s+.*(?:${pattern})`, "im").test(readme); }

function scanReadme(root, readmeFile, profile, findings) {
  if (!readmeFile) {
    findings.push(finding("FR001", ".", "A public repository needs a root README.", "README.md not found", "Add a concise README with purpose, installation, usage, and license information."));
    return "";
  }
  const content = readText(root, readmeFile) || "";
  const missing = [];
  if (!/(?:install|quick start|getting started|setup)/i.test(content)) missing.push("installation or quick start");
  if (!/(?:usage|example|how to)/i.test(content)) missing.push("usage or examples");
  if (!/(?:license)/i.test(content)) missing.push("license");
  if (profile === "cli" && !/```(?:sh|bash|shell|powershell)?[\s\S]*?(?:npx|npm|node|forge-ready|forgeready)/i.test(content)) missing.push("a runnable CLI example");
  if (content.trim().length < 500) missing.push("enough project detail");
  if (missing.length) findings.push(finding("FR002", readmeFile, `README is missing ${missing.join(", ")}.`, `${content.trim().length} characters`, "Add only the missing sections with commands users can run."));

  const seen = new Set();
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, "").split("#")[0].split("?")[0];
    if (!target || /^(?:https?:|mailto:|#|data:)/i.test(target)) continue;
    const decoded = decodeURIComponent(target);
    const absolute = path.resolve(path.dirname(path.join(root, readmeFile)), decoded);
    if (!fs.existsSync(absolute) && !seen.has(target)) {
      seen.add(target);
      findings.push(finding("FR015", readmeFile, `README target does not exist: ${target}`, match[0], "Correct the link or add the referenced file.", lineNumber(content, match.index)));
    }
  }
  if (!/!\[[^\]]*\]\([^)]+\)|<img\s/i.test(content)) findings.push(finding("FR024", readmeFile, "README has no screenshot, diagram, or visual demo.", "No image markup found", "Add one representative screenshot or diagram that proves the project works."));
  return content;
}

function scanPackage(root, files, packageFile, profile, findings) {
  if (!packageFile) return null;
  let packageJson;
  const content = readText(root, packageFile) || "";
  try { packageJson = JSON.parse(content); }
  catch (error) {
    findings.push(finding("FR029", packageFile, "package.json is not valid JSON.", error.message, "Fix the manifest syntax before publishing."));
    return null;
  }
  const missing = ["name", "version", "description", "license"].filter((key) => !packageJson[key]);
  if (missing.length) findings.push(finding("FR011", packageFile, `Package metadata is missing: ${missing.join(", ")}.`, missing.join(", "), "Add accurate package identity and licensing fields."));
  if (!packageJson.repository) findings.push(finding("FR022", packageFile, "Package manifest has no repository URL.", "repository is absent", "Point repository to the canonical public source URL."));
  if (packageJson.private === true && ["cli", "library"].includes(profile)) findings.push(finding("FR012", packageFile, "A publishable package is marked private.", "private: true", "Remove private or set it to false after confirming the package should be public."));
  if (!packageJson.engines && !files.some((file) => [".nvmrc", ".node-version", ".tool-versions"].includes(file.toLowerCase()))) findings.push(finding("FR020", packageFile, "Supported runtime versions are not declared.", "engines is absent", "Add an engines field or a committed runtime version file."));
  if (packageJson.private !== true && ["cli", "library"].includes(profile) && !Array.isArray(packageJson.files) && !files.some((file) => file.toLowerCase() === ".npmignore")) findings.push(finding("FR021", packageFile, "npm publish contents are not constrained.", "files and .npmignore are absent", "Add a package files allowlist to prevent accidental publication."));
  const scripts = packageJson.scripts || {};
  if (!Object.keys(scripts).some((name) => /^(?:test|check|lint|build)(?::|$)/.test(name))) findings.push(finding("FR010", packageFile, "No test, lint, check, or build script is defined.", `scripts: ${Object.keys(scripts).join(", ") || "none"}`, "Add the narrowest reliable validation scripts."));
  if (Object.keys({ ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) }).length && !files.some((file) => /(^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i.test(file))) findings.push(finding("FR013", packageFile, "Dependencies exist but no Node lockfile was found.", "Dependency fields are non-empty", "Commit the lockfile used by the project."));
  if (packageJson.bin) {
    const entries = typeof packageJson.bin === "string" ? [packageJson.bin] : Object.values(packageJson.bin);
    entries.filter((target) => typeof target === "string" && !fs.existsSync(path.resolve(root, target))).forEach((target) => findings.push(finding("FR027", packageFile, `Package executable does not exist: ${target}`, target, "Add the executable or correct the bin path.")));
  }
  return packageJson;
}

function scanSecurity(root, files, findings) {
  const secretFiles = /(^|\/)(?:\.env|id_rsa|id_ed25519|credentials\.json)$|\.(?:pem|p12|pfx)$/i;
  const secretPattern = /(?:github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|(?:api[_-]?key|token|password)\s*[:=]\s*["'][^"'\s]{12,}["'])/gi;
  for (const file of files) {
    if (secretFiles.test(file) && !/\.example$|\.sample$/i.test(file)) findings.push(finding("FR016", file, "A credential-bearing filename is included in the publish set.", file, "Remove it from Git history, rotate any active value, and add an ignore rule."));
    const content = readText(root, file, 512 * 1024);
    if (!content) continue;
    const match = secretPattern.exec(content);
    secretPattern.lastIndex = 0;
    if (match) findings.push(finding("FR016", file, "Secret-like literal is included in the publish set.", match[0], "Replace it with a synthetic fixture or environment-variable reference and rotate active credentials.", lineNumber(content, match.index)));
  }
}

function scanWorkflows(root, files, findings) {
  const workflows = files.filter((file) => /^\.github\/workflows\/.*\.ya?ml$/i.test(file));
  if (!workflows.length) {
    findings.push(finding("FR009", ".", "No GitHub Actions workflow was found.", ".github/workflows is empty", "Add a minimal workflow that runs the documented validation commands."));
    return;
  }
  for (const file of workflows) {
    const content = readText(root, file) || "";
    for (const match of content.matchAll(/uses:\s*([^\s@]+)@([^\s#]+)/g)) {
      if (/^(?:main|master|develop|latest)$/i.test(match[2])) findings.push(finding("FR025", file, `Action uses a mutable ref: ${match[0]}`, match[0], "Pin a release tag or commit SHA and update it deliberately.", lineNumber(content, match.index)));
    }
    const broad = /permissions:\s*write-all|permissions:\s*\n(?:\s+\S+:\s*write\s*\n){3,}/i.exec(content);
    if (broad) findings.push(finding("FR026", file, "Workflow grants broad write permissions.", broad[0], "Set read-only defaults and grant write access only to the job that needs it.", lineNumber(content, broad.index)));
  }
}

function calculateScores(findings) {
  const categories = {};
  for (const [category, maximum] of Object.entries(CATEGORY_MAX)) {
    const deductions = findings.filter((item) => item.category === category).reduce((total, item) => total + item.penalty, 0);
    categories[category] = { score: Math.max(0, maximum - deductions), maximum, deductions: Math.min(maximum, deductions) };
  }
  const score = Object.values(categories).reduce((total, item) => total + item.score, 0);
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 55 ? "D" : "F";
  return { score, grade, categories };
}

function scanRepository(root, options, config) {
  const settings = options || {};
  const userConfig = config || {};
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
  if (userConfig.ignore !== undefined && (!Array.isArray(userConfig.ignore) || userConfig.ignore.some((item) => typeof item !== "string"))) throw new Error("config.ignore must be an array of glob strings.");
  if (userConfig.disableRules !== undefined && (!Array.isArray(userConfig.disableRules) || userConfig.disableRules.some((item) => !RULES[item]))) throw new Error("config.disableRules must contain known rule IDs.");
  const files = listFiles(root, userConfig);
  const lower = new Map(files.map((file) => [file.toLowerCase(), file]));
  const has = (name) => lower.has(name.toLowerCase());
  const find = (pattern) => files.find((file) => pattern.test(file));
  const packageFile = lower.get("package.json");
  let packagePreview = null;
  if (packageFile) try { packagePreview = JSON.parse(readText(root, packageFile) || "null"); } catch (_error) { packagePreview = null; }
  const profile = detectProfile(files, packagePreview, settings.profile || userConfig.profile || "auto");
  if (!["auto", "cli", "library", "app", "general"].includes(settings.profile || "auto")) throw new Error(`Unsupported profile: ${settings.profile}`);
  const findings = [];
  const readmeFile = files.find((file) => /^readme(?:\.[^.]+)?$/i.test(file));
  scanReadme(root, readmeFile, profile, findings);
  scanPackage(root, files, packageFile, profile, findings);

  if (!files.some((file) => /^(?:license|licence)(?:\.[^.]+)?$/i.test(file))) findings.push(finding("FR003", ".", "No root license file was found.", "LICENSE not found", "Choose an OSI-approved license and add its full text."));
  if (!files.some((file) => /^(?:\.github\/)?contributing(?:\.[^.]+)?$/i.test(file))) findings.push(finding("FR004", ".", "No contributing guide was found.", "CONTRIBUTING not found", "Document setup, validation, and pull request expectations."));
  if (!files.some((file) => /^(?:\.github\/)?security(?:\.[^.]+)?$/i.test(file))) findings.push(finding("FR005", ".", "No security policy was found.", "SECURITY not found", "Add private reporting instructions and supported-version guidance."));
  if (!files.some((file) => /^(?:\.github\/)?(?:code_of_conduct|code-of-conduct)(?:\.[^.]+)?$/i.test(file))) findings.push(finding("FR006", ".", "No code of conduct was found.", "CODE_OF_CONDUCT not found", "Add a standard community code of conduct when accepting contributions."));
  if (!files.some((file) => /^\.github\/ISSUE_TEMPLATE\//i.test(file))) findings.push(finding("FR007", ".", "No structured issue templates were found.", ".github/ISSUE_TEMPLATE is empty", "Add focused bug and feature request forms."));
  if (!files.some((file) => /(^|\/)PULL_REQUEST_TEMPLATE(?:\/|\.)/i.test(file))) findings.push(finding("FR008", ".", "No pull request template was found.", "PULL_REQUEST_TEMPLATE not found", "Add a short validation and change-summary checklist."));
  if (!files.some((file) => /^changelog(?:\.[^.]+)?$/i.test(file)) && !files.some((file) => /^\.changeset\//i.test(file))) findings.push(finding("FR014", ".", "No changelog or changeset configuration was found.", "CHANGELOG and .changeset are absent", "Document notable user-facing changes from the first release onward."));
  if (!has(".gitignore")) findings.push(finding("FR019", ".", "No .gitignore file was found.", ".gitignore not found", "Ignore dependencies, generated reports, credentials, and platform artifacts."));
  scanWorkflows(root, files, findings);
  scanSecurity(root, files, findings);

  const generated = files.filter((file) => /(^|\/)(?:dist|build|coverage)(\/|$)|(?:\.log|\.tmp|\.DS_Store)$/i.test(file));
  generated.slice(0, 5).forEach((file) => findings.push(finding("FR017", file, "Generated output is present in the publish set.", file, "Ignore or exclude the artifact unless consumers require it.")));
  for (const file of files) {
    const absolute = path.join(root, ...file.split("/"));
    if (fs.statSync(absolute).isFile() && fs.statSync(absolute).size > 5 * 1024 * 1024) findings.push(finding("FR018", file, "File is larger than 5 MB.", `${fs.statSync(absolute).size} bytes`, "Move large assets to release storage or document why source control is appropriate."));
  }
  const sourceFiles = files.filter((file) => /\.(?:c|cc|cpp|cs|go|java|js|jsx|php|py|rb|rs|swift|ts|tsx|vue)$/i.test(file) && !/(^|\/)(?:tests?|specs?|fixtures)(\/|$)|\.(?:test|spec)\./i.test(file));
  const testFiles = files.filter((file) => /(^|\/)(?:tests?|specs?)(\/|$)|\.(?:test|spec)\.[^.]+$/i.test(file));
  if (sourceFiles.length && !testFiles.length) findings.push(finding("FR023", ".", "Source files exist but no test files were detected.", `${sourceFiles.length} source files`, "Add focused tests for the highest-risk public behavior."));
  const releaseWorkflow = profile === "app" ? /(?:release|publish|deploy|pages)/ : /(?:release|publish)/;
  if (!files.some((file) => /^\.github\/workflows\/[^/]*\.ya?ml$/i.test(file) && releaseWorkflow.test(path.posix.basename(file))) && !files.some((file) => /^\.changeset\//i.test(file))) findings.push(finding("FR028", ".", "No release or publish automation was found.", "No release workflow or changesets", "Add a reviewed, least-privilege release workflow when manual releases become error-prone."));

  const disabled = new Set(userConfig.disableRules || []);
  const active = findings.filter((item) => !disabled.has(item.rule)).sort((a, b) => b.penalty - a.penalty || a.category.localeCompare(b.category) || a.file.localeCompare(b.file) || a.line - b.line);
  const result = calculateScores(active);
  return {
    tool: "forge-ready",
    version: require("../package.json").version,
    root: path.resolve(root),
    repository: path.basename(path.resolve(root)),
    generatedAt: new Date().toISOString(),
    profile,
    filesScanned: files.length,
    score: result.score,
    grade: result.grade,
    categories: result.categories,
    findings: active,
    counts: { high: active.filter((item) => item.severity === "high").length, medium: active.filter((item) => item.severity === "medium").length, low: active.filter((item) => item.severity === "low").length },
    nextActions: active.slice(0, 5).map((item) => ({ rule: item.rule, title: item.title, suggestion: item.suggestion, effort: item.effort })),
    rules: RULES
  };
}

module.exports = { CATEGORY_MAX, RULES, calculateScores, detectProfile, globToRegExp, listFiles, scanRepository };
