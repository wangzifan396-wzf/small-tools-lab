# MCP Probe

A bounded, read-only stdio inspector for Model Context Protocol servers. MCP Probe initializes an explicitly supplied server, lists advertised capabilities, measures response latency, and checks capability metadata for risky signals. It never invokes a tool, reads a resource, or renders a prompt.

The default protocol revision is [`2026-07-28`](https://modelcontextprotocol.io/specification/2026-07-28), the current stable MCP specification revision when this release was built.

## Usage

The `--` separator is required. Everything after it is passed directly to the server process without a shell.

```sh
mcp-probe -- node server.js
mcp-probe --format json -- npx -y @example/mcp-server
mcp-probe --clean-env --timeout 10000 -- python server.py
mcp-probe --format sarif --output mcp-probe.sarif -- node server.js
```

From this repository:

```sh
node bin/mcp-probe.js -- node path/to/server.js
```

## Probe boundary

MCP Probe sends only:

1. `initialize`
2. `notifications/initialized`
3. Advertised `tools/list`, `resources/list`, `resources/templates/list`, and `prompts/list` requests, following at most ten cursor pages

It responds “method not supported” to server-to-client requests and never calls `tools/call`, `resources/read`, or `prompts/get`.

## Findings

- Prompt-injection language in names or descriptions
- Potentially destructive / mutating tool names without `readOnlyHint`
- Missing or invalid tool input schemas
- Missing, duplicate, or unusually large capability metadata
- Control characters and recognizable token formats are removed or masked in the report

Output formats are terminal, JSON, Markdown, and SARIF. Static metadata signals are review aids, not proof that an MCP server is safe.

## Environment safety

By default the child inherits the current environment, matching how many MCP servers receive credentials. Use `--clean-env` to pass only basic OS variables. The report records only the executable basename and stderr byte count, not server arguments, environment values, or stderr contents.

Node.js 20+, zero runtime dependencies, MIT licensed. Run `npm test` for the protocol, analyzer, and real child-process fixture suite.
