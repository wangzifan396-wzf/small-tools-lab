function escapeMd(value) { return String(value).replaceAll('|', '\\|').replaceAll('\n', ' '); }

export function renderPretty(report) {
  const lines = ['Port Origin', '='.repeat(72), `${report.platform}  ${report.targetType} ${report.target}  ${report.status}`];
  for (const [index, owner] of report.owners.entries()) {
    lines.push('', `Owner ${index + 1}: PID ${owner.process.pid} ${owner.process.name || '(unknown)'}`);
    if (owner.connection.local) lines.push(`  Listen: ${owner.connection.local.address}:${owner.connection.local.port} (${owner.connection.state})`);
    if (owner.process.command) lines.push(`  Command: ${owner.process.command}`);
    if (owner.hints.length) lines.push(`  Hints: ${owner.hints.join(', ')}`);
    if (owner.ancestry.length) {
      lines.push('  Ancestry:');
      for (const [depth, process] of owner.ancestry.entries()) lines.push(`    ${'  '.repeat(depth)}↳ ${process.pid} ${process.name || ''} ${process.command || ''}`.trimEnd());
    }
  }
  if (!report.owners.length) lines.push('', report.targetType === 'port' ? 'No listening process owns this port.' : 'PID was not present in the process snapshot.');
  return `${lines.join('\n')}\n`;
}

export function renderMarkdown(report) {
  const lines = ['# Port Origin', '', `**${escapeMd(report.platform)} · ${report.targetType} ${report.target} · ${report.status}**`, ''];
  for (const owner of report.owners) {
    lines.push(`## PID ${owner.process.pid} ${escapeMd(owner.process.name || '')}`, '', `- Command: \`${escapeMd(owner.process.command || '')}\``);
    if (owner.connection.local) lines.push(`- Listen: \`${escapeMd(owner.connection.local.address)}:${owner.connection.local.port}\``);
    lines.push('- Ancestry:');
    for (const process of owner.ancestry) lines.push(`  - ${process.pid} · ${escapeMd(process.name || '')}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

export function renderReport(report, format = 'pretty') {
  if (format === 'pretty') return renderPretty(report);
  if (format === 'markdown') return renderMarkdown(report);
  if (format === 'json') return `${JSON.stringify(report, null, 2)}\n`;
  throw new RangeError(`Unknown format: ${format}`);
}
