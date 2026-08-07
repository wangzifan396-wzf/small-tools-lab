import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseLsofFields, parsePosixProcesses, parseSs, parseWindowsNetstat, parseWindowsProcesses } from './parse.js';

const execFileAsync = promisify(execFile);

export function redactCommand(value) {
  return String(value || '')
    .replace(/((?:--?|\/)(?:token|password|passwd|secret|api[_-]?key|authorization)(?:=|\s+))([^\s]+)/giu, '$1***REDACTED***')
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/giu, '$1***:***@')
    .replace(/([?&](?:token|key|secret|password)=)[^&\s]+/giu, '$1***REDACTED***')
    .slice(0, 500);
}

export function buildAncestry(pid, processes, maxDepth = 32) {
  const byPid = new Map(processes.map((item) => [item.pid, item]));
  const chain = [];
  const seen = new Set();
  let current = byPid.get(pid);
  while (current && chain.length < maxDepth && !seen.has(current.pid)) {
    seen.add(current.pid);
    chain.push({ ...current, command: redactCommand(current.command) });
    if (!current.ppid || current.ppid === current.pid) break;
    current = byPid.get(current.ppid);
  }
  return chain;
}

function hints(process) {
  const command = `${process?.name || ''} ${process?.command || ''}`.toLowerCase();
  return [
    /docker-proxy|containerd|podman/u.test(command) ? 'container-runtime' : null,
    /node|npm|pnpm|yarn|bun/u.test(command) ? 'javascript-runtime' : null,
    /python|uvicorn|gunicorn/u.test(command) ? 'python-runtime' : null,
    /java|gradle|mvn/u.test(command) ? 'jvm-runtime' : null,
  ].filter(Boolean);
}

export function inspectSnapshot({ targetType = 'port', target, connections = [], processes = [], platform = 'unknown' }) {
  const matches = targetType === 'port'
    ? connections.filter((item) => item.local?.port === target)
    : [{ protocol: null, local: null, remote: null, state: null, pid: target }];
  const byPid = new Map(processes.map((item) => [item.pid, item]));
  const owners = [];
  const seen = new Set();
  for (const connection of matches) {
    if (seen.has(connection.pid)) continue;
    seen.add(connection.pid);
    const process = byPid.get(connection.pid) || { pid: connection.pid, ppid: null, name: connection.command || null, command: connection.command || '' };
    owners.push({ connection, process: { ...process, command: redactCommand(process.command) }, ancestry: buildAncestry(connection.pid, processes), hints: hints(process) });
  }
  return { schemaVersion: 1, platform, targetType, target, status: owners.length ? 'found' : targetType === 'port' ? 'free' : 'missing', owners };
}

async function defaultRunner(command, args) {
  const result = await execFileAsync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 10_000, maxBuffer: 16 * 1024 * 1024 });
  return result.stdout;
}

export async function collectSnapshot(platform = process.platform, runner = defaultRunner) {
  if (platform === 'win32') {
    const processScript = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Compress';
    const [netstat, processJson] = await Promise.all([
      runner('netstat.exe', ['-ano', '-p', 'tcp']),
      runner('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', processScript]),
    ]);
    return { platform, connections: parseWindowsNetstat(netstat), processes: parseWindowsProcesses(processJson) };
  }

  const processText = await runner('ps', ['-axo', 'pid=,ppid=,user=,etime=,command=']);
  let connections;
  try {
    connections = parseLsofFields(await runner('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn']));
  } catch {
    connections = parseSs(await runner('ss', ['-ltnpH']));
  }
  return { platform, connections, processes: parsePosixProcesses(processText) };
}

function positiveInteger(value, label, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) throw new RangeError(`${label} must be an integer between 1 and ${max}`);
  return number;
}

export async function inspectPort(port, options = {}) {
  const target = positiveInteger(port, 'Port', 65535);
  const snapshot = options.snapshot || await collectSnapshot(options.platform, options.runner);
  return inspectSnapshot({ ...snapshot, targetType: 'port', target });
}

export async function inspectPid(pid, options = {}) {
  const target = positiveInteger(pid, 'PID');
  const snapshot = options.snapshot || await collectSnapshot(options.platform, options.runner);
  return inspectSnapshot({ ...snapshot, targetType: 'pid', target });
}
