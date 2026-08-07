function endpoint(value) {
  const match = String(value || '').trim().match(/^(.*):(\d+)$/u);
  if (!match) return null;
  return { address: match[1].replace(/^\[|\]$/gu, ''), port: Number(match[2]) };
}

export function parseWindowsNetstat(text) {
  if (typeof text !== 'string') throw new TypeError('netstat output must be a string');
  const results = [];
  for (const line of text.split(/\r\n|\r|\n/u)) {
    const parts = line.trim().split(/\s+/u);
    if (parts.length < 5 || parts[0].toUpperCase() !== 'TCP') continue;
    const local = endpoint(parts[1]);
    const remote = endpoint(parts[2]);
    const pid = Number(parts.at(-1));
    if (!local || !Number.isInteger(pid)) continue;
    results.push({ protocol: 'tcp', local, remote, state: parts[3].toLowerCase(), pid });
  }
  return results;
}

export function parseLsofFields(text) {
  if (typeof text !== 'string') throw new TypeError('lsof output must be a string');
  const results = [];
  let current = null;
  for (const raw of text.split(/\r\n|\r|\n/u)) {
    if (!raw) continue;
    const field = raw[0];
    const value = raw.slice(1);
    if (field === 'p') current = { pid: Number(value), command: null };
    else if (current && field === 'c') current.command = value;
    else if (current && field === 'n') {
      const cleaned = value.replace(/\s+\(LISTEN\)$/iu, '');
      const local = endpoint(cleaned.includes('->') ? cleaned.split('->')[0] : cleaned);
      if (local) results.push({ protocol: 'tcp', local, remote: null, state: 'listen', pid: current.pid, command: current.command });
    }
  }
  return results;
}

export function parseSs(text) {
  if (typeof text !== 'string') throw new TypeError('ss output must be a string');
  const results = [];
  for (const line of text.split(/\r\n|\r|\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/u);
    if (parts.length < 4) continue;
    const local = endpoint(parts[3]);
    const pidMatch = trimmed.match(/pid=(\d+)/u);
    if (!local || !pidMatch) continue;
    const command = trimmed.match(/users:\(\(\"([^\"]+)/)?.[1] || null;
    results.push({ protocol: 'tcp', local, remote: endpoint(parts[4]), state: parts[0].toLowerCase(), pid: Number(pidMatch[1]), command });
  }
  return results;
}

export function parseWindowsProcesses(text) {
  if (typeof text !== 'string') throw new TypeError('process output must be a string');
  const parsed = JSON.parse(text || '[]');
  return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({
    pid: Number(item.ProcessId),
    ppid: Number(item.ParentProcessId),
    user: null,
    elapsed: null,
    name: item.Name || null,
    executable: item.ExecutablePath || null,
    command: item.CommandLine || item.ExecutablePath || item.Name || '',
  })).filter((item) => Number.isInteger(item.pid));
}

export function parsePosixProcesses(text) {
  if (typeof text !== 'string') throw new TypeError('process output must be a string');
  const results = [];
  for (const line of text.split(/\r\n|\r|\n/u)) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/u);
    if (!match) continue;
    const command = match[5].trim();
    const first = command.match(/^(?:["']([^"']+)["']|(\S+))/u);
    const executable = first?.[1] || first?.[2] || '';
    results.push({ pid: Number(match[1]), ppid: Number(match[2]), user: match[3], elapsed: match[4], name: executable.split(/[\\/]/u).at(-1), executable, command });
  }
  return results;
}

export function parseEndpoint(value) { return endpoint(value); }
