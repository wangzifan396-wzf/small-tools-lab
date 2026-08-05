/**
 * Renderers for a diff result: terminal inline, unified, HTML and JSON.
 *
 * @module core/format
 */

import { reconstructLines } from './diff.js';
import { diffArrays } from './lcs.js';

const ANSI = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  strike: (s) => `\x1b[9m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  reset: '\x1b[0m',
};

/** @param {string} s @returns {string} */
export function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Terminal inline view: deletions struck-through in red, insertions in green.
 * @param {{ ops: import('./lcs.js').Op[] }} result
 * @param {{ color?: boolean }} [options]
 * @returns {string}
 */
export function formatInline(result, options = {}) {
  const color = options.color !== false;
  let out = '';
  for (const op of result.ops) {
    const text = op.tokens.map((t) => t.value).join('');
    if (op.type === 'equal') out += text;
    else if (op.type === 'delete') out += color ? ANSI.strike(ANSI.red(text)) : text;
    else out += color ? ANSI.green(text) : text;
  }
  return out;
}

/**
 * Classic unified diff (line-based hunks rebuilt from the token diff).
 * @param {{ ops: import('./lcs.js').Op[] }} result
 * @param {{ context?: number, aLabel?: string, bLabel?: string }} [options]
 * @returns {string}
 */
export function formatUnified(result, options = {}) {
  const context = options.context ?? 3;
  const aLabel = options.aLabel ?? 'a';
  const bLabel = options.bLabel ?? 'b';

  const aLines = reconstructLines(result.ops, 'a');
  const bLines = reconstructLines(result.ops, 'b');

  const lineOps = diffArrays(aLines, bLines, (x, y) => x === y);
  /** @type {{ kind: string, text: string, a: number|null, b: number|null }[]} */
  const flat = [];
  let ai = 0;
  let bi = 0;
  for (const op of lineOps) {
    if (op.type === 'equal') {
      for (const line of op.tokens) {
        flat.push({ kind: '=', text: line, a: ai, b: bi });
        ai += 1;
        bi += 1;
      }
    } else if (op.type === 'delete') {
      for (const line of op.tokens) {
        flat.push({ kind: '-', text: line, a: ai, b: null });
        ai += 1;
      }
    } else {
      for (const line of op.tokens) {
        flat.push({ kind: '+', text: line, a: null, b: bi });
        bi += 1;
      }
    }
  }

  const n = flat.length;
  if (n === 0 || flat.every((f) => f.kind === '=')) return '';

  /** @type {string[]} */
  const hunks = [];
  let i = 0;
  while (i < n) {
    if (flat[i].kind === '=') {
      i += 1;
      continue;
    }
    const start = Math.max(0, i - context);
    let end = i;
    while (end < n && flat[end].kind !== '=') end += 1;
    const hunkEnd = Math.min(n, end + context);

    let oldCount = 0;
    let newCount = 0;
    let oldStart = null;
    let newStart = null;
    for (let k = start; k < hunkEnd; k += 1) {
      const f = flat[k];
      if (f.a !== null) {
        oldCount += 1;
        if (oldStart === null) oldStart = f.a;
      }
      if (f.b !== null) {
        newCount += 1;
        if (newStart === null) newStart = f.b;
      }
    }

    hunks.push(`@@ -${oldStart + 1},${oldCount} +${newStart + 1},${newCount} @@`);
    for (let k = start; k < hunkEnd; k += 1) {
      const f = flat[k];
      const prefix = f.kind === '=' ? ' ' : f.kind;
      hunks.push(prefix + f.text);
    }
    i = hunkEnd;
  }

  return [`--- ${aLabel}`, `+++ ${bLabel}`, ...hunks].join('\n') + '\n';
}

/** @param {string} s @returns {string} */
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Standalone HTML document of the diff.
 * @param {{ ops: import('./lcs.js').Op[], stats: object }} result
 * @param {{ mode?: 'inline'|'side', title?: string }} [options]
 * @returns {string}
 */
export function formatHtml(result, options = {}) {
  const mode = options.mode ?? 'inline';
  const title = options.title ?? 'diffwords';
  const body = mode === 'side' ? sideBySide(result) : inlineHtml(result);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
         background: #0f1115; color: #e7e9ee; margin: 0; padding: 24px; }
  del { background: #5a1d1d; color: #ffb4b4; text-decoration: line-through; }
  ins { background: #173a26; color: #8ff0b6; text-decoration: none; }
  table { border-collapse: collapse; width: 100%; }
  td { vertical-align: top; width: 50%; padding: 2px 10px; white-space: pre-wrap;
       border-right: 1px solid #262b36; }
  .rm { background: #2a1414; }
  .add { background: #10241a; }
  h1 { font-size: 16px; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>`;
}

/** @param {{ ops: import('./lcs.js').Op[] }} result @returns {string} */
function inlineHtml(result) {
  let html = '';
  for (const op of result.ops) {
    const text = escapeHtml(op.tokens.map((t) => t.value).join(''));
    if (op.type === 'equal') html += text;
    else if (op.type === 'delete') html += `<del>${text}</del>`;
    else html += `<ins>${text}</ins>`;
  }
  return `<p>${html}</p>`;
}

/** @param {{ ops: import('./lcs.js').Op[] }} result @returns {string} */
function sideBySide(result) {
  const aLines = reconstructLines(result.ops, 'a');
  const bLines = reconstructLines(result.ops, 'b');
  const ops = diffArrays(aLines, bLines, (x, y) => x === y);
  let ai = 0;
  let bi = 0;
  /** @type {[string,string,string,string][]} */ // [aclass, atext, bclass, btext]
  const rows = [];
  for (const op of ops) {
    if (op.type === 'equal') {
      op.tokens.forEach((line) => {
        rows.push(['', escapeHtml(line), '', escapeHtml(line)]);
        ai += 1;
        bi += 1;
      });
    } else if (op.type === 'delete') {
      op.tokens.forEach((line) => {
        rows.push(['rm', escapeHtml(line), '', '']);
        ai += 1;
      });
    } else {
      op.tokens.forEach((line) => {
        rows.push(['', '', 'add', escapeHtml(line)]);
        bi += 1;
      });
    }
  }
  const cells = rows
    .map(
      ([ac, at, bc, bt]) =>
        `<td class="${ac}">${at || ''}</td><td class="${bc}">${bt || ''}</td>`,
    )
    .join('\n');
  return `<table><tr>${cells}</tr></table>`;
}

/**
 * Machine-readable JSON.
 * @param {{ ops: import('./lcs.js').Op[], stats: object }} result
 * @returns {string}
 */
export function formatJson(result) {
  const out = {
    tool: 'diffwords',
    stats: result.stats,
    ops: result.ops.map((op) => ({
      type: op.type,
      value: op.tokens.map((t) => t.value).join(''),
    })),
  };
  return JSON.stringify(out, null, 2);
}
