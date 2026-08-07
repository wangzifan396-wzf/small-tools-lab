import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectPid, inspectPort } from './core/inspect.js';
import { renderReport } from './core/render.js';

export const HELP = `Port Origin - explain which process owns a port and who started it

Usage:
  port-origin <port> [options]
  port-origin --pid <pid> [options]

Options:
  --format <pretty|json|markdown>  Output format (default: pretty)
  --output <file>                  Write the report to a file
  --fail-if-free                   Exit 1 when no owner is found
  --help                           Show help
  --version                        Show version
`;

export function parseArgs(args) {
  const options = { port: null, pid: null, format: 'pretty', output: null, failIfFree: false, help: false, version: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-v') options.version = true;
    else if (arg === '--fail-if-free') options.failIfFree = true;
    else if (arg === '--pid') options.pid = args[++index];
    else if (arg === '--format') options.format = args[++index];
    else if (arg === '--output') {
      if (!args[index + 1] || args[index + 1].startsWith('-')) throw new TypeError('--output requires a file');
      options.output = args[++index];
    } else if (arg.startsWith('-')) throw new TypeError(`Unknown option: ${arg}`);
    else if (options.port != null) throw new TypeError('Only one port may be supplied');
    else options.port = arg;
  }
  if (!['pretty', 'json', 'markdown'].includes(options.format)) throw new TypeError('Invalid output format');
  if (options.port != null && options.pid != null) throw new TypeError('Choose either a port or --pid');
  return options;
}

export async function run(args, io = {}) {
  const stdout = io.stdout || ((value) => process.stdout.write(value));
  const stderr = io.stderr || ((value) => process.stderr.write(value));
  let options;
  try { options = parseArgs(args); } catch (error) { stderr(`${error.message}\n${HELP}`); return 2; }
  if (options.help) { stdout(HELP); return 0; }
  if (options.version) { stdout('0.1.0\n'); return 0; }
  if (options.port == null && options.pid == null) { stderr(HELP); return 2; }
  try {
    const inspectOptions = io.snapshot ? { snapshot: io.snapshot } : {};
    const report = options.pid != null ? await inspectPid(options.pid, inspectOptions) : await inspectPort(options.port, inspectOptions);
    const output = renderReport(report, options.format);
    if (options.output) await writeFile(resolve(io.cwd || process.cwd(), options.output), output, 'utf8');
    else stdout(output);
    return options.failIfFree && !report.owners.length ? 1 : 0;
  } catch (error) {
    stderr(`port-origin: ${error.message}\n`);
    return 2;
  }
}
