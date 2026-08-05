/**
 * The lint engine.
 *
 * Rules are plain objects; the engine resolves severities from a preset plus
 * user overrides, runs every enabled rule, and normalises whatever they
 * return into `Diagnostic`s.
 *
 * @module core/lint
 */

import { cloneCues } from './cue.js';
import { allRules, ruleMap, presets, fixOrder, defaultPreset } from '../rules/index.js';

/** @typedef {'off'|'info'|'warn'|'error'} Severity */

/**
 * @typedef {Object} RuleReport
 * @property {import('./cue.js').Cue} cue
 * @property {string} message
 * @property {number} [line]
 * @property {Record<string, any>} [data]
 */

/**
 * @typedef {Object} Rule
 * @property {string} id
 * @property {string} description
 * @property {Severity} severity
 * @property {Record<string, any>} [options]
 * @property {(cues: import('./cue.js').Cue[], options: Record<string, any>) => RuleReport[]} check
 * @property {(cues: import('./cue.js').Cue[], options: Record<string, any>) => { cues: import('./cue.js').Cue[], changed: number }} [fix]
 */

/**
 * @typedef {Object} Diagnostic
 * @property {string} ruleId
 * @property {Severity} severity
 * @property {number} cueIndex   1-based position within the track
 * @property {number} [line]     1-based line inside the cue
 * @property {number} start      cue start in ms
 * @property {number} end        cue end in ms
 * @property {string} message
 * @property {boolean} fixable
 * @property {Record<string, any>} [data]
 */

/**
 * @typedef {Object} LintResult
 * @property {Diagnostic[]} diagnostics
 * @property {number} errorCount
 * @property {number} warningCount
 * @property {number} infoCount
 * @property {number} fixableCount
 * @property {Record<string, number>} ruleCounts
 * @property {number} cueCount
 */

/**
 * @typedef {Object} Config
 * @property {string} [preset]
 * @property {Record<string, Severity | [Severity, Record<string, any>] | { severity?: Severity, options?: Record<string, any> }>} [rules]
 */

const SEVERITY_RANK = { off: 0, info: 1, warn: 2, error: 3 };

/**
 * Merge preset defaults with user overrides into a flat, resolved config.
 *
 * @param {Config} [config]
 * @returns {{ preset: string, entries: { rule: Rule, severity: Severity, options: Record<string, any> }[] }}
 */
export function resolveConfig(config = {}) {
  const presetName = config.preset ?? defaultPreset;
  const preset = presets[presetName];
  if (!preset) {
    throw new Error(
      `Unknown preset "${presetName}". Available: ${Object.keys(presets).join(', ')}`,
    );
  }

  /** @type {{ rule: Rule, severity: Severity, options: Record<string, any> }[]} */
  const entries = [];

  for (const rule of allRules) {
    let severity = rule.severity;
    let options = { ...(rule.options ?? {}) };

    const layers = [preset.rules?.[rule.id], config.rules?.[rule.id]];
    for (const layer of layers) {
      if (layer === undefined) continue;
      if (typeof layer === 'string') {
        severity = layer;
      } else if (Array.isArray(layer)) {
        severity = layer[0];
        options = { ...options, ...(layer[1] ?? {}) };
      } else if (typeof layer === 'object') {
        if (layer.severity) severity = layer.severity;
        if (layer.options) options = { ...options, ...layer.options };
      }
    }

    if (!(severity in SEVERITY_RANK)) {
      throw new Error(`Rule "${rule.id}" has an invalid severity: ${String(severity)}`);
    }

    entries.push({ rule, severity, options });
  }

  return { preset: presetName, entries };
}

/**
 * Run every enabled rule against a track.
 *
 * @param {import('./cue.js').Cue[]} cues
 * @param {Config} [config]
 * @returns {LintResult}
 */
