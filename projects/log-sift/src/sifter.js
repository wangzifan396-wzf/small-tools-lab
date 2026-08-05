"use strict";

const DEFAULTS = {
  budget: 2000,
  context: 2,
  head: 8,
  tail: 8,
  maxLineChars: 500,
  stripTimestamps: false
};

function estimateTokens(value) { return Math.ceil(String(value || "").length / 4); }
function stripAnsi(value) { return String(value).replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, ""); }

function stripTimestamp(value) {
  return value
    .replace(/^\s*\[?\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+Z?\]?\s*/i, "")
    .replace(/^\s*\[?\d{2}:\d{2}:\d{2}(?:\.\d+)?\]?\s*/, "");
}

function redactSecrets(value) {
  let text = String(value);
  const types = [];
  const patterns = [
    ["provider-token", /\b(?:github_pat_[A-Za-z0-9_]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|sk-[A-Za-z0-9_-]{12,})\b/g],
    ["bearer-token", /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}=*/gi],
    ["credential", /\b(api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|secret)\b(\s*[:=]\s*)(["']?)[^\s,"']{8,}\3/gi],
    ["url-credential", /(https?:\/\/)[^\s\/@:]+:[^\s\/@]+@/gi]
  ];
  for (const [type, pattern] of patterns) {
    text = text.replace(pattern, (match, ...groups) => {
      types.push(type);
      if (type === "credential") return `${groups[0]}${groups[1]}[REDACTED]`;
      if (type === "url-credential") return `${groups[0]}[REDACTED]@`;
      if (type === "bearer-token") return "Bearer [REDACTED]";
      return "[REDACTED]";
    });
  }
  return { text, count: types.length, types };
}

function classify(value) {
  const text = value.toLowerCase();
  if (/\b0\s+(?:errors?|fail(?:ed|ures?)?)\b/.test(text)) return "summary";
  if (/\b(?:error|fatal|failed|failure|exception|panic|traceback|assertionerror|segmentation fault)\b|^[x✖]\s/i.test(value)) return "error";
  if (/\b(?:warn(?:ing)?|deprecated|retrying)\b/i.test(value)) return "warning";
  if (/\b(?:tests?|suites?|passed|skipped|duration|completed|finished|summary|build)\b/i.test(value)) return "summary";
  return "normal";
}

function signature(value) {
  return stripTimestamp(value).replace(/\b[0-9a-f]{12,}\b/gi, "<id>").replace(/\s+/g, " ").trim().toLowerCase();
}

function validateConfig(input) {
  const config = { ...DEFAULTS, ...(input || {}) };
  for (const key of ["budget", "context", "head", "tail", "maxLineChars"]) {
    if (!Number.isInteger(config[key]) || config[key] < (key === "budget" ? 32 : 0)) throw new Error(`config.${key} must be ${key === "budget" ? "an integer of at least 32" : "a non-negative integer"}.`);
  }
  if (typeof config.stripTimestamps !== "boolean") throw new Error("config.stripTimestamps must be a boolean.");
  return config;
}

function prepareLines(input, config) {
  const rawLines = String(input || "").replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  if (rawLines.at(-1) === "") rawLines.pop();
  const redactionTypes = [];
  let redactionCount = 0;
  const lines = rawLines.map((raw, index) => {
    const clean = stripAnsi(raw);
    const redacted = redactSecrets(clean);
    redactionCount += redacted.count;
    redactionTypes.push(...redacted.types);
    let text = config.stripTimestamps ? stripTimestamp(redacted.text) : redacted.text;
    if (text.length > config.maxLineChars) text = `${text.slice(0, Math.max(1, config.maxLineChars - 18))} ... [line clipped]`;
    return { index, text, signature: signature(redacted.text), kind: classify(redacted.text) };
  });
  return { lines, redaction: { count: redactionCount, types: [...new Set(redactionTypes)].sort() } };
}

function groupLines(lines) {
  const groups = [];
  for (const line of lines) {
    const previous = groups.at(-1);
    if (previous && line.signature && previous.signature === line.signature) {
      previous.end = line.index;
      previous.count += 1;
      if (line.kind === "error" || (line.kind === "warning" && previous.kind === "normal")) previous.kind = line.kind;
    } else groups.push({ start: line.index, end: line.index, count: 1, text: line.text, signature: line.signature, kind: line.kind });
  }
  groups.forEach((group) => { group.output = group.count > 1 ? `${group.text}  [repeated ${group.count}x]` : group.text; });
  return groups;
}

function priorityFor(group) {
  return { error: 100, warning: 80, summary: 60, normal: 10 }[group.kind];
}

function renderSelection(groups, selected) {
  const ordered = [...selected].sort((a, b) => a - b);
  const lines = [];
  let previousEnd = -1;
  for (const groupIndex of ordered) {
    const group = groups[groupIndex];
    const omitted = group.start - previousEnd - 1;
    if (omitted > 0) lines.push(`... omitted ${omitted} log line${omitted === 1 ? "" : "s"} ...`);
    lines.push(group.output);
    previousEnd = group.end;
  }
  const tailOmitted = groups.length ? groups.at(-1).end - previousEnd : 0;
  if (tailOmitted > 0) lines.push(`... omitted ${tailOmitted} log line${tailOmitted === 1 ? "" : "s"} ...`);
  return lines.join("\n");
}

function selectGroups(groups, config) {
  groups.forEach((group, index) => {
    group.priority = priorityFor(group);
    if (index < config.head || index >= groups.length - config.tail) group.priority = Math.max(group.priority, 40);
  });
  for (let index = 0; index < groups.length; index += 1) {
    if (!["error", "warning"].includes(groups[index].kind)) continue;
    for (let offset = -config.context; offset <= config.context; offset += 1) {
      if (groups[index + offset]) groups[index + offset].priority = Math.max(groups[index + offset].priority, offset === 0 ? groups[index].priority : 70);
    }
  }

  const ranked = groups.map((group, index) => ({ index, priority: group.priority, tokens: estimateTokens(group.output) + 1 })).sort((a, b) => b.priority - a.priority || a.index - b.index);
  const selected = new Set();
  let used = 0;
  const contentBudget = Math.max(16, Math.floor(config.budget * 0.86));
  for (const item of ranked) {
    if (used + item.tokens > contentBudget && selected.size) continue;
    selected.add(item.index);
    used += item.tokens;
  }
  if (!selected.size && groups.length) selected.add(ranked[0].index);

  let output = renderSelection(groups, selected);
  while (estimateTokens(output) > config.budget && selected.size > 1) {
    const removable = [...selected].sort((left, right) => groups[left].priority - groups[right].priority || Math.abs(left - groups.length / 2) - Math.abs(right - groups.length / 2))[0];
    selected.delete(removable);
    output = renderSelection(groups, selected);
  }
  if (estimateTokens(output) > config.budget) output = `${output.slice(0, Math.max(1, config.budget * 4 - 26))}\n... output clipped ...`;
  return { output, selected };
}

function siftLog(input, inputConfig) {
  const config = validateConfig(inputConfig);
  const original = String(input || "");
  const prepared = prepareLines(original, config);
  const groups = groupLines(prepared.lines);
  const selection = selectGroups(groups, config);
  const selectedGroups = [...selection.selected].sort((a, b) => a - b).map((index) => groups[index]);
  const includedLines = selectedGroups.reduce((sum, group) => sum + group.count, 0);
  const repeatedLines = groups.reduce((sum, group) => sum + Math.max(0, group.count - 1), 0);
  const inputTokens = estimateTokens(original);
  const outputTokens = estimateTokens(selection.output);
  return {
    tool: "log-sift",
    version: require("../package.json").version,
    generatedAt: new Date().toISOString(),
    config,
    summary: {
      inputLines: prepared.lines.length,
      includedLines,
      omittedLines: Math.max(0, prepared.lines.length - includedLines),
      repeatedLines,
      errors: prepared.lines.filter((line) => line.kind === "error").length,
      warnings: prepared.lines.filter((line) => line.kind === "warning").length,
      inputTokens,
      outputTokens,
      compressionPercent: inputTokens ? Math.max(0, Math.round((1 - outputTokens / inputTokens) * 100)) : 0
    },
    redaction: prepared.redaction,
    output: selection.output,
    entries: selectedGroups.map((group) => ({ startLine: group.start + 1, endLine: group.end + 1, count: group.count, kind: group.kind, text: group.output }))
  };
}

module.exports = { DEFAULTS, classify, estimateTokens, redactSecrets, signature, siftLog, stripAnsi, stripTimestamp, validateConfig };
