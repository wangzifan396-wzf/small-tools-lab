/**
 * Human and machine readable reporters.
 *
 * @module core/report
 */

import { createColors } from './colors.js';
import { formatSrtTime, formatHuman } from './timecode.js';
import { histogram } from './stats.js';
import { displayWidth } from './text.js';

/**
 * Pad to a target *display* width — a CJK character occupies two columns, so
 * `String.padEnd` misaligns any table containing Chinese text.
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
function padDisplay(text, width) {
  return text + ' '.repeat(Math.max(0, width - displayWidth(text)));
}

/**
 * @typedef {Object} FileReport
 * @property {string} file
 * @property {import('./lint.js').LintResult} result
 * @property {string[]} [parseWarnings]
 */

const SEVERITY_LABEL = { error: 'error', warn: 'warn', info: 'info', off: 'off' };

/**
 * ESLint-style output.
 *
 * @param {FileReport[]} reports
 * @param {{ color?: boolean, showRuleIds?: boolean, maxPerFile?: number }} [options]
 * @returns {string}
 */
export function formatText(reports, options = {}) {
  const { color = true, showRuleIds = true, maxPerFile = Infinity } = options;
  const c = createColors(color);

  const out = [];
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let fixable = 0;

  for (const report of reports) {
    const { file, result } = report;
    errors += result.errorCount;
    warnings += result.warningCount;
    infos += result.infoCount;
    fixable += result.fixableCount;

    const hasProblems = result.diagnostics.length > 0;
    const hasWarnings = (report.parseWarnings ?? []).length > 0;
    if (!hasProblems && !hasWarnings) continue;

    out.push(c.underline(file));

    for (const warning of report.parseWarnings ?? []) {
      out.push(`  ${c.gray('parse')}  ${warning}`);
    }

    const rows = result.diagnostics.slice(0, maxPerFile).map((d) => {
      const severity =
        d.severity === 'error'
          ? c.red(SEVERITY_LABEL[d.severity])
          : d.severity === 'warn'
            ? c.yellow(SEVERITY_LABEL[d.severity])
            : c.blue(SEVERITY_LABEL[d.severity]);
      return {
        position: `#${d.cueIndex}${d.line ? `:${d.line}` : ''}`,
        time: formatSrtTime(d.start),
        severity,
        severityWidth: SEVERITY_LABEL[d.severity].length,
        fix: d.fixable ? c.green('✓') : ' ',
        message: d.message,
        rule: d.ruleId,
      };
    });

    const posWidth = Math.max(0, ...rows.map((r) => r.position.length));
    const sevWidth = Math.max(0, ...rows.map((r) => r.severityWidth));
    const msgWidth = Math.max(0, ...rows.map((r) => displayWidth(r.message)));

    for (const row of rows) {
      const severity = row.severity + ' '.repeat(sevWidth - row.severityWidth);
      const message = showRuleIds ? padDisplay(row.message, msgWidth) : row.message;
      out.push(
        `  ${c.dim(row.position.padStart(posWidth))} ${c.gray(row.time)}  ${severity} ${row.fix} ` +
          `${message}${showRuleIds ? `  ${c.gray(row.rule)}` : ''}`,
      );
    }

    if (result.diagnostics.length > maxPerFile) {
      out.push(c.gray(`  … and ${result.diagnostics.length - maxPerFile} more`));
    }

    out.push('');
  }

  const total = errors + warnings + infos;
  if (total === 0) {
    out.push(c.green('✔ no problems found'));
  } else {
    const parts = [];
    if (errors) parts.push(c.red(`${errors} error${errors === 1 ? '' : 's'}`));
    if (warnings) parts.push(c.yellow(`${warnings} warning${warnings === 1 ? '' : 's'}`));
    if (infos) parts.push(c.blue(`${infos} info${infos === 1 ? '' : 's'}`));
    const head = errors > 0 ? c.red('✖') : c.yellow('▲');
    let line = `${head} ${total} problem${total === 1 ? '' : 's'} (${parts.join(', ')})`;
    if (fixable > 0) line += c.gray(` · ${fixable} auto-fixable with `) + c.bold('--fix');
    out.push(line);
  }

  return out.join('\n');
}

/**
 * One problem per line — grep and editor friendly.
 * @param {FileReport[]} reports
 * @returns {string}
 */