export function lint(cues, config = {}) {
  const { entries } = resolveConfig(config);

  /** @type {Diagnostic[]} */
  const diagnostics = [];
  /** @type {Map<import('./cue.js').Cue, number>} */
  const positions = new Map();
  cues.forEach((cue, i) => positions.set(cue, i + 1));

  for (const { rule, severity, options } of entries) {
    if (severity === 'off') continue;

    let reports;
    try {
      reports = rule.check(cues, options) ?? [];
    } catch (error) {
      diagnostics.push({
        ruleId: rule.id,
        severity: 'error',
        cueIndex: 0,
        start: 0,
        end: 0,
        message: `rule crashed: ${/** @type {Error} */ (error).message}`,
        fixable: false,
      });
      continue;
    }

    for (const report of reports) {
      diagnostics.push({
        ruleId: rule.id,
        severity,
        cueIndex: positions.get(report.cue) ?? report.cue.index ?? 0,
        ...(report.line ? { line: report.line } : {}),
        start: report.cue.start,
        end: report.cue.end,
        message: report.message,
        fixable: typeof rule.fix === 'function',
        ...(report.data ? { data: report.data } : {}),
      });
    }
  }

  diagnostics.sort(
    (a, b) =>
      a.cueIndex - b.cueIndex ||
      (a.line ?? 0) - (b.line ?? 0) ||
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      a.ruleId.localeCompare(b.ruleId),
  );

  /** @type {Record<string, number>} */
  const ruleCounts = {};
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let fixableCount = 0;

  for (const d of diagnostics) {
    ruleCounts[d.ruleId] = (ruleCounts[d.ruleId] ?? 0) + 1;
    if (d.severity === 'error') errorCount += 1;
    else if (d.severity === 'warn') warningCount += 1;
    else if (d.severity === 'info') infoCount += 1;
    if (d.fixable) fixableCount += 1;
  }

  return {
    diagnostics,
    errorCount,
    warningCount,
    infoCount,
    fixableCount,
    ruleCounts,
    cueCount: cues.length,
  };
}

/**
 * Apply every enabled autofix, in a deliberate order.
 *
 * @param {import('./cue.js').Cue[]} cues
 * @param {Config} [config]
 * @returns {{ cues: import('./cue.js').Cue[], changed: number, applied: Record<string, number> }}
 */
export function fix(cues, config = {}) {
  const { entries } = resolveConfig(config);
  const enabled = new Map(
    entries.filter((e) => e.severity !== 'off').map((e) => [e.rule.id, e.options]),
  );

  const ordered = [
    ...fixOrder.filter((id) => enabled.has(id)),
    ...entries.filter((e) => e.severity !== 'off' && !fixOrder.includes(e.rule.id)).map((e) => e.rule.id),
  ];

  let working = cloneCues(cues);
  /** @type {Record<string, number>} */
  const applied = {};
  let changed = 0;

  for (const id of ordered) {
    const rule = ruleMap.get(id);
    if (!rule || typeof rule.fix !== 'function') continue;
    const options = enabled.get(id) ?? {};
    const result = rule.fix(working, options);
    if (result && Array.isArray(result.cues)) {
      working = result.cues;
      if (result.changed > 0) {
        applied[id] = (applied[id] ?? 0) + result.changed;
        changed += result.changed;
      }
    }
  }

  working = working.map((cue, i) => ({ ...cue, index: i + 1 }));
  return { cues: working, changed, applied };
}

/**
 * Convenience: fix, then lint the result so callers can report what remains.
 *
 * @param {import('./cue.js').Cue[]} cues
 * @param {Config} [config]
 */
export function fixAndLint(cues, config = {}) {
  const before = lint(cues, config);
  const fixed = fix(cues, config);
  const after = lint(fixed.cues, config);
  return { before, after, ...fixed };
}

/** @param {Severity} severity @returns {number} */
export function severityRank(severity) {
  return SEVERITY_RANK[severity] ?? 0;
}

export { allRules, ruleMap, presets };
