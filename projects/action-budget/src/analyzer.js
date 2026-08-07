"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseDocument } = require("./yaml-lite.js");

const RULES = {
  AB001: { title: "Matrix exceeds GitHub's job limit", severity: "high", category: "fanout" },
  AB002: { title: "Large matrix fanout", severity: "medium", category: "fanout" },
  AB003: { title: "Workflow exceeds the job budget", severity: "high", category: "budget" },
  AB004: { title: "Workflow exceeds the timeout budget", severity: "high", category: "budget" },
  AB005: { title: "Job relies on the default timeout", severity: "low", category: "timeout" },
  AB006: { title: "Dynamic matrix has unknown fanout", severity: "medium", category: "uncertainty" },
  AB007: { title: "Reusable workflow has hidden downstream cost", severity: "medium", category: "uncertainty" },
  AB008: { title: "Large matrix has no max-parallel limit", severity: "low", category: "concurrency" },
  AB009: { title: "Push and pull request triggers can duplicate work", severity: "medium", category: "trigger" },
  AB010: { title: "Frequent scheduled workflow", severity: "medium", category: "trigger" },
  AB011: { title: "Invalid timeout or parallel limit", severity: "medium", category: "integrity" },
  AB012: { title: "Workflow cannot be parsed", severity: "high", category: "integrity" }
};

const DEFAULTS = {
  ignore: [],
  defaultTimeoutMinutes: 360,
  maxMatrixVariants: 20,
  maxJobsPerRun: 64,
  maxTimeoutMinutesPerRun: 1440,
  maxScheduledRunsPerDay: 24,
  concurrencyWarning: 8
};
const SEVERITY_RANK = { low: 1, medium: 2, high: 3 };

function toPosix(value) { return value.split(path.sep).join("/"); }
function globToRegExp(pattern) {
  const escaped = toPosix(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "::DOUBLE::").replaceAll("*", "[^/]*").replaceAll("::DOUBLE::", ".*");
  return new RegExp(`^${escaped}$`, "i");
}
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function expression(value) { return typeof value === "string" && value.includes("${{"); }

function expandMatrix(matrix) {
  if (!matrix || typeof matrix !== "object" || Array.isArray(matrix)) return { known: false, variants: 1, combinations: [], reason: "Matrix is not a static mapping" };
  const axes = Object.entries(matrix).filter(([key]) => !["include", "exclude"].includes(key));
  if (!axes.length) return { known: true, variants: 1, combinations: [{}], axes: [] };
  if (axes.some(([, values]) => !Array.isArray(values) || values.some(expression))) return { known: false, variants: 1, combinations: [], axes: axes.map(([key]) => key), reason: "An axis is expression-driven or not an array" };

  let combinations = [{}];
  for (const [key, values] of axes) combinations = combinations.flatMap((combination) => values.map((value) => ({ ...combination, [key]: value })));
  const excluded = Array.isArray(matrix.exclude) ? matrix.exclude : [];
  combinations = combinations.filter((combination) => !excluded.some((candidate) => candidate && typeof candidate === "object" && Object.entries(candidate).every(([key, value]) => same(combination[key], value))));

  const axisNames = new Set(axes.map(([key]) => key));
  for (const addition of Array.isArray(matrix.include) ? matrix.include : []) {
    if (!addition || typeof addition !== "object" || Array.isArray(addition) || Object.values(addition).some(expression)) return { known: false, variants: Math.max(1, combinations.length), combinations, axes: [...axisNames], reason: "An include entry is dynamic" };
    let applied = false;
    combinations = combinations.map((combination) => {
      const compatible = [...axisNames].every((key) => !(key in addition) || same(combination[key], addition[key]));
      if (!compatible) return combination;
      applied = true;
      return { ...combination, ...addition };
    });
    if (!applied) combinations.push({ ...addition });
  }
  return { known: true, variants: combinations.length, combinations, axes: [...axisNames] };
}

