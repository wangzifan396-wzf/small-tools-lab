import { parse, decodeSegment, summarize } from "./core/jwt.js";

// CLI entry. `argv` is the array after `node jwtpeek`. Returns { code, out }.
export function run(argv) {
  const token = argv.find((a) => !a.startsWith("-"));
  const flags = argv.filter((a) => a.startsWith("-"));
  const wantHeader = flags.includes("--header") || flags.includes("-h");
  const wantPayload = flags.includes("--payload") || flags.includes("-p");
  const wantJson = flags.includes("--json") || flags.includes("-j");

  if (!token || argv.includes("--help") || argv.includes("-?")) {
    return {
      code: 1,
      out:
        "用法: jwtpeek \"<token>\" [选项]\n" +
        "  -h, --header    只显示 header\n" +
        "  -p, --payload   只显示 payload\n" +
        "  -j, --json      以 JSON 输出完整解析结果\n" +
        "示例: jwtpeek \"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.xxxx\"\n" +
        "\n⚠️ 仅解码，不校验签名。",
    };
  }

  if (wantJson) {
    return { code: 0, out: JSON.stringify(parse(token), null, 2) };
  }
  if (wantHeader) {
    const m = String(token).trim().split(".");
    const d = decodeSegment(m[0]);
    return { code: d.ok ? 0 : 1, out: JSON.stringify(d.value, null, 2) };
  }
  if (wantPayload) {
    const m = String(token).trim().split(".");
    const d = decodeSegment(m[1] || "");
    return { code: d.ok ? 0 : 1, out: JSON.stringify(d.value, null, 2) };
  }
  return summarize(token);
}
