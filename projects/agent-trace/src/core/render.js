function number(value) { return new Intl.NumberFormat('en-US').format(value); }
function duration(ms) {
  if (!ms) return '0s';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
function escapeMd(value) { return String(value).replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderPretty(report) {
  const lines = [
    'Agent Trace',
    '='.repeat(72),
    `${report.sources} source(s)  ${report.records} records  ${report.turns} user turns  ${duration(report.durationMs)}`,
    `Tokens ${number(report.tokens.total)}  input ${number(report.tokens.input)}  output ${number(report.tokens.output)}  cache read ${number(report.tokens.cacheRead)}`,
    `Malformed ${report.malformed.length}  repeated-read waste ${report.repeatedReadWaste}  error loops ${report.errorLoops.length}`,
  ];
  if (report.tools.length) {
    lines.push('', 'TOOL                         CALLS  ERRORS  AVG-LATENCY  P95');
    for (const tool of report.tools) lines.push(`${tool.name.slice(0, 28).padEnd(28)} ${String(tool.calls).padStart(5)} ${String(tool.errors).padStart(7)} ${String(tool.averageLatencyMs == null ? '-' : `${tool.averageLatencyMs}ms`).padStart(12)} ${tool.p95LatencyMs == null ? '-' : `${tool.p95LatencyMs}ms`}`);
  }
  if (report.repeatedReads.length) {
    lines.push('', 'Repeated reads');
    for (const item of report.repeatedReads.slice(0, 10)) lines.push(`- ${item.count}x ${item.tool}: ${item.target}`);
  }
  if (report.errorLoops.length) {
    lines.push('', 'Repeated failures');
    for (const item of report.errorLoops.slice(0, 10)) lines.push(`- ${item.count}x ${item.tool}: ${item.target}`);
  }
  return `${lines.join('\n')}\n`;
}

export function renderMarkdown(report) {
  const lines = [
    '# Agent Trace', '',
    `- Sources: **${report.sources}**`,
    `- Records: **${report.records}**`,
    `- User turns: **${report.turns}**`,
    `- Duration: **${duration(report.durationMs)}**`,
    `- Tokens: **${number(report.tokens.total)}**`,
    `- Malformed records: **${report.malformed.length}**`, '',
    '## Tools', '',
    '| Tool | Calls | Errors | Average latency | P95 latency |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  for (const tool of report.tools) lines.push(`| ${escapeMd(tool.name)} | ${tool.calls} | ${tool.errors} | ${tool.averageLatencyMs ?? '-'} | ${tool.p95LatencyMs ?? '-'} |`);
  if (report.repeatedReads.length) {
    lines.push('', '## Repeated reads', '');
    for (const item of report.repeatedReads) lines.push(`- ${item.count}× \`${escapeMd(item.tool)}\`: \`${escapeMd(item.target)}\``);
  }
  return `${lines.join('\n')}\n`;
}

export function renderReport(report, format = 'pretty') {
  if (format === 'pretty') return renderPretty(report);
  if (format === 'markdown') return renderMarkdown(report);
  if (format === 'json') return `${JSON.stringify(report, null, 2)}\n`;
  throw new RangeError(`Unknown format: ${format}`);
}
