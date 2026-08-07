import { PROBE_RULES } from './analyze.js';

function escapeMd(value) { return String(value).replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderPretty(report) {
  const lines = [
    'MCP Probe',
    '='.repeat(74),
    `${report.server.name} ${report.server.version}  protocol ${report.protocolVersion || 'unknown'}  Grade ${report.grade} ${report.score}/100`,
    `Tools ${report.listings.tools.count}  Resources ${report.listings.resources.count} (+${report.listings.resources.templates} templates)  Prompts ${report.listings.prompts.count}`,
    `Initialize ${report.latencies.initialize}ms  High ${report.summary.high}  Medium ${report.summary.medium}  Low ${report.summary.low}`,
  ];
  if (report.findings.length) {
    lines.push('', 'Findings');
    for (const item of report.findings) lines.push(`[${item.severity.toUpperCase()}] ${item.rule} ${item.kind} ${item.name}: ${item.title}`);
  } else lines.push('', 'No capability metadata findings.');
  lines.push('', 'Probe boundary: initialize + list methods only; no tool, prompt, or resource was invoked.');
  return `${lines.join('\n')}\n`;
}

export function renderMarkdown(report) {
  const lines = [
    '# MCP Probe', '',
    `**${escapeMd(report.server.name)} ${escapeMd(report.server.version)} · protocol ${escapeMd(report.protocolVersion || 'unknown')} · Grade ${report.grade} ${report.score}/100**`, '',
    `Tools **${report.listings.tools.count}** · Resources **${report.listings.resources.count}** · Templates **${report.listings.resources.templates}** · Prompts **${report.listings.prompts.count}**`, '',
    '| Severity | Rule | Kind | Capability | Finding |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const item of report.findings) lines.push(`| ${item.severity} | ${item.rule} | ${item.kind} | ${escapeMd(item.name)} | ${escapeMd(item.title)} |`);
  if (!report.findings.length) lines.push('| — | — | — | — | No findings |');
  lines.push('', '> Read-only probe: initialize and list methods only.');
  return `${lines.join('\n')}\n`;
}

export function renderSarif(report) {
  const rules = Object.entries(PROBE_RULES).map(([id, item]) => ({ id, shortDescription: { text: item.title }, defaultConfiguration: { level: item.severity === 'high' ? 'error' : item.severity === 'medium' ? 'warning' : 'note' } }));
  const results = report.findings.map((item) => ({ ruleId: item.rule, level: item.severity === 'high' ? 'error' : item.severity === 'medium' ? 'warning' : 'note', message: { text: `${item.kind} ${item.name}: ${item.title}` } }));
  return `${JSON.stringify({ version: '2.1.0', $schema: 'https://json.schemastore.org/sarif-2.1.0.json', runs: [{ tool: { driver: { name: 'MCP Probe', version: '0.1.0', rules } }, results }] }, null, 2)}\n`;
}

export function renderReport(report, format = 'pretty') {
  if (format === 'pretty') return renderPretty(report);
  if (format === 'markdown') return renderMarkdown(report);
  if (format === 'sarif') return renderSarif(report);
  if (format === 'json') return `${JSON.stringify(report, null, 2)}\n`;
  throw new RangeError(`Unknown format: ${format}`);
}
