# MCP Probe · MCP 能力检查

只读检查显式指定的 MCP stdio 服务：完成初始化、列出工具 / 资源 / Prompt、测量延迟并扫描危险元数据。不会调用工具、读取资源或获取 Prompt 正文。

```sh
node bin/mcp-probe.js -- node server.js
node bin/mcp-probe.js --format json -- python server.py
node bin/mcp-probe.js --clean-env --timeout 10000 -- node server.js
```

`--` 分隔符是强制的，之后的参数通过无 shell 的参数数组传给服务进程。默认使用当前稳定的 MCP `2026-07-28` 协议版本。

检查范围包括提示注入文案、危险工具缺少 `readOnlyHint`、输入 Schema 缺失、重复 / 空描述和异常超长元数据。报告不包含服务参数、环境变量值或 stderr 正文。
