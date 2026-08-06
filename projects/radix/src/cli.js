import { convert, commonConversions, bitView, isValidInput } from "./core/radix.js";

// CLI entry. `argv` is the array after `node radix`. Returns { code, out }.
export function run(argv) {
  const help =
    "用法: radix <值> <源进制> <目标进制>\n" +
    "  --all <值> <源进制>      显示 二/八/十/十六 进制\n" +
    "  --bits <值> <源进制>     二进制 + 字节视图\n" +
    "  --help\n" +
    "示例: radix ff 16 10        # → 255\n" +
    "      radix 255 10 16       # → ff\n" +
    "      radix --all 255 10    # 二进制/八进制/十进制/十六进制\n" +
    "进制范围 2..36。";

  if (argv.includes("--help") || argv.includes("-?")) return { code: 0, out: help };

  const all = argv.includes("--all");
  const bits = argv.includes("--bits");
  const positional = argv.filter((a) => !a.startsWith("-"));

  if (positional.length < 2) return { code: 1, out: help };

  const value = positional[0];
  const fromBase = parseInt(positional[1], 10);
  if (!isValidInput(value, fromBase)) {
    return { code: 1, out: `非法输入 "${value}" 对进制 ${fromBase}（范围 2..36，仅用合法字符）` };
  }

  if (all) {
    const c = commonConversions(value, fromBase);
    return {
      code: 0,
      out:
        `二进制    ${c.binary}\n` +
        `八进制    ${c.octal}\n` +
        `十进制    ${c.decimal}\n` +
        `十六进制  ${c.hex}`,
    };
  }

  if (bits) {
    const b = bitView(value, fromBase);
    const bytes = b.bytes.map((x, i) => `  [${i}] ${x}`).join("\n");
    return {
      code: 0,
      out: `位宽 ${b.bits} · ${b.byteLength} 字节\n二进制  ${b.binary}\n字节视图\n${bytes}`,
    };
  }

  if (positional.length < 3) return { code: 1, out: help };
  const toBase = parseInt(positional[2], 10);
  if (toBase < 2 || toBase > 36) return { code: 1, out: help };
  try {
    const r = convert(value, fromBase, toBase);
    return { code: 0, out: r.value };
  } catch (e) {
    return { code: 1, out: String(e.message || e) };
  }
}
