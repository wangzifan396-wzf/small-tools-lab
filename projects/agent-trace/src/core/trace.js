const READ_TOOL = /(?:^|[_-])(read|open|view|cat)(?:$|[_-])/iu;
const ERROR_TEXT = /(?:^|\b)(error|failed|failure|exception|denied)(?:\b|$)/iu;

function finiteNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (value !== '' && Number.isFinite(number)) return number;
  }
  return 0;
}

function timestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}

function targetFrom(input) {
  let value = input;
  if (typeof value === 'string' && /^[\s]*[\[{]/u.test(value)) {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== 'object') return null;
  for (const key of ['file_path', 'path', 'notebook_path', 'uri', 'url']) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      return redactUrl(value[key].trim()).slice(0, 240);
    }
  }
  return null;
}

function tokenUsage(record, payload) {
  const cumulative = payload?.info?.total_token_usage;
  const usage = record.message?.usage ?? record.usage ?? payload?.usage ?? cumulative;
  if (!usage || typeof usage !== 'object') return null;
  return {
    mode: cumulative ? 'cumulative' : 'delta',
    input: finiteNumber(usage.input_tokens, usage.inputTokens, usage.prompt_tokens, usage.promptTokens),
    output: finiteNumber(usage.output_tokens, usage.outputTokens, usage.completion_tokens, usage.completionTokens),
    cacheRead: finiteNumber(usage.cache_read_input_tokens, usage.cached_input_tokens, usage.cacheReadTokens),
    cacheWrite: finiteNumber(usage.cache_creation_input_tokens, usage.cacheWriteTokens),
  };
}

function isError(value) {
  return value?.is_error === true
    || value?.error === true
    || ['error', 'failed', 'failure'].includes(String(value?.status || '').toLowerCase());
}

export function parseJsonl(text, source = '<input>') {
  if (typeof text !== 'string') throw new TypeError('JSONL input must be a string');
  const records = [];
  const errors = [];
  for (const [index, line] of text.split(/\r\n|\r|\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('record must be an object');
      records.push({ record, line: index + 1, source });
    } catch (error) {
      errors.push({ source, line: index + 1, message: error instanceof SyntaxError ? 'Invalid JSON' : error.message });
    }
  }
  return { records, errors };
}

export function normalizeRecord(entry, index = 0) {
  const wrapped = entry?.record ? entry : { record: entry, source: '<input>', line: index + 1 };
  const record = wrapped.record || {};
  const payload = record.payload && typeof record.payload === 'object' ? record.payload : {};
  const type = String(payload.type ?? record.type ?? 'event');
  const timestamp = timestampMs(record.timestamp ?? record.created_at ?? record.time ?? payload.timestamp);
  const role = record.message?.role ?? record.role ?? payload.role ?? null;
  const usage = tokenUsage(record, payload);
  const base = { source: wrapped.source, line: wrapped.line, index, timestamp };
  const events = [];

  if (usage || role || !['function_call', 'function_call_output', 'tool_call', 'tool_result', 'tool_use'].includes(type)) {
    events.push({ ...base, kind: role ? 'message' : 'event', type, role, usage, error: isError(record) || isError(payload) });
  }

  const addTool = (phase, value) => {
    const output = value.output ?? value.content ?? value.result;
    events.push({
      ...base,
      kind: 'tool',
      type,
      phase,
      toolName: value.name ?? value.tool_name ?? record.tool_name ?? null,
      callId: value.id ?? value.call_id ?? value.tool_use_id ?? record.call_id ?? null,
      target: targetFrom(value.input ?? value.arguments ?? record.input ?? record.arguments),
      error: isError(value) || isError(record) || (phase === 'result' && typeof output === 'string' && ERROR_TEXT.test(output.slice(0, 200))),
    });
  };

  if (['function_call', 'tool_call', 'tool_use'].includes(type)) addTool('call', payload.type ? payload : record);
  if (['function_call_output', 'tool_result'].includes(type)) addTool('result', payload.type ? payload : record);

  const content = record.message?.content ?? record.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block?.type === 'tool_use') addTool('call', block);
      if (block?.type === 'tool_result') addTool('result', block);
    }
  }
  return events;
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

