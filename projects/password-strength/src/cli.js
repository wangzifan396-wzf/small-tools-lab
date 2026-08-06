// CLI entry logic for password-strength. Parses argv, prints, but the analysis
// lives in core/strength.js so it can be unit-tested alone.
import { analyze } from './core/strength.js';

const USAGE = [
  '用法:',
  '  password-strength "<password>"   分析密码强度',
  '',
  '示例:',
  '  password-strength "Tr0ub4dour&9"',
].join('\n');

const SCORE_LABEL = ['非常弱', '弱', '中等', '强', '非常强'];

export function run(argv) {
  if (argv.length < 1) {
    return { code: 1, out: USAGE };
  }
  const [pw] = argv;
  const r = analyze(pw);

  const lines = [];
  lines.push(`强度评分: ${r.score}/4（${SCORE_LABEL[r.score]}）`);
  lines.push(`熵: ${r.entropyBits} bits`);
  lines.push(`破解耗时估算: ${r.crackEstimate}`);
  lines.push(`长度: ${r.length}`);

  const f = r.flags;
  const checks = [];
  if (f.tooShort) checks.push('太短(<8)');
  if (f.hasLower) checks.push('小写');
  if (f.hasUpper) checks.push('大写');
  if (f.hasDigit) checks.push('数字');
  if (f.hasSymbol) checks.push('符号');
  if (f.hasSequential) checks.push('含连续序列');
  if (f.hasRepeats) checks.push('含重复');
  if (f.hasCommonPattern) checks.push('常见密码');
  if (f.allSameClass) checks.push('单一字符类');
  lines.push('检查项: ' + (checks.length ? checks.join(', ') : '（无）'));

  lines.push('建议:');
  for (const s of r.suggestions) lines.push('  - ' + s);

  return { code: 0, out: lines.join('\n') };
}
