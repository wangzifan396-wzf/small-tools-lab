import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { probeStdio } from './core/probe.js';
import { renderReport } from './core/render.js';

export const HELP = `MCP Probe - read-only stdio capability inspector

Usage: mcp-probe [options] -- <server-command> [server-args...]

Options:
  --format <pretty|json|markdown|sarif>  Output format (default: pretty)
  --output <file>                        Write the report to a file
  --timeout <milliseconds>               Per-request timeout (default: 5000)
  --protocol <version>                   Requested MCP protocol version
  --clean-env                            Pass only basic OS environment variables
  --fail-on <high|medium|low|none>       Failure threshold (default: high)
  --help                                 Show help
  --version                              Show version

The -- separator is required so probe options cannot be confused with server arguments.
`;
const RANK = { high: 3, medium: 2, low: 1 };

export function parseArgs(args) {
  const separator = args.indexOf('--');
  const probeArgs = separator < 0 ? args : args.slice(0, separator);
  const command = separator < 0 ? [] : args.slice(separator + 1);
  const options = { command, format: 'pretty', output: null, timeoutMs: 5000, protocolVersion: null, cleanEnv: false, failOn: 'high', help: false, version: false };
  for (let index = 0; index < probeArgs.length; index += 1) {
    const arg = probeArgs[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-v') options.version = true;
    else if (arg === '--clean-env') options.cleanEnv = true;
    else if (arg === '--format') options.format = probeArgs[++index];
    else if (arg === '--timeout') options.timeoutMs = Number(probeArgs[++index]);
    else if (arg === '--protocol') options.protocolVersion = probeArgs[++index];
    else if (arg === '--fail-on') options.failOn = probeArgs[++index];
    else if (arg === '--output') {
      if (!probeArgs[index + 1] || probeArgs[index + 1].startsWith('-')) throw new TypeError('--output requires a file');
      options.output = probeArgs[++index];
    } else throw new TypeError(`Unknown option before --: ${arg}`);
  }
  if (!['pretty', 'json', 'markdown', 'sarif'].includes(options.format)) throw new TypeError('Invalid output format');
  if (!['high', 'medium', 'low', 'none'].includes(options.failOn)) throw new TypeError('fail-on must be high, medium, low, or none');
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 120_000) throw new TypeError('timeout must be an integer from 100 to 120000');
  return options;
}

export async function run(args, io = {}) {
  const stdout = io.stdout || ((value) => process.stdout.write(value));
  const stderr = io.stderr || ((value) => process.stderr.write(value));
  let options;
  try { options = parseArgs(args); } catch (error) { stderr(`${error.message}\n${HELP}`); return 2; }
  if (options.help) { stdout(HELP); return 0; }
  if (options.version) { stdout('0.1.0\n'); return 0; }
  if (!options.command.length) { stderr(HELP); return 2; }
  try {
    const report = await probeStdio(options.command[0], options.command.slice(1), { timeoutMs: options.timeoutMs, protocolVersion: options.protocolVersion || undefined, cleanEnv: options.cleanEnv, env: io.env });
    const output = renderReport(report, options.format);
    if (options.output) await writeFile(resolve(io.cwd || process.cwd(), options.output), output, 'utf8');
    else stdout(output);
    if (options.failOn === 'none') return 0;
    return report.findings.some((item) => RANK[item.severity] >= RANK[options.failOn]) ? 1 : 0;
  } catch (error) {
    stderr(`mcp-probe: ${error.message}\n`);
    return 2;
  }
}