export function analyzeRecords(records, options = {}) {
  const events = records.flatMap((entry, index) => normalizeRecord(entry, index));
  const delta = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const cumulative = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const event of events) {
    if (!event.usage) continue;
    const bucket = event.usage.mode === 'cumulative' ? cumulative : delta;
    for (const key of Object.keys(bucket)) {
      if (event.usage.mode === 'cumulative') bucket[key] = Math.max(bucket[key], event.usage[key]);
      else bucket[key] += event.usage[key];
    }
  }
  const tokens = Object.fromEntries(Object.keys(delta).map((key) => [key, Math.max(delta[key], cumulative[key])]));
  tokens.total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;

  const toolMap = new Map();
  const pending = new Map();
  const readMap = new Map();
  const failureMap = new Map();
  const toolStat = (name) => {
    const key = name || 'unknown';
    if (!toolMap.has(key)) toolMap.set(key, { name: key, calls: 0, results: 0, errors: 0, latencies: [] });
    return toolMap.get(key);
  };

  for (const event of events.filter((item) => item.kind === 'tool')) {
    if (event.phase === 'call') {
      const stat = toolStat(event.toolName);
      stat.calls += 1;
      if (event.error) stat.errors += 1;
      if (event.callId) pending.set(event.callId, event);
      if (event.target && READ_TOOL.test(event.toolName || '')) {
        const key = `${event.toolName || 'unknown'}\u0000${event.target}`;
        readMap.set(key, { tool: event.toolName || 'unknown', target: event.target, count: (readMap.get(key)?.count || 0) + 1 });
      }
    } else {
      const call = event.callId ? pending.get(event.callId) : null;
      const name = event.toolName || call?.toolName || 'unknown';
      const stat = toolStat(name);
      stat.results += 1;
      if (event.error) {
        stat.errors += 1;
        const target = event.target || call?.target || '(no target)';
        const key = `${name}\u0000${target}`;
        failureMap.set(key, { tool: name, target, count: (failureMap.get(key)?.count || 0) + 1 });
      }
      if (call?.timestamp != null && event.timestamp != null && event.timestamp >= call.timestamp) {
        stat.latencies.push(event.timestamp - call.timestamp);
      }
    }
  }

  const tools = [...toolMap.values()].map((stat) => ({
    name: stat.name,
    calls: stat.calls,
    results: stat.results,
    errors: stat.errors,
    averageLatencyMs: stat.latencies.length ? Math.round(stat.latencies.reduce((sum, value) => sum + value, 0) / stat.latencies.length) : null,
    p95LatencyMs: percentile(stat.latencies, 0.95),
  })).sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));
  const timestamps = events.map((event) => event.timestamp).filter((value) => value != null);
  const repeatedReads = [...readMap.values()].filter((item) => item.count > 1).sort((a, b) => b.count - a.count);
  const errorLoops = [...failureMap.values()].filter((item) => item.count > 1).sort((a, b) => b.count - a.count);

  return {
    schemaVersion: 1,
    sources: new Set(records.map((entry) => entry.source || '<input>')).size,
    records: records.length,
    events: events.length,
    messages: events.filter((event) => event.kind === 'message').length,
    turns: events.filter((event) => event.kind === 'message' && event.role === 'user').length,
    durationMs: timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0,
    tokens,
    tools,
    repeatedReads,
    repeatedReadWaste: repeatedReads.reduce((sum, item) => sum + item.count - 1, 0),
    errorLoops,
    malformed: options.errors || [],
  };
}

export function analyzeJsonl(text, source = '<input>') {
  const parsed = parseJsonl(text, source);
  return analyzeRecords(parsed.records, { errors: parsed.errors });
}
