// CLI entry logic for regex-visualizer. Parses argv, prints, but the real work
// lives in core/regex.js so it can be unit-tested alone.
import { explain, findMatches, highlight } from './core/regex.js';

const USAGE = [
  '用法:',
  '  regex-visualizer --explain "<pattern>" [flags]   解释正则各 token 的含义',
  '  regex-visualizer "<pattern>" "<text>" [flags]   在文本中查找所有匹配',
  '',
  '示例:',
  '  regex-visualizer --explain "\\\\d{3}-\\\\d{4}"',
  '  regex-visualizer "\\\\b\\\\w+\\\\b" "hello world 123" g',
].join('\n');

export function run(argv) {
  const args = argv.slice();

  const explainIdx = args.indexOf('--explain');
  if (explainIdx !== -1) {
    const pattern = args[explainIdx + 1];
    if (pattern === undefined) {
      return { code: 1, out: '用法: regex-visualizer --explain "<pattern>" [flags]' };
    }
    const flags = args[explainIdx + 2] || '';
    const r = explain(pattern, flags);
    if (r.error) return { code: 1, out: '正则解析错误: ' + r.error };
    const lines = r.tokens.map((t, idx) => `${String(idx + 1).padStart(2, '0')}. ${t.raw}  —  ${t.meaning}`);
    return { code: 0, out: lines.join('\n') };
  }

  if (args.length < 2) {
    return { code: 1, out: USAGE };
  }

  const [pattern, text, flags] = args;
  const r = findMatches(text, pattern, flags || '');
  if (r.error) return { code: 1, out: '正则错误: ' + r.error };

  const lines = [`匹配数: ${r.matches.length}${r.capped ? '（已截断上限 1000）' : ''}`];
  r.matches.forEach((m, idx) => {
    let line = `#${idx + 1} [${m.index}-${m.end}] "${m.value}"`;
    if (m.groups.length) line += `  groups=${m.groups.join(' | ')}`;
    lines.push(line);
  });
  if (r.namedGroups.length) lines.push('命名组: ' + r.namedGroups.join(', '));
  // also surface an HTML highlight preview
  lines.push('高亮: ' + highlight(text, pattern, flags || ''));
  return { code: 0, out: lines.join('\n') };
}
