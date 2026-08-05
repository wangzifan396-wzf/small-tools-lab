/**
 * Command line interface.
 *
 * This is the only module that touches the filesystem — the library itself
 * stays environment-agnostic.
 *
 * @module cli
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { parse, serialize, detectFormat, formatFromFilename, writableFormats } from './formats/index.js';
import { lint, fix, resolveConfig } from './core/lint.js';
import { allRules, presets } from './rules/index.js';
import { shift, resync, convertFrameRate, rewrap, dedupe, removeEmpty, slice } from './core/transform.js';
import { mergeBilingual, splitBilingual, analyzeAlignment } from './core/bilingual.js';
import { computeStats } from './core/stats.js';
import { cueDuration, cueText } from './core/cue.js';
import { readingPressure, stripTags } from './core/text.js';
import { parseDuration, parseTimecode, resolveFrameRate, formatHuman } from './core/timecode.js';
import { formatText, formatCompact, formatJson, formatGitHub, formatStats } from './core/report.js';
import { createColors, supportsColor } from './core/colors.js';
import { VERSION } from './index.js';

const VALUE_FLAGS = new Set([
  'output', 'o',
  'preset', 'p',
  'config', 'c',
  'format', 'f',
  'to', 't',
  'as',
  'by',
  'anchor',
  'from',
  'width',
  'max-lines',
  'max-warnings',
  'eol',
  'top',
  'separator',
  'min-overlap',
  'strategy',
  'rule',
  'out-dir',
  'encoding',
  'start',
  'end',
  'fps',
]);

const REPEATABLE = new Set(['anchor', 'rule']);

const CONFIG_NAMES = ['subzen.config.json', '.subzenrc.json', '.subzenrc'];

/**
 * @param {string[]} argv
 * @returns {{ command: string, positionals: string[], flags: Record<string, any> }}
 */
export function parseArgs(argv) {
  /** @type {Record<string, any>} */
  const flags = {};
  /** @type {string[]} */
  const positionals = [];

  let i = 0;
  let noMoreFlags = false;

  while (i < argv.length) {
    const token = argv[i];

    if (noMoreFlags || token === '-' || !token.startsWith('-')) {
      positionals.push(token);
      i += 1;
      continue;
    }

    if (token === '--') {
      noMoreFlags = true;
      i += 1;
      continue;
    }

    const isLong = token.startsWith('--');
    let name = token.replace(/^--?/, '');
    let value;

    const eq = name.indexOf('=');
    if (eq !== -1) {
      value = name.slice(eq + 1);
      name = name.slice(0, eq);
    }

    if (isLong && name.startsWith('no-') && value === undefined && !VALUE_FLAGS.has(name)) {
      flags[name.slice(3)] = false;
      i += 1;
      continue;
    }

    if (value === undefined && VALUE_FLAGS.has(name)) {
      value = argv[i + 1];
      if (value === undefined) throw new Error(`Option --${name} needs a value`);
      i += 1;
    }

    const key = normalizeFlag(name);
    const resolved = value === undefined ? true : value;

    if (REPEATABLE.has(name) || REPEATABLE.has(key)) {
      flags[key] = [...(flags[key] ?? []), resolved];
    } else {
      flags[key] = resolved;
    }

    i += 1;
  }

  const command = positionals.shift() ?? '';
  return { command, positionals, flags };
}

/** @param {string} name @returns {string} */
function normalizeFlag(name) {
  const aliases = {
    o: 'output',
    p: 'preset',
    c: 'config',
    f: 'format',
    t: 'to',
    i: 'in-place',
    h: 'help',
    v: 'version',
    q: 'quiet',
  };
  return aliases[name] ?? name;
}

/* ------------------------------------------------------------------ *
 * IO helpers
 * ------------------------------------------------------------------ */

/**
 * Decode a buffer, falling back to GBK when it is not valid UTF-8.
 * Plenty of Chinese subtitle files in circulation are still GBK/GB18030.
 *
 * @param {Buffer} buffer
 * @param {string} [encoding]
 * @returns {{ text: string, encoding: string }}
 */
