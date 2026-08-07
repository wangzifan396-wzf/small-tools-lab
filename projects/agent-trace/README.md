# Agent Trace

Local-first observability for coding-agent JSONL logs. Agent Trace summarizes token use, tool calls, latency, repeated file reads, parse damage, and repeated failures without sending traces anywhere or including prompt bodies in reports.

## Why this tool

Coding-agent logs are useful but often large, private, and vendor-specific. Agent Trace recognizes common Claude Code and Codex event shapes while keeping a generic JSONL fallback. Its output is deterministic enough for CI artifacts and small enough to paste into an issue.

## Usage

```sh
node bin/agent-trace.js path/to/session.jsonl
node bin/agent-trace.js path/to/session-directory --format markdown
node bin/agent-trace.js trace.jsonl --format json --output report.json --fail-on-errors
```

Supported inputs are `.jsonl` and `.ndjson`; directories are scanned recursively, excluding symlinks, `.git`, and `node_modules`. Files over 50 MiB are reported instead of loaded.

## Signals

- Incremental and cumulative token counters, including cache reads / writes
- Tool calls, results, errors, average latency, and p95 latency
- Repeated reads of the same path and repeated failures on the same target
- Malformed JSONL lines with source and line number
- User-turn count and wall-clock session duration

Reports contain metadata, tool names, and bounded path / URL targets. They deliberately omit message and tool-output bodies. URL credentials, queries, and fragments are removed.

## Library

```js
import { analyzeJsonl, renderReport } from './src/index.js';

const report = analyzeJsonl(jsonl, 'session.jsonl');
console.log(renderReport(report, 'markdown'));
```

Node.js 20+, zero runtime dependencies, MIT licensed. Run `npm test` for the focused suite.

## Boundary

Agent Trace is a local diagnostics tool, not a billing authority. Vendor log schemas change and token snapshots may be incomplete. Use provider invoices for financial reconciliation.
