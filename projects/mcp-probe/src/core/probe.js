import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import { analyzeManifest } from './analyze.js';
import { decodeJsonLines, encodeMessage, LATEST_PROTOCOL_VERSION, RpcError } from './protocol.js';

function cleanEnvironment(env) {
  const names = process.platform === 'win32'
    ? ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'ComSpec', 'TEMP', 'TMP', 'USERPROFILE']
    : ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL'];
  return Object.fromEntries(names.filter((name) => env[name] != null).map((name) => [name, env[name]]));
}

export async function probeStdio(command, args = [], options = {}) {
  if (typeof command !== 'string' || !command.trim()) throw new TypeError('MCP command is required');
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) throw new TypeError('MCP arguments must be strings');
  const timeoutMs = Number(options.timeoutMs ?? 5000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) throw new RangeError('timeoutMs must be an integer from 100 to 120000');
  const protocolVersion = options.protocolVersion || LATEST_PROTOCOL_VERSION;
  const env = options.cleanEnv ? cleanEnvironment(options.env || process.env) : (options.env || process.env);
  const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env });
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });

  let nextId = 1;
  let buffer = '';
  let stderrBytes = 0;
  const pending = new Map();
  const protocolErrors = [];
  const latencies = {};
  const rejectAll = (error) => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
  };

  child.stderr.on('data', (chunk) => { stderrBytes += chunk.length; });
  child.on('error', rejectAll);
  child.on('exit', (code, signal) => {
    if (pending.size) rejectAll(new Error(`MCP server exited before responding (${code ?? signal})`));
  });
  child.stdout.on('data', (chunk) => {
    let decoded;
    try { decoded = decodeJsonLines(buffer, chunk, { maxBytes: options.maxBytes }); }
    catch (error) { rejectAll(error); return; }
    buffer = decoded.buffer;
    protocolErrors.push(...decoded.errors);
    for (const message of decoded.messages) {
      if (message.id != null && pending.has(message.id)) {
        const item = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(item.timer);
        if (message.error) item.reject(new RpcError(message.error.code, message.error.message));
        else item.resolve({ result: message.result, latencyMs: Date.now() - item.started });
      } else if (message.id != null && message.method) {
        child.stdin.write(encodeMessage({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Client method not supported by mcp-probe' } }));
      }
    }
  });

  const send = (message) => child.stdin.write(encodeMessage(message));
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out after ${timeoutMs}ms`)); }, timeoutMs);
    pending.set(id, { resolve, reject, timer, started: Date.now() });
    send({ jsonrpc: '2.0', id, method, params });
  });

  async function list(method, key, supported) {
    if (!supported) return { supported: false, items: [], pages: 0, latencyMs: 0 };
    const items = [];
    let cursor;
    let pages = 0;
    let latencyMs = 0;
    try {
      do {
        const response = await request(method, cursor ? { cursor } : {});
        latencyMs += response.latencyMs;
        pages += 1;
        items.push(...(Array.isArray(response.result?.[key]) ? response.result[key] : []));
        cursor = response.result?.nextCursor;
      } while (cursor && pages < 10);
      return { supported: true, items, pages, latencyMs };
    } catch (error) {
      if (error instanceof RpcError && error.code === -32601) return { supported: false, items: [], pages, latencyMs };
      throw error;
    }
  }

  try {
    const initialized = await request('initialize', { protocolVersion, capabilities: {}, clientInfo: { name: 'mcp-probe', version: '0.1.0' } });
    latencies.initialize = initialized.latencyMs;
    send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    const capabilities = initialized.result?.capabilities || {};
    const [toolList, resourceList, templateList, promptList] = await Promise.all([
      list('tools/list', 'tools', Boolean(capabilities.tools)),
      list('resources/list', 'resources', Boolean(capabilities.resources)),
      list('resources/templates/list', 'resourceTemplates', Boolean(capabilities.resources)),
      list('prompts/list', 'prompts', Boolean(capabilities.prompts)),
    ]);
    latencies.tools = toolList.latencyMs;
    latencies.resources = resourceList.latencyMs + templateList.latencyMs;
    latencies.prompts = promptList.latencyMs;
    const analysis = analyzeManifest({ tools: toolList.items, resources: resourceList.items, prompts: promptList.items });
    return {
      schemaVersion: 1,
      transport: 'stdio',
      command: basename(command),
      requestedProtocolVersion: protocolVersion,
      protocolVersion: initialized.result?.protocolVersion || null,
      server: {
        name: String(initialized.result?.serverInfo?.name || '(unknown)').slice(0, 200),
        version: String(initialized.result?.serverInfo?.version || '').slice(0, 100),
      },
      capabilities: Object.keys(capabilities).sort(),
      listings: {
        tools: { supported: toolList.supported, count: toolList.items.length, pages: toolList.pages },
        resources: { supported: resourceList.supported, count: resourceList.items.length, templates: templateList.items.length, pages: resourceList.pages + templateList.pages },
        prompts: { supported: promptList.supported, count: promptList.items.length, pages: promptList.pages },
      },
      latencies,
      stderrBytes,
      protocolErrors,
      ...analysis,
    };
  } finally {
    rejectAll(new Error('MCP probe closed'));
    child.stdin.end();
    if (!child.killed) child.kill();
  }
}
