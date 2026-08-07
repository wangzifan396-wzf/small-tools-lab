import { RULES } from './scan.js';

const RANK = { high: 3, medium: 2, low: 1 };
function escapeMd(value) { return String(value).replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderPretty(report) {
  const lines = [
    'Skill Sentry',
    '='.repeat(76),
    `${report.skills} skill(s)  ${report.files} files  Grade ${report.grade}  Score ${report.score}/100`,
    `High ${report.summary.high}  Medium ${report.summary.medium}  Low ${report.summary.low}`,
  ];
  if (!report.findings.length) lines.push('', 'No findings. Every scanned skill passed the enabled rules.');
  else {
    lines.push('');
    for (const item of [...report.findings].sort((a, b) => RANK[b.severity] - RANK[a.severity] || a.rule.localeCompare(b.rule))) {
      lines.push(`[${item.severity.toUpperCase()}] ${item.rule} ${item.title}`);
      lines.push(`  ${item.skill}: ${item.file}:${item.line}${item.evidence ? `  ${item.evidence}` : ''}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function renderMarkdown(report) {
  const lines = [
    '# Skill Sentry', '',
    `**Grade ${report.grade} · ${report.score}/100** — ${report.skills} skills, ${report.files} files`, '',
    `High **${report.summary.high}** · Medium **${report.summary.medium}** · Low **${report.summary.low}**`, '',
    '| Severity | Rule | Skill | Location | Finding |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const item of report.findings) lines.push(`| ${item.severity} | ${item.rule} | ${escapeMd(item.skill)} | ${escapeMd(item.file)}:${item.line} | ${escapeMd(item.title)} |`);
  if (!report.findings.length) lines.push('| — | — | — | — | No findings |');
  return `${lines.join('\n')}\n`;
}

export function renderSarif(report) {
  const rules = Object.entries(RULES).map(([id, meta]) => ({ id, shortDescription: { text: meta.title }, help: { text: meta.remediation }, defaultConfiguration: { level: meta.severity === 'high' ? 'error' : meta.severity === 'medium' ? 'warning' : 'note' } }));
  const results = report.findings.map((item) => ({
    ruleId: item.rule,
    level: item.severity === 'high' ? 'error' : item.severity === 'medium' ? 'warning' : 'note',
    message: { text: `${item.title}${item.detail ? `: ${item.detail}` : ''}` },
    locations: [{ physicalLocation: { artifactLocation: { uri: item.file }, region: { startLine: Math.max(1, item.line) } } }],
  }));
  return `${JSON.stringify({ version: '2.1.0', $schema: 'https://json.schemastore.org/sarif-2.1.0.json', runs: [{ tool: { driver: { name: 'Skill Sentry', version: '0.1.0', rules } }, results }] }, null, 2)}\n`;
}

export function renderReport(report, format = 'pretty') {
  if (format === 'pretty') return renderPretty(report);
  if (format === 'markdown') return renderMarkdown(report);
  if (format === 'json') return `${JSON.stringify(report, null, 2)}\n`;
  if (format === 'sarif') return renderSarif(report);
  throw new RangeError(`Unknown format: ${format}`);
}
