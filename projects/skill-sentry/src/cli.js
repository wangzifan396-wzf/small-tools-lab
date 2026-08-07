import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RULES, scanPath } from './core/scan.js';
import { renderReport } from './core/render.js';

export const HELP = `Skill Sentry - static security scanner for AI agent skills

Usage: skill-sentry <skill-or-directory> [options]

Options:
  --format <pretty|json|markdown|sarif>  Output format (default: pretty)
  --output <file>                        Write the report to a file
  --fail-on <high|medium|low|none>       Failure threshold (default: high)
  --ignore-rule <id>                     Ignore one rule (repeatable)
  --help                                 Show help
  --version                              Show version
`;
const RANK = { high: 3, medium: 2, low: 1, none: 4 };

export function parseArgs(args) {
  const options = { path: null, format: 'pretty', output: null, failOn: 'high', ignoreRules: [], help: false, version: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-v') options.version = true;
    else if (arg === '--format') options.format = args[++index];
    else if (arg === '--output') {
      if (!args[index + 1] || args[index + 1].startsWith('-')) throw new TypeError('--output requires a file');
      options.output = args[++index];
    }
    else if (arg === '--fail-on') options.failOn = args[++index];
    else if (arg === '--ignore-rule') options.ignoreRules.push(args[++index]);
    else if (arg.startsWith('-')) throw new TypeError(`Unknown option: ${arg}`);
    else if (options.path) throw new TypeError('Only one input path is supported');
    else options.path = arg;
  }
  if (!['pretty', 'json', 'markdown', 'sarif'].includes(options.format)) throw new TypeError('Invalid output format');
  if (!Object.hasOwn(RANK, options.failOn)) throw new TypeError('fail-on must be high, medium, low, or none');
  if (options.ignoreRules.some((id) => !Object.hasOwn(RULES, id || ''))) throw new TypeError('ignore-rule must name a known rule such as SS001');
  return options;
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
    const cwd = io.cwd || process.cwd();
    const report = await scanPath(resolve(cwd, options.path), { ignoreRules: options.ignoreRules });
    if (!report.skills) throw new Error('No SKILL.md files found');
    const output = renderReport(report, options.format);
    if (options.output) await writeFile(resolve(cwd, options.output), output, 'utf8');
    else stdout(output);
    if (options.failOn === 'none') return 0;
    return report.findings.some((item) => RANK[item.severity] >= RANK[options.failOn]) ? 1 : 0;
  } catch (error) {
    stderr(`skill-sentry: ${error.message}\n`);
    return 2;
  }
}
