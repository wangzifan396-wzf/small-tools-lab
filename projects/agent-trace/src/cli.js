import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { analyzeRecords, parseJsonl } from './core/trace.js';
import { renderReport } from './core/render.js';

export const HELP = `Agent Trace - local coding-agent JSONL analytics

Usage: agent-trace <file-or-directory> [options]

Options:
  --format <pretty|json|markdown>  Output format (default: pretty)
  --output <file>                  Write the report to a file
  --fail-on-errors                 Exit 1 on malformed records or tool errors
  --help                           Show help
  --version                        Show version
`;

export function parseArgs(args) {
  const options = { path: null, format: 'pretty', output: null, failOnErrors: false, help: false, version: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-v') options.version = true;
    else if (arg === '--fail-on-errors') options.failOnErrors = true;
    else if (arg === '--format') options.format = args[++index];
    else if (arg === '--output') {
      if (!args[index + 1] || args[index + 1].startsWith('-')) throw new TypeError('--output requires a file');
      options.output = args[++index];
    }
    else if (arg.startsWith('-')) throw new TypeError(`Unknown option: ${arg}`);
    else if (options.path) throw new TypeError('Only one input path is supported');
    else options.path = arg;
  }
  if (!['pretty', 'json', 'markdown'].includes(options.format)) throw new TypeError('Format must be pretty, json, or markdown');
  return options;
}

export async function findTraceFiles(inputPath, limit = 200) {
  const target = resolve(inputPath);
  const info = await stat(target);
  if (info.isFile()) {
    if (!['.jsonl', '.ndjson'].includes(extname(target).toLowerCase())) throw new TypeError('Input file must use .jsonl or .ndjson');
    return [target];
  }
  if (!info.isDirectory()) throw new TypeError('Input must be a file or directory');
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (files.length >= limit) return;
      if (entry.isSymbolicLink() || ['.git', 'node_modules'].includes(entry.name)) continue;
      const child = join(directory, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (['.jsonl', '.ndjson'].includes(extname(entry.name).toLowerCase())) files.push(child);
    }
  }
  await visit(target);
  return files;
}

export async function run(args, io = {}) {
  const stdout = io.stdout || ((value) => process.stdout.write(value));
  const stderr = io.stderr || ((value) => process.stderr.write(value));
  let options;
  try { options = parseArgs(args); } catch (error) { stderr(`${error.message}\n${HELP}`); return 2; }
  if (options.help) { stdout(HELP); return 0; }
  if (options.version) { stdout('0.1.0\n'); return 0; }
  if (!options.path) { stderr(HELP); return 2; }
  try {
    const files = await findTraceFiles(resolve(io.cwd || process.cwd(), options.path));
    if (!files.length) throw new Error('No .jsonl or .ndjson files found');
    const records = [];
    const errors = [];
    for (const file of files) {
      const info = await stat(file);
      if (info.size > 50 * 1024 * 1024) { errors.push({ source: file, line: 0, message: 'file exceeds 50 MiB limit' }); continue; }
      const parsed = parseJsonl(await readFile(file, 'utf8'), file);
      records.push(...parsed.records);
      errors.push(...parsed.errors);
    }
    const report = analyzeRecords(records, { errors });
    const output = renderReport(report, options.format);
    if (options.output) await writeFile(resolve(io.cwd || process.cwd(), options.output), output, 'utf8');
    else stdout(output);
    const toolErrors = report.tools.reduce((sum, tool) => sum + tool.errors, 0);
    return options.failOnErrors && (errors.length || toolErrors) ? 1 : 0;
  } catch (error) {
    stderr(`agent-trace: ${error.message}\n`);
    return 2;
  }
}
