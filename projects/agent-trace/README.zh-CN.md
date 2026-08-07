# Agent Trace · 本地 Agent 会话分析

面向编码智能体 JSONL 日志的零依赖分析器：统计 token、工具调用与延迟，定位重复读取、重复失败和损坏行。所有处理都在本机完成，报告默认不包含提示词或工具输出正文。

```sh
node bin/agent-trace.js path/to/session.jsonl
node bin/agent-trace.js path/to/sessions --format markdown
node bin/agent-trace.js trace.jsonl --format json --output report.json --fail-on-errors
```

工具识别常见的 Codex / Claude Code 事件形状，也能分析通用 JSONL。目录扫描会跳过符号链接、`.git`、`node_modules`，单文件上限 50 MiB。

核心能力：

- 增量 / 累计 token 与缓存 token 汇总
- 工具调用次数、错误数、平均与 p95 延迟
- 同一路径重复读取、同一目标重复失败
- JSONL 损坏行定位、会话时长与用户轮次
- pretty、Markdown、JSON 三种输出

需要 Node.js 20+。运行 `npm test` 可验证核心逻辑。
