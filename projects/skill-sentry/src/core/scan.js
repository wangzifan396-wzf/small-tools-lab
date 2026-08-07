import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { posix } from 'node:path';

export const RULES = Object.freeze({
  SS001: { severity: 'high', title: 'Unicode bidirectional control character', remediation: 'Remove hidden direction controls and review the surrounding text.' },
  SS002: { severity: 'high', title: 'Prompt-injection instruction', remediation: 'Remove instructions that override higher-priority policy or conceal behavior.' },
  SS003: { severity: 'high', title: 'Remote content piped to an interpreter', remediation: 'Download, verify a pinned checksum, inspect, and execute as separate steps.' },
  SS004: { severity: 'high', title: 'Destructive command', remediation: 'Narrow the target and require an explicit user confirmation.' },
  SS005: { severity: 'medium', title: 'Sensitive credential access', remediation: 'Declare why credentials are required and minimize the files or variables accessed.' },
  SS006: { severity: 'high', title: 'Potential credential exfiltration', remediation: 'Separate credential access from network code and remove secret-bearing requests.' },
  SS007: { severity: 'high', title: 'Hard-coded secret material', remediation: 'Revoke the credential, remove it from history, and use a secret store.' },
  SS008: { severity: 'medium', title: 'Unpinned executable dependency', remediation: 'Pin the package or Git revision and verify its provenance.' },
  SS009: { severity: 'medium', title: 'Overly broad permission change', remediation: 'Grant the smallest required permission to an explicit target.' },
  SS010: { severity: 'high', title: 'Encoded payload execution', remediation: 'Keep executable code readable and reviewable; do not decode directly into a shell.' },
  SS100: { severity: 'medium', title: 'Incomplete skill metadata', remediation: 'Add non-empty name and description fields to SKILL.md frontmatter.' },
  SS101: { severity: 'high', title: 'Reference escapes the skill directory', remediation: 'Keep referenced resources inside the skill root.' },
  SS102: { severity: 'medium', title: 'Referenced local file is missing', remediation: 'Add the resource or correct the reference.' },
  SS103: { severity: 'low', title: 'Unreferenced executable resource', remediation: 'Reference the script from SKILL.md or remove it from the package.' },
});

const LINE_RULES = [
  ['SS001', /[\u202a-\u202e\u2066-\u2069]/u],
  ['SS002', /(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|system|developer)\s+(?:instructions?|messages?)|do\s+not\s+(?:tell|show|reveal)\s+(?:the\s+)?user|hidden\s+instructions?/iu],
  ['SS003', /(?:curl|wget)\b[^\n|]*\|\s*(?:ba)?sh\b|(?:iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(?:iex|Invoke-Expression)\b/iu],
  ['SS004', /\brm\s+-[^\n]*r[^\n]*f\b|\bRemove-Item\b[^\n]*(?:-Recurse[^\n]*-Force|-Force[^\n]*-Recurse)|\bgit\s+(?:reset\s+--hard|clean\s+-[^\n]*f)|\b(?:del|rmdir)\s+\/(?:s|q)/iu],
  ['SS005', /(?:\.ssh[\\/]|\.aws[\\/]credentials|\/etc\/(?:shadow|passwd)|(?:process\.env|\$env:|os\.environ)[^\n]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY))/iu],
  ['SS007', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[opsu]_[A-Za-z0-9]{30,}\b|\bAKIA[0-9A-Z]{16}\b/iu],
  ['SS008', /\bnpx\s+(?:-y\s+)?(?![^\s@]+@(?:\d|[a-f0-9]{7,}\b))[^\s]+|\buvx\s+(?![^\s@]+@)[^\s]+|\bpip\s+install\s+git\+https?:\/\/(?![^\s]+@[a-f0-9]{7,}\b)/iu],
  ['SS009', /\bchmod\s+(?:-R\s+)?777\b|\bsudo\s+(?:chmod|chown)\b/iu],
  ['SS010', /(?:base64\s+(?:--decode|-d)|FromBase64String)[^\n|]*(?:\||;)\s*(?:ba?sh|iex|Invoke-Expression|python)/iu],
];
const NETWORK = /\b(?:curl|wget|Invoke-WebRequest|iwr)\b|\b(?:fetch|axios\.(?:post|put)|requests\.(?:post|put)|httpx\.(?:post|put))\s*\(/iu;
const SENSITIVE = LINE_RULES.find(([id]) => id === 'SS005')[1];
const SCRIPT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.py', '.sh', '.bash', '.ps1', '.cmd', '.bat', '.rb', '.go', '.rs']);
const TEXT_EXTENSIONS = new Set([...SCRIPT_EXTENSIONS, '.md', '.txt', '.json', '.jsonc', '.yaml', '.yml', '.toml']);

function maskEvidence(value) {
  return value
    .replace(/\bgh[opsu]_[A-Za-z0-9]{8,}\b/gu, 'gh*_***REDACTED***')
    .replace(/\bAKIA[0-9A-Z]{16}\b/gu, 'AKIA***REDACTED***')
    .trim().slice(0, 200);
}

function finding(rule, file, line, evidence, detail) {
  const meta = RULES[rule];
  return { rule, severity: meta.severity, title: meta.title, file, line, evidence: maskEvidence(evidence || ''), detail: detail || '', remediation: meta.remediation };
}

export function parseFrontmatter(content) {
  if (typeof content !== 'string') throw new TypeError('Skill content must be a string');
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) return { data: {}, body: content, valid: false };
  const data = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*?)\s*$/u);
    if (field) data[field[1]] = field[2].replace(/^['"]|['"]$/gu, '');
  }
  return { data, body: content.slice(match[0].length), valid: true };
}

