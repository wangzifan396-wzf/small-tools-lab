/**
 * Command-line surface for cronly. Only module that touches the filesystem.
 *
 * @module cli
 */

import { parse, CronError } from './core/parse.js';
import { describe } from './core/describe.js';
import { next, prev, partsInTz } from './core/schedule.js';

const VERSION = '0.1.0';
const COMMANDS = new Set(['parse', 'describe', 'next', 'prev']);

/**
 * @param {string[]} argv
 * @returns {{ command?: string, expr?: string, flags: Record<string, any> }}
 */
export function parseArgs(argv) {
  const flags = {};
  let command;
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('-') && command === undefined && COMMANDS.has(a)) {
      command = a;
      continue;
    }
    if (!a.startsWith('-')) {
      positionals.push(a);
      continue;
    }
    const key = a.replace(/^--?/, '');
    if (key === 'lang') flags.lang = argv[++i];
    else if (key === 'count') flags.count = Number(argv[++i]);
    else if (key === 'from') flags.from = argv[++i];
    else if (key === 'tz') flags.timeZone = argv[++i];
    else if (key === 'seconds') flags.seconds = true;
    else flags[key] = true;
  }
  return { command, expr: positionals[0], flags };
}

/**
 * Format a Date as `YYYY-MM-DD HH:mm:ss` in a timezone.
 * @param {Date} date
 * @param {string} [tz]
 * @returns {string}
 */
export function formatInTz(date, tz) {
  const p = partsInTz(date, tz);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/** @param {NodeJS.Process} proc @returns {number} */
export function run(proc) {
  const { command, expr, flags } = parseArgs(proc.argv.slice(2));

  if (flags.help) {
    proc.stdout.write(usage());
    return 0;
  }
  if (flags.version) {
    proc.stdout.write(`cronly ${VERSION}\n`);
    return 0;
  }
  if (!command || !COMMANDS.has(command)) {
    proc.stderr.write(usage());
    return 2;
  }
  if (!expr) {
    proc.stderr.write(`cronly ${command}: missing cron expression\n`);
    return 2;
  }

  const seconds = expr.trim().split(/\s+/).length === 6;
  const opts = { seconds, timeZone: flags.timeZone };

  try {
    if (command === 'parse') {
      const c = parse(expr, { seconds });
      const out = {
        valid: true,
        fields: seconds ? 6 : 5,
        seconds: seconds ? [...c.seconds].sort((a, b) => a - b) : undefined,
        minute: [...c.minute].sort((a, b) => a - b),
        hour: [...c.hour].sort((a, b) => a - b),
        dom: [...c.dom].sort((a, b) => a - b),
        month: [...c.month].sort((a, b) => a - b),
        dow: [...c.dow].sort((a, b) => a - b),
      };
      proc.stdout.write(JSON.stringify(out, null, 2) + '\n');
      return 0;
    }

    if (command === 'describe') {
      proc.stdout.write(describe(expr, { lang: flags.lang || 'en', seconds }) + '\n');
      return 0;
    }

    const from = flags.from ? new Date(flags.from) : new Date();
    if (flags.from && Number.isNaN(from.getTime())) {
      proc.stderr.write(`cronly: invalid --from "${flags.from}"\n`);
      return 2;
    }

    if (command === 'next') {
      const count = flags.count ?? 1;
      let cursor = from;
      for (let i = 0; i < count; i += 1) {
        const r = next(expr, cursor, opts);
        if (!r) {
          proc.stdout.write('no upcoming run within 5 years\n');
          break;
        }
        proc.stdout.write(formatInTz(r, flags.timeZone) + (flags.timeZone ? ` (${flags.timeZone})` : '') + '\n');
        cursor = r;
      }
      return 0;
    }

    if (command === 'prev') {
      const count = flags.count ?? 1;
      let cursor = from;
      for (let i = 0; i < count; i += 1) {
        const r = prev(expr, cursor, opts);
        if (!r) {
          proc.stdout.write('no previous run within 5 years\n');
          break;
        }
        proc.stdout.write(formatInTz(r, flags.timeZone) + (flags.timeZone ? ` (${flags.timeZone})` : '') + '\n');
        cursor = r;
      }
      return 0;
    }
  } catch (err) {
    if (err instanceof CronError) {
      proc.stderr.write(`cronly: ${err.message}\n`);
      return 2;
    }
    throw err;
  }
  return 0;
}

/** @returns {string} */
export function usage() {
  return `cronly — zero-dependency cron toolkit

Usage:
  cronly <command> <expression> [options]

Commands:
  parse     Validate and show the expanded fields.
  describe  Human-readable description (--lang en|zh).
  next      Next run time(s) (--count N --from ISO --tz IANA).
  prev      Previous run time(s).

Options:
      --lang en|zh     Language for describe (default en).
      --count N        Number of runs to list (default 1).
      --from ISO       Reference time (default now).
      --tz IANA        IANA timezone, e.g. America/New_York.
      --seconds        Treat a 6-field expression as seconds-included.
  -h, --help
      --version

Examples:
  cronly describe "0 9 * * 1-5"
  cronly describe "0 9 * * 1-5" --lang zh
  cronly next "0 9 * * 1-5" --count 5
  cronly next "0 9 * * 1-5" --tz Asia/Shanghai --count 3
  cronly parse "*/15 0 0 * * 1,15"
`;
}

export { VERSION };
