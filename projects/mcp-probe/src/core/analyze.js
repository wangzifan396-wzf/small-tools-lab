const INJECTION = /(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|system|developer)\s+(?:instructions?|messages?)|do\s+not\s+(?:tell|show|reveal)\s+(?:the\s+)?user/iu;
const DESTRUCTIVE = /(?:^|[_-])(delete|remove|destroy|drop|truncate|write|execute|shell|command|deploy)(?:$|[_-])/iu;
const RULES = {
  MP001: { severity: 'high', title: 'Prompt-injection language in capability metadata' },
  MP002: { severity: 'medium', title: 'Potentially mutating tool lacks read-only annotation' },
  MP003: { severity: 'medium', title: 'Tool input schema is missing or invalid' },
  MP004: { severity: 'low', title: 'Capability description is missing' },
  MP005: { severity: 'medium', title: 'Duplicate capability name' },
  MP006: { severity: 'medium', title: 'Capability description is unusually large' },
};
export { RULES as PROBE_RULES };

function safeText(value, limit = 1000) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
    .replace(/\bgh[opsu]_[A-Za-z0-9]{8,}\b/gu, 'gh*_***REDACTED***')
    .slice(0, limit);
}

function finding(rule, kind, name, detail = '') {
  return { rule, severity: RULES[rule].severity, title: RULES[rule].title, kind, name: safeText(name, 200), detail: safeText(detail, 300) };
}

function normalizeItems(items, kind) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    name: safeText(item?.name ?? item?.uri ?? '(unnamed)', 200),
    description: safeText(item?.description, 1000),
    annotations: item?.annotations && typeof item.annotations === 'object' ? item.annotations : {},
    inputSchema: kind === 'tool' ? item?.inputSchema : undefined,
    uri: kind === 'resource' ? safeText(item?.uri, 500) : undefined,
  }));
}

export function analyzeManifest(input) {
  const tools = normalizeItems(input.tools, 'tool');
  const resources = normalizeItems(input.resources, 'resource');
  const prompts = normalizeItems(input.prompts, 'prompt');
  const findings = [];
  for (const [kind, items] of [['tool', tools], ['resource', resources], ['prompt', prompts]]) {
    const seen = new Set();
    for (const item of items) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) findings.push(finding('MP005', kind, item.name));
      seen.add(key);
      if (!item.description) findings.push(finding('MP004', kind, item.name));
      if (item.description.length >= 1000) findings.push(finding('MP006', kind, item.name, 'Description was truncated to 1,000 characters.'));
      if (INJECTION.test(`${item.name}\n${item.description}`)) findings.push(finding('MP001', kind, item.name));
      if (kind === 'tool') {
        if (!item.inputSchema || item.inputSchema.type !== 'object') findings.push(finding('MP003', kind, item.name));
        if (DESTRUCTIVE.test(item.name) && item.annotations.readOnlyHint !== true) findings.push(finding('MP002', kind, item.name));
      }
    }
  }
  const summary = { high: 0, medium: 0, low: 0, total: findings.length };
  for (const item of findings) summary[item.severity] += 1;
  const score = Math.max(0, 100 - summary.high * 20 - summary.medium * 8 - summary.low * 2);
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return { tools, resources, prompts, findings, summary, score, grade };
}