function resolveRunner(runsOn, combination) {
  const labels = Array.isArray(runsOn) ? runsOn : [runsOn];
  const resolved = labels.filter((item) => item !== undefined).map((item) => {
    if (typeof item !== "string") return "dynamic";
    return item.replace(/\$\{\{\s*matrix\.([A-Za-z_][A-Za-z0-9_-]*)\s*\}\}/g, (_match, key) => combination && combination[key] !== undefined ? String(combination[key]) : "dynamic");
  });
  if (!resolved.length || resolved.some(expression) || resolved.includes("dynamic")) return "dynamic";
  if (resolved.some((label) => label.toLowerCase() === "self-hosted")) return "self-hosted";
  const joined = resolved.join(" + ").toLowerCase();
  if (joined.includes("macos")) return "macos";
  if (joined.includes("windows")) return "windows";
  if (joined.includes("ubuntu")) return "linux";
  return resolved.join(" + ");
}

function normalizeTriggers(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function pushCanOverlapPullRequest(on) {
  if (!on || typeof on !== "object" || Array.isArray(on)) return true;
  const push = on.push;
  if (!push || typeof push !== "object" || Array.isArray(push)) return true;
  return !Array.isArray(push.branches) || push.branches.length === 0;
}

function cronFieldCount(field, maximum) {
  if (field === "*") return maximum + 1;
  const step = /^\*\/(\d+)$/.exec(field);
  if (step && Number(step[1]) > 0) return Math.ceil((maximum + 1) / Number(step[1]));
  if (/^\d+(?:,\d+)*$/.test(field)) {
    const values = new Set(field.split(",").map(Number));
    return [...values].every((value) => value >= 0 && value <= maximum) ? values.size : null;
  }
  return null;
}

function scheduledRunsPerDay(cron) {
  if (typeof cron !== "string") return null;
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5 || fields.slice(1).some(expression)) return null;
  const minutes = cronFieldCount(fields[0], 59);
  const hours = cronFieldCount(fields[1], 23);
  return minutes === null || hours === null ? null : minutes * hours;
}

function finding(rule, file, job, message, evidence, suggestion) {
  const definition = RULES[rule];
  return { rule, title: definition.title, severity: definition.severity, category: definition.category, file, job: job || null, message, evidence, suggestion };
}

function validateConfig(input) {
  const config = { ...DEFAULTS, ...(input || {}) };
  if (!Array.isArray(config.ignore) || config.ignore.some((item) => typeof item !== "string")) throw new Error("config.ignore must be an array of strings.");
  for (const key of ["defaultTimeoutMinutes", "maxMatrixVariants", "maxJobsPerRun", "maxTimeoutMinutesPerRun", "maxScheduledRunsPerDay", "concurrencyWarning"]) {
    if (!Number.isFinite(config[key]) || config[key] <= 0) throw new Error(`config.${key} must be a positive number.`);
  }
  return config;
}

function workflowFiles(root, config) {
  const directory = path.join(root, ".github", "workflows");
  if (!fs.existsSync(directory)) return [];
  const ignores = config.ignore.map(globToRegExp);
  return fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name)).map((entry) => `.github/workflows/${entry.name}`).filter((file) => !ignores.some((pattern) => pattern.test(file))).sort();
}

