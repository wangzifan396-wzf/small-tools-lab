import { parse, describe, nextRuns } from './core/cron.js';

// CLI entry. `argv` is the array after `node cron-describe`. Returns
// { code, out } so the bin can print + exit without side effects here.
export function run(argv) {
  const expr = argv[0];
  if (!expr) {
    return { code: 1, out: '用法: cron-describe "<cron 表达式>" [次数]\n示例: cron-describe "0 0 * * 1" 3' };
  }
  const p = parse(expr);
  if (!p.ok) return { code: 1, out: '解析失败：' + p.error };

  const desc = describe(p);
  const count = Math.min(parseInt(argv[1], 10) || 5, 20);
  const nr = nextRuns(expr, count);

  let out = desc.zh + '\n';
  if (nr.ok) {
    out += '\n下次运行（最多 ' + count + ' 次）：\n';
    nr.runs.forEach((d, i) => {
      out += (i + 1) + '. ' + d.toLocaleString('zh-CN', { hour12: false }) + '\n';
    });
  } else {
    out += '\n' + nr.error + '\n';
  }
  return { code: 0, out };
}