export function decodeBuffer(buffer, encoding) {
  if (encoding && encoding !== 'auto') {
    return { text: new TextDecoder(encoding).decode(buffer), encoding };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buffer), encoding: 'utf-8' };
  } catch {
    for (const candidate of ['gb18030', 'big5', 'shift_jis']) {
      try {
        return { text: new TextDecoder(candidate, { fatal: true }).decode(buffer), encoding: candidate };
      } catch {
        /* try the next one */
      }
    }
    return { text: new TextDecoder('utf-8').decode(buffer), encoding: 'utf-8 (lossy)' };
  }
}

/** @param {string} file @param {string} [encoding] */
function readSource(file, encoding) {
  if (file === '-') {
    const buffer = fs.readFileSync(0);
    return { ...decodeBuffer(buffer, encoding), file: '<stdin>' };
  }
  const buffer = fs.readFileSync(file);
  return { ...decodeBuffer(buffer, encoding), file };
}

/**
 * Expand `*` patterns so Windows shells behave like a POSIX one.
 * @param {string[]} patterns
 * @returns {string[]}
 */
export function expandInputs(patterns) {
  /** @type {string[]} */
  const out = [];
  for (const pattern of patterns) {
    if (pattern === '-' || !/[*?]/.test(pattern)) {
      out.push(pattern);
      continue;
    }
    const dir = path.dirname(pattern);
    const base = path.basename(pattern);
    const re = new RegExp(
      `^${base.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
      'i',
    );
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries.sort()) {
      if (re.test(entry)) out.push(path.join(dir, entry));
    }
  }
  return out;
}

/**
 * @param {string} content
 * @param {{ output?: string, inPlace?: boolean, sourceFile?: string }} options
 * @returns {string|null} the path written to, or null when printed
 */
function writeOutput(content, options) {
  const { output, inPlace, sourceFile } = options;
  const target = inPlace ? sourceFile : output;
  if (!target || target === '-') {
    process.stdout.write(content);
    return null;
  }
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

/**
 * @param {Record<string, any>} flags
 * @returns {import('./core/lint.js').Config}
 */
function loadConfig(flags) {
  /** @type {import('./core/lint.js').Config} */
  let config = {};

  const explicit = flags.config;
  if (typeof explicit === 'string') {
    config = JSON.parse(fs.readFileSync(explicit, 'utf8'));
  } else if (explicit !== false) {
    let dir = process.cwd();
    // Walk up until we hit the filesystem root.
    for (;;) {
      const found = CONFIG_NAMES.map((name) => path.join(dir, name)).find((p) => fs.existsSync(p));
      if (found) {
        config = JSON.parse(fs.readFileSync(found, 'utf8'));
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  if (typeof flags.preset === 'string') config = { ...config, preset: flags.preset };

  const overrides = /** @type {string[]} */ (flags.rule ?? []);
  if (overrides.length > 0) {
    const rules = { ...(config.rules ?? {}) };
    for (const entry of overrides) {
      const [id, severity = 'warn'] = String(entry).split('=');
      rules[id] = /** @type {any} */ (severity);
    }
    config = { ...config, rules };
  }

  return config;
}

/* ------------------------------------------------------------------ *
 * Commands
 * ------------------------------------------------------------------ */

/**
 * @param {string[]} argv
 * @returns {Promise<number>} process exit code
 */
export async function run(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`subzen: ${/** @type {Error} */ (error).message}\n`);
    return 2;
  }

  const { command, positionals, flags } = parsed;
  const color = flags.color === false ? false : supportsColor();
  const c = createColors(color);
  flags.__color = color;

  if (flags.version || command === 'version') {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  if (!command || flags.help || command === 'help') {
    const topic = command === 'help' || !command ? positionals[0] : command;
    process.stdout.write(usage(c, topic));
    return command ? 0 : 1;
  }

  try {
    switch (command) {
      case 'lint':
        return cmdLint(positionals, flags, c);
      case 'fix':
        return cmdFix(positionals, flags, c);
      case 'convert':
        return cmdConvert(positionals, flags, c);
      case 'shift':
        return cmdShift(positionals, flags, c);
      case 'resync':
        return cmdResync(positionals, flags, c);
      case 'fps':
        return cmdFps(positionals, flags, c);
      case 'merge':
        return cmdMerge(positionals, flags, c);
      case 'split':
        return cmdSplit(positionals, flags, c);
      case 'wrap':
        return cmdWrap(positionals, flags, c);
      case 'clean':
        return cmdClean(positionals, flags, c);
      case 'stats':
        return cmdStats(positionals, flags, c);
      case 'rules':
        return cmdRules(flags, c);
      case 'init':
        return cmdInit(flags, c);
      default:
        process.stderr.write(`subzen: unknown command "${command}"\n\n${usage(c)}`);
        return 2;
    }
  } catch (error) {
    const err = /** @type {Error} */ (error);
    process.stderr.write(`${c.red('subzen:')} ${err.message}\n`);
    if (flags.debug) process.stderr.write(`${err.stack}\n`);
    return 2;
  }
}

/**
 * @param {string[]} files
 * @param {Record<string, any>} flags
 * @param {ReturnType<typeof createColors>} c
 */
function cmdLint(files, flags, c) {
  const inputs = expandInputs(files);
  if (inputs.length === 0) throw new Error('lint needs at least one file (use "-" for stdin)');

  const config = loadConfig(flags);
  resolveConfig(config); // fail fast on a bad preset or severity

  /** @type {import('./core/report.js').FileReport[]} */
  const reports = [];
  let totalFixed = 0;

  for (const input of inputs) {
    const source = readSource(input, flags.encoding);
    const track = parse(source.text, { filename: source.file, format: flags.as });

    let cues = track.cues;
    if (flags.fix) {
      const result = fix(cues, config);
      cues = result.cues;
      totalFixed += result.changed;
      if (result.changed > 0) {
        const out = serialize({ ...track, cues }, { format: track.format, eol: flags.eol });
        writeOutput(out, { inPlace: input !== '-', sourceFile: input, output: flags.output });
      }
    }

    reports.push({ file: source.file, result: lint(cues, config), parseWarnings: track.warnings });
  }

  const style = flags.format ?? 'text';
  const rendered =
    style === 'json'
      ? formatJson(reports)
      : style === 'github'
        ? formatGitHub(reports)
        : style === 'compact'
          ? formatCompact(reports)
          : formatText(reports, { color: flags.__color === true });

  if (rendered.trim()) process.stdout.write(`${rendered}\n`);
  if (flags.fix && totalFixed > 0 && style === 'text') {
    process.stdout.write(c.green(`✔ applied ${totalFixed} automatic fix${totalFixed === 1 ? '' : 'es'}\n`));
  }

  const errors = reports.reduce((n, r) => n + r.result.errorCount, 0);
  const warnings = reports.reduce((n, r) => n + r.result.warningCount, 0);
  const maxWarnings = flags['max-warnings'] === undefined ? -1 : Number(flags['max-warnings']);

  if (errors > 0) return 1;
  if (maxWarnings >= 0 && warnings > maxWarnings) return 1;
  return 0;
}

function cmdFix(files, flags, c) {
  return cmdLint(files, { ...flags, fix: true }, c);
}

function cmdConvert(files, flags, c) {
  const [input] = files;
  if (!input) throw new Error('convert needs an input file');

  const source = readSource(input, flags.encoding);
  const track = parse(source.text, { filename: source.file, format: flags.as });

  const target =
    flags.to ??
    (typeof flags.output === 'string' ? formatFromFilename(flags.output) : null) ??
    'srt';

  if (!writableFormats.includes(target)) {
    throw new Error(`unknown target format "${target}" (try: ${writableFormats.join(', ')})`);
  }

  const out = serialize(track, { format: target, eol: flags.eol });
  const written = writeOutput(out, { output: flags.output, sourceFile: input });
  if (written) {
    process.stderr.write(
      c.green(`✔ ${source.file} (${track.format}) → ${written} (${target}), ${track.cues.length} cues\n`),
    );
  }
  return 0;
}

function cmdShift(files, flags, c) {
  const [input] = files;
  if (!input) throw new Error('shift needs an input file');
  if (flags.by === undefined) throw new Error('shift needs --by (e.g. --by 2.5s or --by -400ms)');

  const delta = parseDuration(String(flags.by));
  if (Number.isNaN(delta)) throw new Error(`cannot read duration "${flags.by}"`);

  const source = readSource(input, flags.encoding);
  const track = parse(source.text, { filename: source.file, format: flags.as });
  const cues = shift(track.cues, delta);

  const out = serialize({ ...track, cues }, { format: flags.to ?? track.format, eol: flags.eol });
  const written = writeOutput(out, {
    output: flags.output,
    inPlace: flags['in-place'],
    sourceFile: input,
  });
  if (written) process.stderr.write(c.green(`✔ shifted ${cues.length} cues by ${formatHuman(delta)} → ${written}\n`));
  return 0;
}

function cmdResync(files, flags, c) {
  const [input] = files;
  if (!input) throw new Error('resync needs an input file');

  const raw = /** @type {string[]} */ (flags.anchor ?? []);
  if (raw.length === 0) {
    throw new Error(
      'resync needs at least one --anchor "00:00:12,000=00:00:14,500".\n' +
        'Two anchors, one near the start and one near the end, also correct drift.',
    );
  }

  const anchors = raw.map((entry) => {
    const [from, to] = String(entry).split(/[=>]+/).map((s) => s.trim());
    const parsedFrom = parseTimecode(from);
    const parsedTo = parseTimecode(to);
    if (Number.isNaN(parsedFrom) || Number.isNaN(parsedTo)) {
      throw new Error(`cannot read anchor "${entry}" (expected FROM=TO)`);
    }
    return { from: parsedFrom, to: parsedTo };
  });

  const source = readSource(input, flags.encoding);
  const track = parse(source.text, { filename: source.file, format: flags.as });
  const { cues, rate, offset } = resync(track.cues, anchors);

  const out = serialize({ ...track, cues }, { format: flags.to ?? track.format, eol: flags.eol });
  const written = writeOutput(out, {
    output: flags.output,
    inPlace: flags['in-place'],
    sourceFile: input,
  });

  const drift = ((rate - 1) * 100).toFixed(4);
  process.stderr.write(
    c.green(`✔ resync: rate ${rate.toFixed(6)} (${drift}% speed change), offset ${formatHuman(offset)}`) +
      (written ? ` → ${written}` : '') +
      '\n',
  );
  return 0;
}

function cmdFps(files, flags, c) {
  const [input] = files;
  if (!input) throw new Error('fps needs an input file');

  const from = resolveFrameRate(flags.from ?? '');
  const to = resolveFrameRate(flags.to ?? '');
  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new Error('fps needs --from and --to (e.g. --from 23.976 --to 25)');
  }

  const source = readSource(input, flags.encoding);
  const track = parse(source.text, { filename: source.file, format: flags.as });
  const cues = convertFrameRate(track.cues, { from, to });

  const out = serialize({ ...track, cues }, { format: track.format, eol: flags.eol });
  const written = writeOutput(out, {
    output: flags.output,
    inPlace: flags['in-place'],
    sourceFile: input,
  });
  if (written) {
    process.stderr.write(c.green(`✔ retimed ${from.toFixed(3)}fps → ${to.toFixed(3)}fps → ${written}\n`));
  }
  return 0;
}

function cmdMerge(files, flags, c) {
  const [primaryPath, secondaryPath] = files;
  if (!primaryPath || !secondaryPath) throw new Error('merge needs two files: <primary> <secondary>');

  const a = readSource(primaryPath, flags.encoding);
  const b = readSource(secondaryPath, flags.encoding);
  const trackA = parse(a.text, { filename: a.file });
  const trackB = parse(b.text, { filename: b.file });

  const alignment = analyzeAlignment(trackA.cues, trackB.cues, {
    minOverlap: Number(flags['min-overlap'] ?? 0.2),
  });

  const merged = mergeBilingual(trackA.cues, trackB.cues, {
    minOverlap: Number(flags['min-overlap'] ?? 0.2),
    top: flags.top === 'secondary' ? 'secondary' : 'primary',
    keepUnmatched: flags.unmatched !== false,
    separator: typeof flags.separator === 'string' ? flags.separator : '\n',
  });

  const out = serialize({ ...trackA, cues: merged.cues }, { format: flags.to ?? trackA.format, eol: flags.eol });
  const written = writeOutput(out, { output: flags.output, sourceFile: primaryPath });

  process.stderr.write(
    c.green(
      `✔ merged ${merged.matched}/${trackB.cues.length} cues ` +
        `(match rate ${(alignment.matchRate * 100).toFixed(1)}%, average drift ${formatHuman(alignment.averageDrift)})`,
    ) + (written ? ` → ${written}` : '') + '\n',
  );
  if (merged.unmatched > 0) {
    process.stderr.write(
      c.yellow(`  ${merged.unmatched} cues had no counterpart. Try "subzen resync" first if the drift looks large.\n`),
    );
  }
  return 0;
}

function cmdSplit(files, flags, c) {
  const [input] = files;
  if (!input) throw new Error('split needs an input file');

  const source = readSource(input, flags.encoding);
  const track = parse(source.text, { filename: source.file });
  const { first, second } = splitBilingual(track.cues, {
    strategy: flags.strategy === 'line' ? 'line' : 'script',
    first: flags.first === 'latin' ? 'latin' : 'cjk',
  });

  const format = flags.to ?? track.format;
  const ext = format === 'json' ? '.json' : `.${format}`;
  const dir = typeof flags['out-dir'] === 'string' ? flags['out-dir'] : path.dirname(input === '-' ? '.' : input);
  const base = path.basename(input === '-' ? 'subtitle' : input).replace(/\.[^.]+$/, '');

  const targets = [
    { cues: first, file: path.join(dir, `${base}.1${ext}`) },
    { cues: second, file: path.join(dir, `${base}.2${ext}`) },
  ];

  for (const target of targets) {
    if (target.cues.length === 0) continue;
    const out = serialize({ ...track, cues: target.cues }, { format, eol: flags.eol });
    fs.mkdirSync(path.dirname(path.resolve(target.file)), { recursive: true });
    fs.writeFileSync(target.file, out, 'utf8');
    process.stderr.write(c.green(`✔ ${target.cues.length} cues → ${target.file}\n`));
  }
  return 0;
}

function cmdWrap(files, flags, c) {
  const [input] = files;
  if (!input) throw new Error('wrap needs an input file');

  const source = readSource(input, flags.encoding);
  const track = parse(source.text, { filename: source.file });
  const cues = rewrap(track.cues, {
    width: Number(flags.width ?? 40),
    maxLines: Number(flags['max-lines'] ?? 2),
    balance: flags.balance !== false,
  });

  const out = serialize({ ...track, cues }, { format: flags.to ?? track.format, eol: flags.eol });
  const written = writeOutput(out, {
    output: flags.output,
    inPlace: flags['in-place'],
    sourceFile: input,
  });
  if (written) process.stderr.write(c.green(`✔ re-wrapped ${cues.length} cues → ${written}\n`));
  return 0;
}

function cmdClean(files, flags, c) {
  const [input] = files;
  if (!input) throw new Error('clean needs an input file');

  const source = readSource(input, flags.encoding);
  const track = parse(source.text, { filename: source.file });

  let cues = removeEmpty(track.cues);
  cues = dedupe(cues);
  if (flags.start !== undefined || flags.end !== undefined) {
    cues = slice(cues, {
      start: flags.start === undefined ? 0 : parseTimecode(String(flags.start)),
      end: flags.end === undefined ? Infinity : parseTimecode(String(flags.end)),
      rebase: flags.rebase === true,
    });
  }

  const removed = track.cues.length - cues.length;
  const out = serialize({ ...track, cues }, { format: flags.to ?? track.format, eol: flags.eol });
  const written = writeOutput(out, {
    output: flags.output,
    inPlace: flags['in-place'],
    sourceFile: input,
  });
  if (written) process.stderr.write(c.green(`✔ removed ${removed} cues, kept ${cues.length} → ${written}\n`));
  return 0;
}

function cmdStats(files, flags, c) {
  const inputs = expandInputs(files);
  if (inputs.length === 0) throw new Error('stats needs at least one file');

  const payloads = [];

  for (const input of inputs) {
    const source = readSource(input, flags.encoding);
    const track = parse(source.text, { filename: source.file });
    const stats = computeStats(track.cues);

    if (flags.format === 'json') {
      payloads.push({ file: source.file, format: track.format, encoding: source.encoding, stats });
      continue;
    }

    const pressures = track.cues
      .filter((cue) => cueDuration(cue) > 0 && stripTags(cueText(cue, ' ')).trim())
      .map((cue) => readingPressure(stripTags(cueText(cue, ' ')), cueDuration(cue)));

    process.stdout.write(
      `${formatStats(stats, {
        color: flags.__color === true,
        title: `${source.file}  ${c.gray(`[${track.format}, ${source.encoding}]`)}`,
        pressures: flags.histogram !== false ? pressures : undefined,
      })}\n\n`,
    );
  }

  if (flags.format === 'json') process.stdout.write(`${JSON.stringify(payloads, null, 2)}\n`);
  return 0;
}

function cmdRules(flags, c) {
  if (flags.format === 'json') {
    process.stdout.write(
      `${JSON.stringify(
        {
          presets: Object.fromEntries(
            Object.entries(presets).map(([k, v]) => [k, { description: v.description, rules: v.rules }]),
          ),
          rules: allRules.map((r) => ({
            id: r.id,
            description: r.description,
            severity: r.severity,
            options: r.options ?? {},
            fixable: typeof r.fix === 'function',
          })),
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  const { entries } = resolveConfig(loadConfig(flags));
  const width = Math.max(...allRules.map((r) => r.id.length));

  process.stdout.write(`${c.bold('Rules')} ${c.gray(`(preset: ${flags.preset ?? 'recommended'})`)}\n\n`);
  for (const { rule, severity } of entries) {
    const tag =
      severity === 'error'
        ? c.red('error')
        : severity === 'warn'
          ? c.yellow(' warn')
          : severity === 'info'
            ? c.blue(' info')
            : c.gray('  off');
    const fixable = typeof rule.fix === 'function' ? c.green(' ✓') : '  ';
    process.stdout.write(`  ${tag}${fixable}  ${c.bold(rule.id.padEnd(width))}  ${c.gray(rule.description)}\n`);
  }

  process.stdout.write(`\n${c.bold('Presets')}\n\n`);
  const presetWidth = Math.max(...Object.keys(presets).map((k) => k.length));
  for (const [name, preset] of Object.entries(presets)) {
    process.stdout.write(`  ${c.bold(name.padEnd(presetWidth))}  ${c.gray(preset.description)}\n`);
  }
  process.stdout.write(`\n${c.gray('✓ marks rules that "subzen fix" can repair automatically.')}\n`);
  return 0;
}

function cmdInit(flags, c) {
  const target = typeof flags.output === 'string' ? flags.output : 'subzen.config.json';
  if (fs.existsSync(target) && flags.force !== true) {
    throw new Error(`${target} already exists (use --force to overwrite)`);
  }
  const content = `${JSON.stringify(
    {
      preset: flags.preset ?? 'cjk',
      rules: {
        'max-line-width': ['warn', { max: 32 }],
        'max-cps': ['warn', { cjkCps: 9, latinCps: 20 }],
        'no-line-end-period': 'info',
      },
    },
    null,
    2,
  )}\n`;
  fs.writeFileSync(target, content, 'utf8');
  process.stdout.write(c.green(`✔ wrote ${target}\n`));
  return 0;
}

/* ------------------------------------------------------------------ *
 * Help
 * ------------------------------------------------------------------ */

/**
 * @param {ReturnType<typeof createColors>} c
 * @param {string} [topic]
 * @returns {string}
 */
function usage(c, topic) {
  const b = c.bold;
  const g = c.gray;

  if (topic && topic !== 'help') {
    const detail = COMMAND_HELP[topic];
    if (detail) return `${b(`subzen ${topic}`)}\n\n${detail.trim()}\n`;
  }

  return `${b('subzen')} ${g(`v${VERSION}`)} — subtitle toolkit and quality linter with CJK smarts

${b('USAGE')}
  subzen <command> [files...] [options]        ${g('use "-" to read stdin')}

${b('COMMANDS')}
  ${b('lint')}     Check subtitles against a rule set        ${g('subzen lint ep01.srt --preset cjk')}
  ${b('fix')}      Apply every safe autofix in place         ${g('subzen fix ep01.srt')}
  ${b('convert')}  Convert between formats                   ${g('subzen convert a.ass -t srt -o a.srt')}
  ${b('shift')}    Move the whole timeline                   ${g('subzen shift a.srt --by -2.5s -i')}
  ${b('resync')}   Fix offset and drift from anchor points   ${g('subzen resync a.srt --anchor 0:0:12=0:0:14.5')}
  ${b('fps')}      Retime for a different frame rate         ${g('subzen fps a.srt --from 23.976 --to 25')}
  ${b('merge')}    Build a bilingual track from two files    ${g('subzen merge zh.srt en.srt -o both.srt')}
  ${b('split')}    Split a bilingual track back into two     ${g('subzen split both.srt')}
  ${b('wrap')}     Re-wrap lines to a target width           ${g('subzen wrap a.srt --width 32')}
  ${b('clean')}    Drop empty and duplicated cues            ${g('subzen clean a.srt -i')}
  ${b('stats')}    Reading speed and layout statistics       ${g('subzen stats a.srt')}
  ${b('rules')}    List rules and presets                    ${g('subzen rules --preset strict')}
  ${b('init')}     Write a starter config file               ${g('subzen init')}

${b('COMMON OPTIONS')}
  -o, --output <file>     Write to a file instead of stdout
  -i, --in-place          Rewrite the input file
  -p, --preset <name>     recommended | strict | loose | cjk | netflix
  -c, --config <file>     Config file (default: subzen.config.json, searched upwards)
      --rule <id=level>   Override one rule, repeatable ${g('--rule max-cps=off')}
  -t, --to <format>       srt | vtt | ass | lrc | json | txt | md
      --as <format>       Force the input format instead of detecting it
  -f, --format <style>    text | compact | json | github ${g('(lint/stats output)')}
      --encoding <enc>    Force input encoding ${g('(default: auto, falls back to GB18030)')}
      --max-warnings <n>  Exit non-zero when warnings exceed n
      --no-color          Disable colour
  -h, --help              Show help, or "subzen help <command>"
  -v, --version           Print the version

${b('EXIT CODES')}
  0  clean   1  problems found   2  bad usage

${g('Docs: https://github.com/OWNER/subzen')}
`;
}

/** @type {Record<string, string>} */
const COMMAND_HELP = {
  lint: `
Check a subtitle track and report problems.

  subzen lint ep01.srt
  subzen lint *.srt --preset cjk --max-warnings 0
  subzen lint ep01.srt --format github        # inline PR annotations
  subzen lint ep01.srt --rule no-line-end-period=warn
  subzen lint ep01.srt --fix                  # same as "subzen fix"

Presets: recommended (default), strict, loose, cjk, netflix.
Run "subzen rules" to see every rule and whether it is autofixable.
`,
  resync: `
Correct a timeline from known reference points.

One anchor shifts the whole track:

  subzen resync a.srt --anchor 00:00:12,000=00:00:14,500

Two anchors also correct drift — use one near the start and one near the
end. This is the fix for "in sync at the beginning, ten seconds off at the
end", which a plain shift cannot repair:

  subzen resync a.srt \\
    --anchor 00:00:12,000=00:00:14,500 \\
    --anchor 01:38:04,000=01:38:12,900
`,
  merge: `
Build a bilingual track from two separate files.

  subzen merge zh.srt en.srt -o bilingual.srt

Cues are matched by time overlap, not by index, so the two tracks do not
need the same number of cues. The primary file's timings win.

  --top secondary        Put the second file's language on the first line
  --min-overlap 0.35     Require a stronger overlap before pairing
  --no-unmatched         Drop secondary cues that matched nothing

If the match rate is low, the tracks are probably out of sync — run
"subzen resync" on one of them first.
`,
  stats: `
Report reading speed, line widths and timing distribution.

  subzen stats ep01.srt
  subzen stats *.srt --format json

"reading load" is the ratio between the time a viewer needs and the time the
cue is on screen. Anything above 1.00x is too fast. CJK and Latin text get
separate budgets (9 and 20 characters per second by default), so mixed-script
subtitles are judged fairly.
`,
};