function analyzeJob(file, id, source, config, findings) {
  const reusable = typeof source.uses === "string";
  const strategy = source.strategy && typeof source.strategy === "object" ? source.strategy : {};
  const matrix = strategy.matrix === undefined ? { known: true, variants: 1, combinations: [{}], axes: [] } : expandMatrix(strategy.matrix);
  const rawTimeout = source["timeout-minutes"];
  const explicitTimeout = Number.isFinite(rawTimeout) && rawTimeout > 0;
  const timeoutMinutes = explicitTimeout ? Number(rawTimeout) : config.defaultTimeoutMinutes;
  const rawParallel = strategy["max-parallel"];
  const validParallel = rawParallel === undefined || (Number.isInteger(rawParallel) && rawParallel > 0);
  const maxParallel = validParallel && rawParallel !== undefined ? rawParallel : null;
  const variants = reusable ? 1 : matrix.variants;
  const concurrency = Math.min(variants, maxParallel || variants);
  const runnerBreakdown = {};
  const combinations = matrix.known && matrix.combinations.length ? matrix.combinations : [{}];
  combinations.forEach((combination) => { const runner = reusable ? "reusable" : resolveRunner(source["runs-on"], combination); runnerBreakdown[runner] = (runnerBreakdown[runner] || 0) + 1; });

  if (!matrix.known) findings.push(finding("AB006", file, id, `${id} has expression-driven matrix fanout.`, matrix.reason, "Set an explicit upstream cap and document the expected maximum matrix size."));
  if (matrix.known && variants > 256) findings.push(finding("AB001", file, id, `${id} expands to ${variants} jobs.`, `${variants} static variants`, "Split the matrix or reduce axes to stay within the 256-job matrix limit."));
  else if (matrix.known && variants > config.maxMatrixVariants) findings.push(finding("AB002", file, id, `${id} expands beyond the configured matrix budget.`, `${variants} variants > ${config.maxMatrixVariants}`, "Reduce axes, move rare combinations to a separate workflow, or raise the documented budget."));
  if (!explicitTimeout && !reusable) findings.push(finding("AB005", file, id, `${id} has no explicit timeout-minutes.`, `Assuming ${config.defaultTimeoutMinutes} minutes per variant`, "Set timeout-minutes near the job's realistic upper bound."));
  if (reusable) findings.push(finding("AB007", file, id, `${id} delegates to a reusable workflow.`, source.uses, "Audit the called workflow separately and include its maximum cost in the repository budget."));
  if (matrix.known && variants >= config.concurrencyWarning && !maxParallel) findings.push(finding("AB008", file, id, `${id} can start ${variants} matrix jobs concurrently.`, "No strategy.max-parallel", "Set max-parallel to cap burst concurrency when turnaround permits."));
  if (!validParallel || (rawTimeout !== undefined && !explicitTimeout)) findings.push(finding("AB011", file, id, `${id} has a non-static or invalid execution limit.`, !validParallel ? `max-parallel: ${String(rawParallel)}` : `timeout-minutes: ${String(rawTimeout)}`, "Use a positive numeric timeout-minutes and max-parallel value."));

  return { id, name: source.name || id, reusable, needs: source.needs || [], matrix: { known: matrix.known, axes: matrix.axes || [], variants, reason: matrix.reason || null }, timeoutMinutes, explicitTimeout, maxParallel, concurrency, timeoutExposure: variants * timeoutMinutes, runnerBreakdown };
}

