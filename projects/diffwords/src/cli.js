/**
 * Command-line surface for diffwords. This is the only module that touches the
 * filesystem, keeping the library usable in the browser.
 *
 * @module cli
 */

import { readFileSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { diff } from './core/diff.js';
import {
  formatInline,
  formatUnified,
  formatHtml,
  formatJson,
  stripAnsi,
} from './core/format.js';

const VERSION = '0.1.0';

/**
 * @param {string} arg
 * @returns {string}
 */
function readInput(arg) {
  if (arg === '-' || arg === undefined) {
    try {
      return readFileSync(0, 'utf8');
    } catch {
      throw new Error('no stdin available');
    }
  }
  const buf = readFileSync(arg);
  return decodeBuffer(buf);
}

/**
 * @param {Buffer} buf
 * @returns {string}
 */
function decodeBuffer(buf) {
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('�')) return utf8;
  for (const enc of ['gbk', 'big5', 'shift-jis']) {
    try {
      const s = new TextDecoder(enc).decode(buf);
      if (!s.includes('�')) return s;
    } catch {
      /* encoding unsupported — keep trying */
    }
  }
  return utf8;
}

/**
 * @param {string[]} argv
 * @returns {{ files: string[], flags: Record<string, any> }}
 */
export function parseArgs(argv) {
  /** @type {string[]} */
  const files = [];
  /** @type {Record<string, any>} */
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('-')) {
      files.push(a);
      continue;
    }
    const key = a.replace(/^--?/, '');
    if (key === 'color') flags.color = argv[++i];
    else if (key === 'context') flags.context = Number(argv[++i]);
    else if (key === 'html') flags.html = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : true;
    else if (key === 'side') flags.side = true;
    else if (key === 'a-label') flags.aLabel = argv[++i];
    else if (key === 'b-label') flags.bLabel = argv[++i];
    else flags[key] = true;
  }
  return { files, flags };
}

/** @param {NodeJS.Process} proc @returns {number} */
export function run(proc) {
  const argv = proc.argv.slice(2);
  const { files, flags } = parseArgs(argv);

  if (flags.help) {
    proc.stdout.write(usage());
    return 0;
  }
  if (flags.version) {
    proc.stdout.write(`diffwords ${VERSION}\n`);
    return 0;
  }
  if (files.length < 2) {
    proc.stderr.write(usage());
    return 2;
  }

  const [aPath, bPath] = files;
  let aText;
  let bText;
  try {
    aText = readInput(aPath);
    bText = readInput(bPath);
  } catch (err) {
    proc.stderr.write(`diffwords: ${err.message}\n`);
    return 2;
  }

  const result = diff(aText, bText);
  const hasChanges = result.stats.added > 0 || result.stats.removed > 0;

  const wantColor =
    flags.color === 'on' ? true : flags.color === 'off' ? false : proc.stdout.isTTY;
  const color = flags.json ? false : wantColor;

  let output = '';
  if (flags.json) {
    output = formatJson(result);
  } else if (flags.html) {
    const html = formatHtml(result, { mode: flags.side ? 'side' : 'inline', title: 'diffwords' });
    if (typeof flags.html === 'string') {
      writeFileSync(flags.html, html);
      proc.stdout.write(`wrote ${flags.html}\n`);
    } else {
      output = html;
    }
  } else if (flags.unified || flags.u) {
    output = formatUnified(result, {
      context: flags.context ?? 3,
      aLabel: flags.aLabel ?? aPath,
      bLabel: flags.bLabel ?? bPath,
    });
  } else {
    output = formatInline(result, { color });
  }

  if (output) proc.stdout.write(output + (output.endsWith('\n') ? '' : '\n'));

  if (flags.stats || flags.summary) {
    const s = result.stats;
    const line = `tokens: ${s.total} · unchanged ${s.unchanged} · +${s.added} added · -${s.removed} removed · ${(s.similarity * 100).toFixed(1)}% similar`;
    proc.stdout.write((color ? line : stripAnsi(line)) + '\n');
  }

  return hasChanges ? 1 : 0;
}

/** @returns {string} */
export function usage() {
  return `diffwords — word-level, CJK-aware text differ

Usage:
  diffwords <a> <b> [options]

  a, b may be file paths or "-" for stdin.

Options:
  -u, --unified     Classic unified diff (line hunks).
      --inline      Inline view: deletions struck, insertions added (default).
      --html [file] Write a standalone HTML diff (omit file for stdout).
      --side        Use side-by-side layout for --html.
      --json        Machine-readable JSON (ops + stats).
      --stats       Print a token summary line.
      --context N   Context lines for --unified (default 3).
      --color on|off|auto   Force colored output (default auto).
      --a-label S   Label for the old side in unified output.
      --b-label S   Label for the new side in unified output.
  -h, --help        Show this help.
      --version     Print version.

Examples:
  diffwords draft-v1.txt draft-v2.txt
  diffwords a.txt b.txt --unified
  diffwords zh-old.txt zh-new.txt --html review.html
  cat old.md | diffwords - new.md --json
`;
}

export { VERSION };
