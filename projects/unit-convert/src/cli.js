// CLI entry logic for unit-convert. Pure-ish: parses argv and prints, but the
// conversion itself lives in core/convert.js so it can be unit-tested alone.
import {
  CATEGORIES, listCategories, unitsInCategory, categoryOf, convert, formatNumber
} from './core/convert.js';

export function run(argv) {
  const args = argv.slice();

  const listIdx = args.indexOf('--list');
  const catIdx = args.indexOf('--cat');

  if (listIdx !== -1) {
    const lines = ['可用类别与单位：'];
    for (const cat of listCategories()) {
      lines.push(`  ${cat}: ${unitsInCategory(cat).join(', ')}`);
    }
    return { code: 0, out: lines.join('\n') };
  }

  if (catIdx !== -1) {
    const cat = args[catIdx + 1];
    if (!cat || !(cat in CATEGORIES)) {
      return { code: 1, out: '未知类别: ' + (cat || '') + '（可用: ' + listCategories().join(', ') + '）' };
    }
    return { code: 0, out: `${cat}: ${unitsInCategory(cat).join(', ')}` };
  }

  // Expect: <value> <from> <to>
  if (args.length < 3) {
    return {
      code: 1,
      out: '用法: unit-convert <数值> <源单位> <目标单位>\n示例: unit-convert 100 km mi\n      unit-convert --list       列出所有类别与单位\n      unit-convert --cat length 列出某类别的单位'
    };
  }

  const [valueStr, from, to] = args;
  try {
    const result = convert(valueStr, from, to);
    return { code: 0, out: `${formatNumber(result)} ${to}` };
  } catch (e) {
    const guess = categoryOf(from) || categoryOf(to);
    const hint = guess ? `\n${guess} 下的单位: ${unitsInCategory(guess).join(', ')}` : '';
    return { code: 1, out: e.message + hint };
  }
}