export function formatCompact(reports) {
  const lines = [];
  for (const { file, result } of reports) {
    for (const d of result.diagnostics) {
      lines.push(
        `${file}:${d.cueIndex}${d.line ? `:${d.line}` : ''}: ${d.severity}: ${d.message} [${d.ruleId}]`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * @param {FileReport[]} reports
 * @param {{ indent?: number }} [options]
 * @returns {string}
 */
export function formatJson(reports, options = {}) {
  const { indent = 2 } = options;
  const payload = {
    tool: 'subzen',
    files: reports.map(({ file, result, parseWarnings }) => ({
      file,
      cueCount: result.cueCount,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      infoCount: result.infoCount,
      fixableCount: result.fixableCount,
      parseWarnings: parseWarnings ?? [],
      diagnostics: result.diagnostics,
    })),
    summary: reports.reduce(
      (acc, r) => ({
        errorCount: acc.errorCount + r.result.errorCount,
        warningCount: acc.warningCount + r.result.warningCount,
        infoCount: acc.infoCount + r.result.infoCount,
        fixableCount: acc.fixableCount + r.result.fixableCount,
      }),
      { errorCount: 0, warningCount: 0, infoCount: 0, fixableCount: 0 },
    ),
  };
  return `${JSON.stringify(payload, null, indent)}\n`;
}

/**
 * GitHub Actions workflow commands — problems show up inline on the PR.
 * @param {FileReport[]} reports
 * @returns {string}
 */
export function formatGitHub(reports) {
  const lines = [];
  for (const { file, result } of reports) {
    for (const d of result.diagnostics) {
      const level = d.severity === 'error' ? 'error' : d.severity === 'warn' ? 'warning' : 'notice';
      const title = `${d.ruleId} (cue #${d.cueIndex})`;
      lines.push(
        `::${level} file=${file},title=${escapeProperty(title)}::` +
          `${escapeData(`${formatSrtTime(d.start)} ${d.message}`)}`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * @param {ReturnType<import('./stats.js').computeStats>} stats
 * @param {{ color?: boolean, title?: string, pressures?: number[] }} [options]
 * @returns {string}
 */
export function formatStats(stats, options = {}) {
  const { color = true, title, pressures } = options;
  const c = createColors(color);
  const out = [];

  if (title) out.push(c.underline(title));

  const rows = [
    ['cues', String(stats.cueCount)],
    ['lines', String(stats.lineCount)],
    ['span', `${formatSrtTime(stats.span.start)} → ${formatSrtTime(stats.span.end)}  (${formatHuman(stats.span.duration)})`],
    ['on screen', `${formatHuman(stats.onScreen)}  (${(stats.coverage * 100).toFixed(1)}% of span)`],
    ['script', `${stats.dominant}  ·  ${stats.chars.cjk} CJK / ${stats.chars.latin} Latin`],
    ['duration', `min ${formatHuman(stats.duration.min)}  median ${formatHuman(stats.duration.median)}  max ${formatHuman(stats.duration.max)}`],
    ['line width', `median ${stats.width.median}  p95 ${stats.width.p95}  max ${stats.width.max} columns`],
    ['reading load', `median ${stats.pressure.median.toFixed(2)}x  max ${stats.pressure.max.toFixed(2)}x`],
    ['too fast', `${stats.tooFast} cue${stats.tooFast === 1 ? '' : 's'} above 1.00x`],
    ['gaps', `median ${formatHuman(stats.gap.median)}  max ${formatHuman(stats.gap.max)}`],
    ['lines/cue', Object.entries(stats.lineCounts).sort().map(([k, v]) => `${k}:${v}`).join('  ')],
  ];

  const keyWidth = Math.max(...rows.map(([k]) => k.length));
  for (const [key, value] of rows) {
    out.push(`  ${c.gray(key.padEnd(keyWidth))}  ${value}`);
  }

  if (pressures && pressures.length > 0) {
    out.push('');
    out.push(`  ${c.gray('reading load distribution')}`);
    for (const line of histogram(pressures, { buckets: 8, width: 28, format: (n) => `${n.toFixed(2)}x` })) {
      out.push(`  ${line}`);
    }
  }

  return out.join('\n');
}

/** @param {string} value @returns {string} */
function escapeData(value) {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** @param {string} value @returns {string} */
function escapeProperty(value) {
  return escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}
