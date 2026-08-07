import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { analyzeJsonl, analyzeRecords, normalizeRecord, parseJsonl } from '../src/core/trace.js';
import { renderReport } from '../src/core/render.js';
import { findTraceFiles, parseArgs, run } from '../src/cli.js';

test('parseJsonl keeps good records and reports malformed lines', () => {
  const parsed = parseJsonl('{"type":"user"}\nnot-json\n\n42', 'session.jsonl');
  assert.equal(parsed.records.length, 1);
  assert.deepEqual(parsed.errors.map((error) => error.line), [2, 4]);
  assert.match(parsed.errors[1].message, /object/);
});

test('normalizeRecord understands Claude tool-use blocks and token usage', () => {
  const events = normalizeRecord({
    type: 'assistant', timestamp: '2026-01-01T00:00:00Z',
    message: { role: 'assistant', usage: { input_tokens: 12, output_tokens: 4, cache_read_input_tokens: 3 }, content: [
      { type: 'tool_use', id: 'call-1', name: 'read_file', input: { file_path: 'src/app.js' } },
    ] },
  });
  assert.equal(events[0].usage.input, 12);
  assert.equal(events[1].phase, 'call');
  assert.equal(events[1].target, 'src/app.js');
});

test('normalizeRecord understands Codex function calls and outputs', () => {
  const call = normalizeRecord({ type: 'response_item', timestamp: 1000, payload: { type: 'function_call', name: 'shell_command', call_id: 'c1', arguments: '{"path":"README.md"}' } });
  const result = normalizeRecord({ type: 'response_item', timestamp: 1002, payload: { type: 'function_call_output', call_id: 'c1', output: 'done' } });
  assert.equal(call[0].toolName, 'shell_command');
  assert.equal(call[0].target, 'README.md');
  assert.equal(result[0].phase, 'result');
});

test('URL targets discard credentials, queries, and fragments', () => {
  const [event] = normalizeRecord({ type: 'tool_call', name: 'read_url', id: '1', input: { url: 'https://user:pass@example.com/a?token=secret#x' } });
  assert.equal(event.target, 'https://example.com/a');
});

test('analyzeRecords pairs calls with results and measures latency', () => {
  const records = parseJsonl([
    JSON.stringify({ type: 'tool_call', timestamp: 1000, name: 'read_file', id: '1', input: { path: 'a.js' } }),
    JSON.stringify({ type: 'tool_result', timestamp: 1001.25, tool_use_id: '1', content: 'ok' }),
  ].join('\n')).records;
  const report = analyzeRecords(records);
  assert.equal(report.tools[0].name, 'read_file');
  assert.equal(report.tools[0].averageLatencyMs, 1250);
  assert.equal(report.tools[0].results, 1);
});

test('analyzeRecords finds repeated reads and repeated failures', () => {
  const lines = [];
  for (let index = 0; index < 3; index += 1) {
    lines.push(JSON.stringify({ type: 'tool_call', timestamp: 1000 + index * 2, name: 'read_file', id: `c${index}`, input: { path: 'a.js' } }));
    lines.push(JSON.stringify({ type: 'tool_result', timestamp: 1001 + index * 2, tool_use_id: `c${index}`, is_error: true }));
  }
  const report = analyzeJsonl(lines.join('\n'));
  assert.equal(report.repeatedReads[0].count, 3);
  assert.equal(report.repeatedReadWaste, 2);
  assert.equal(report.errorLoops[0].count, 3);
  assert.equal(report.tools[0].errors, 3);
});

test('token aggregation handles delta events without double-counting cumulative snapshots', () => {
  const records = parseJsonl([
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', usage: { input_tokens: 10, output_tokens: 2 } } }),
    JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 8, output_tokens: 1 } } } }),
    JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 20, output_tokens: 5 } } } }),
  ].join('\n')).records;
  const report = analyzeRecords(records);
  assert.equal(report.tokens.input, 20);
  assert.equal(report.tokens.output, 5);
  assert.equal(report.tokens.total, 25);
});

test('analyzeJsonl counts user turns and carries parse errors', () => {
  const report = analyzeJsonl('{"type":"user","role":"user"}\ninvalid');
  assert.equal(report.turns, 1);
  assert.equal(report.malformed.length, 1);
});

test('renderReport emits pretty, Markdown, and JSON without prompt bodies', () => {
  const report = analyzeJsonl('{"type":"user","role":"user","content":"TOP SECRET PROMPT"}');
  assert.match(renderReport(report, 'pretty'), /Agent Trace/);
  assert.match(renderReport(report, 'markdown'), /# Agent Trace/);
  assert.equal(JSON.parse(renderReport(report, 'json')).turns, 1);
  assert.doesNotMatch(renderReport(report, 'json'), /TOP SECRET PROMPT/);
});

test('parseArgs validates formats and usage shape', () => {
  assert.deepEqual(parseArgs(['trace.jsonl', '--format', 'json', '--fail-on-errors']), {
    path: 'trace.jsonl', format: 'json', output: null, failOnErrors: true, help: false, version: false,
  });
  assert.throws(() => parseArgs(['--format', 'xml']), /Format/);
  assert.throws(() => parseArgs(['a', '--output']), /requires a file/);
  assert.throws(() => parseArgs(['a', 'b']), /one input/);
});

test('filesystem discovery and CLI run analyze a real JSONL fixture', async () => {
  const fixture = fileURLToPath(new URL('./fixtures/session.jsonl', import.meta.url));
  assert.deepEqual(await findTraceFiles(fixture), [fixture]);
  let output = '';
  const code = await run([fixture, '--format', 'json'], { stdout: (value) => { output += value; }, stderr: () => {} });
  assert.equal(code, 0);
  const report = JSON.parse(output);
  assert.equal(report.tools[0].averageLatencyMs, 250);
});
