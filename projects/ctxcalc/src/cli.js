import { analyze, modelById, MODELS, preview } from './core/ctx.js';

// CLI entry. `argv` is the array after `node ctxcalc`. Returns
// { code, out } so the bin can print + exit without side effects here.
export function run(argv) {
  if (argv[0] === '--list' || argv[0] === '-l') {
    let out = '可用模型（id · 上下文窗口 · 参考价 $/1K in→out）：\n';
    for (const m of MODELS) {
      out += `  ${m.id.padEnd(20)} ${String(m.ctx).padStart(9)}  ${m.inPer1k} → ${m.outPer1k}\n`;
    }
    out += '\n价格仅为示意参考，非真实账单。';
    return { code: 0, out };
  }

  const text = argv[0];
  if (!text) {
    return { code: 1, out: '用法: ctxcalc "<文本>" [模型id] [输出token数]\n示例: ctxcalc "你好 world" gpt-4o 500\n      ctxcalc --list' };
  }

  const modelId = argv[1] || MODELS[0].id;
  const m = modelById(modelId);
  if (!m) {
    return { code: 1, out: '未知模型：' + modelId + '（用 ctxcalc --list 查看可用模型）' };
  }

  const outTokens = parseInt(argv[2], 10) || 0;
  const r = preview(text, m.id, outTokens);

  let out = `${m.icon} ${m.label}（${m.provider}）\n`;
  out += `字符 ${r.chars} · 中文 ${r.cjk} · 词 ${r.words} · 其它 ${r.other}\n`;
  out += `估算 token：${r.tokens.toLocaleString()}\n`;
  out += `上下文窗口：${r.ctx.toLocaleString()} · 占比 ${r.pct}%`;
  out += r.fits ? ' · 可放下' : ` · 超出 ${(r.tokens - r.ctx).toLocaleString()} token`;
  out += `\n约可放入 ${r.fitCopies} 份本文本`;
  if (outTokens > 0) {
    out += `\n成本（参考价）：输入 $${r.costIn.toFixed(6)} + 输出 $${r.costOut.toFixed(6)} = $${r.cost.toFixed(6)}`;
  }
  out += '\n（token 为启发式估算，成本为示意参考价，非真实账单）';
  return { code: 0, out };
}

// re-export analyze so the bin/tests can import a single object if needed
export { analyze };