function analyzeWorkflow(root, file, config, findings) {
  const content = fs.readFileSync(path.join(root, ...file.split("/")), "utf8");
  const document = parseDocument(content, { prettyErrors: true, uniqueKeys: true });
  if (document.errors.length) {
    const message = document.errors[0].message.split("\n")[0];
    findings.push(finding("AB012", file, null, "Workflow YAML cannot be parsed.", message, "Fix the YAML syntax or duplicate key before estimating its budget."));
    return { file, name: path.basename(file), triggers: [], jobs: [], parseError: message, summary: { jobDefinitions: 0, jobVariants: 0, concurrency: 0, timeoutExposure: 0, unknownJobs: 0, scheduledRunsPerDay: 0 } };
  }
  const workflow = document.toJS() || {};
  const triggers = normalizeTriggers(workflow.on);
  const jobs = Object.entries(workflow.jobs && typeof workflow.jobs === "object" ? workflow.jobs : {}).map(([id, source]) => analyzeJob(file, id, source && typeof source === "object" ? source : {}, config, findings));
  const scheduled = Array.isArray(workflow.on?.schedule) ? workflow.on.schedule.map((item) => scheduledRunsPerDay(item?.cron)).filter(Number.isFinite).reduce((total, value) => total + value, 0) : 0;
  const summary = {
    jobDefinitions: jobs.length,
    jobVariants: jobs.reduce((total, job) => total + job.matrix.variants, 0),
    concurrency: jobs.reduce((total, job) => total + job.concurrency, 0),
    timeoutExposure: jobs.reduce((total, job) => total + job.timeoutExposure, 0),
    unknownJobs: jobs.filter((job) => !job.matrix.known || job.reusable).length,
    scheduledRunsPerDay: scheduled
  };
  if (summary.jobVariants > config.maxJobsPerRun) findings.push(finding("AB003", file, null, `${workflow.name || path.basename(file)} exceeds the per-run job budget.`, `${summary.jobVariants} variants > ${config.maxJobsPerRun}`, "Split optional jobs or reduce matrix axes."));
  if (summary.timeoutExposure > config.maxTimeoutMinutesPerRun) findings.push(finding("AB004", file, null, `${workflow.name || path.basename(file)} exceeds the timeout exposure budget.`, `${summary.timeoutExposure} minutes > ${config.maxTimeoutMinutesPerRun}`, "Set realistic job timeouts and reduce high-timeout matrix variants."));
  if (triggers.includes("push") && triggers.includes("pull_request") && pushCanOverlapPullRequest(workflow.on)) findings.push(finding("AB009", file, null, `${workflow.name || path.basename(file)} runs on both push and pull_request without a push branch filter.`, "Feature branch updates may start both events", "Restrict push to protected branches or use a shared concurrency group to avoid duplicate work."));
  if (scheduled > config.maxScheduledRunsPerDay) findings.push(finding("AB010", file, null, `${workflow.name || path.basename(file)} has a high schedule frequency.`, `${scheduled} estimated runs/day > ${config.maxScheduledRunsPerDay}`, "Reduce schedule frequency or isolate the inexpensive health check."));
  return { file, name: workflow.name || path.basename(file), triggers, jobs, parseError: null, summary };
}

function analyzeRepository(root, inputConfig) {
  const config = validateConfig(inputConfig);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
  const files = workflowFiles(root, config);
  const findings = [];
  const workflows = files.map((file) => analyzeWorkflow(root, file, config, findings));
  findings.sort((left, right) => SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] || left.file.localeCompare(right.file) || (left.job || "").localeCompare(right.job || "") || left.rule.localeCompare(right.rule));
  const runnerBreakdown = {};
  workflows.flatMap((workflow) => workflow.jobs).forEach((job) => Object.entries(job.runnerBreakdown).forEach(([runner, count]) => { runnerBreakdown[runner] = (runnerBreakdown[runner] || 0) + count; }));
  const summary = {
    workflows: workflows.length,
    jobDefinitions: workflows.reduce((total, workflow) => total + workflow.summary.jobDefinitions, 0),
    jobVariants: workflows.reduce((total, workflow) => total + workflow.summary.jobVariants, 0),
    maxConcurrentJobs: Math.max(0, ...workflows.map((workflow) => workflow.summary.concurrency)),
    timeoutExposure: workflows.reduce((total, workflow) => total + workflow.summary.timeoutExposure, 0),
    unknownJobs: workflows.reduce((total, workflow) => total + workflow.summary.unknownJobs, 0),
    scheduledRunsPerDay: workflows.reduce((total, workflow) => total + workflow.summary.scheduledRunsPerDay, 0)
  };
  const weights = { high: 15, medium: 6, low: 2 };
  const score = Math.max(0, 100 - findings.reduce((total, item) => total + weights[item.severity], 0));
  return { tool: "action-budget", version: require("../package.json").version, root: path.resolve(root), repository: path.basename(path.resolve(root)), generatedAt: new Date().toISOString(), config, summary: { ...summary, score, grade: score >= 95 ? "A" : score >= 85 ? "B" : score >= 70 ? "C" : score >= 55 ? "D" : "F" }, counts: { high: findings.filter((item) => item.severity === "high").length, medium: findings.filter((item) => item.severity === "medium").length, low: findings.filter((item) => item.severity === "low").length }, runnerBreakdown, workflows, findings, rules: RULES };
}

module.exports = { DEFAULTS, RULES, analyzeRepository, cronFieldCount, expandMatrix, globToRegExp, normalizeTriggers, pushCanOverlapPullRequest, resolveRunner, scheduledRunsPerDay, validateConfig };