export function extractLocalReferences(content) {
  const references = new Set();
  for (const match of content.matchAll(/\]\(([^)]+)\)/gu)) {
    const value = match[1].trim().split(/\s+["']/u)[0].split('#')[0];
    if (value && !/^[a-z][a-z0-9+.-]*:/iu.test(value) && !value.startsWith('#')) references.add(value);
  }
  for (const match of content.matchAll(/`((?:scripts|references|assets)[\\/][^`\s]+)`/gu)) references.add(match[1]);
  return [...references];
}

export function scanContent(file, content, options = {}) {
  if (typeof content !== 'string') throw new TypeError('Content must be a string');
  const ignored = new Set(options.ignoreRules || []);
  const findings = [];
  const lines = content.split(/\r\n|\r|\n/u);
  for (const [index, line] of lines.entries()) {
    for (const [rule, pattern] of LINE_RULES) {
      pattern.lastIndex = 0;
      if (!ignored.has(rule) && pattern.test(line)) findings.push(finding(rule, file, index + 1, line));
    }
  }
  if (!ignored.has('SS006') && NETWORK.test(content) && SENSITIVE.test(content)) {
    const line = lines.findIndex((value) => NETWORK.test(value)) + 1;
    findings.push(finding('SS006', file, line || 1, lines[(line || 1) - 1], 'The same file accesses sensitive credentials and performs outbound network operations.'));
  }
  return findings;
}

function normalizeReference(from, reference) {
  const clean = reference.replaceAll('\\', '/');
  if (clean.startsWith('/') || /^[A-Za-z]:\//u.test(clean)) return { escaped: true, path: clean };
  const output = posix.normalize(posix.join(posix.dirname(from), clean));
  return { escaped: output === '..' || output.startsWith('../'), path: output };
}

export function analyzeSkillSnapshot(root, files, options = {}) {
  if (!files || typeof files !== 'object' || typeof files['SKILL.md'] !== 'string') throw new TypeError('Snapshot must include SKILL.md');
  const ignored = new Set(options.ignoreRules || []);
  const findings = [];
  const frontmatter = parseFrontmatter(files['SKILL.md']);
  if (!ignored.has('SS100') && (!frontmatter.valid || !frontmatter.data.name?.trim() || !frontmatter.data.description?.trim())) {
    findings.push(finding('SS100', 'SKILL.md', 1, 'SKILL.md', 'Expected non-empty name and description frontmatter fields.'));
  }

  const referenced = new Set(['SKILL.md']);
  for (const [file, content] of Object.entries(files)) {
    findings.push(...scanContent(file, content, options));
    if (extname(file).toLowerCase() !== '.md') continue;
    for (const reference of extractLocalReferences(content)) {
      const normalized = normalizeReference(file, reference);
      if (normalized.escaped) {
        if (!ignored.has('SS101')) findings.push(finding('SS101', file, 1, reference));
      } else {
        referenced.add(normalized.path.replace(/\/$/u, ''));
        const exists = Object.keys(files).some((candidate) => candidate === normalized.path || candidate.startsWith(`${normalized.path.replace(/\/$/u, '')}/`));
        if (!exists && !ignored.has('SS102')) findings.push(finding('SS102', file, 1, reference));
      }
    }
  }
  if (!ignored.has('SS103')) {
    for (const file of Object.keys(files)) {
      if (!file.startsWith('scripts/') || !SCRIPT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
      const known = [...referenced].some((reference) => file === reference || file.startsWith(`${reference}/`));
      if (!known) findings.push(finding('SS103', file, 1, file));
    }
  }
  const unique = [...new Map(findings.map((item) => [`${item.rule}\u0000${item.file}\u0000${item.line}`, item])).values()];
  return { root, name: frontmatter.data.name || posix.basename(root.replaceAll('\\', '/')), files: Object.keys(files).length, findings: unique };
}

async function collectFiles(root, maxFiles = 500, maxFileBytes = 2 * 1024 * 1024) {
  const files = {};
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (Object.keys(files).length >= maxFiles) return;
      if (entry.isSymbolicLink() || ['.git', 'node_modules'].includes(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.name === 'SKILL.md' || TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        const info = await stat(absolute);
        if (info.size <= maxFileBytes) files[relative(root, absolute).split(sep).join('/')] = await readFile(absolute, 'utf8');
      }
    }
  }
  await visit(root);
  return files;
}

export async function discoverSkillRoots(inputPath, limit = 100) {
  const target = resolve(inputPath);
  const info = await stat(target);
  if (info.isFile()) {
    if (target.toLowerCase().endsWith(`${sep}skill.md`)) return [dirname(target)];
    throw new TypeError('Input file must be SKILL.md');
  }
  const direct = join(target, 'SKILL.md');
  try { if ((await stat(direct)).isFile()) return [target]; } catch {}
  const roots = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (roots.length >= limit) return;
      if (entry.isSymbolicLink() || ['.git', 'node_modules'].includes(entry.name)) continue;
      const child = join(directory, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'skill.md') roots.push(directory);
      else if (entry.isDirectory()) await visit(child);
    }
  }
  await visit(target);
  return [...new Set(roots)].sort();
}

function summarize(skills) {
  const findings = skills.flatMap((skill) => skill.findings.map((item) => ({ ...item, skill: skill.name, root: skill.root })));
  const summary = { high: 0, medium: 0, low: 0, total: findings.length };
  for (const item of findings) summary[item.severity] += 1;
  const score = Math.max(0, 100 - summary.high * 20 - summary.medium * 8 - summary.low * 2);
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return { findings, summary, score, grade };
}

export async function scanPath(inputPath, options = {}) {
  const roots = await discoverSkillRoots(inputPath, options.maxSkills || 100);
  const skills = [];
  for (const root of roots) {
    const files = await collectFiles(root, options.maxFiles || 500, options.maxFileBytes || 2 * 1024 * 1024);
    skills.push(analyzeSkillSnapshot(root, files, options));
  }
  const result = summarize(skills);
  return { schemaVersion: 1, scannedAt: options.scannedAt || null, skills: skills.length, files: skills.reduce((sum, skill) => sum + skill.files, 0), ...result };
}

export function analyzeSnapshots(skills) {
  const result = summarize(skills);
  return { schemaVersion: 1, scannedAt: null, skills: skills.length, files: skills.reduce((sum, skill) => sum + skill.files, 0), ...result };
}
