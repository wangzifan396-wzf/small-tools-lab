# Env Matrix contributor guide

Env Matrix is a zero-dependency Node.js CLI. Keep runtime code compatible with Node.js 20. It must never execute code from the repository being inspected or send repository data over the network.

Core files:

- `src/scanner.js` owns file discovery, static source and layer observations, findings, scoring, and report-data redaction.
- `src/reporters.js` owns terminal, JSON, Markdown, and self-contained HTML output.
- `bin/env-matrix.js` owns CLI parsing, configuration loading, output, and exit codes.
- `tests/` uses disposable repositories and Node's built-in test runner.

After changes, run `npm run check`, `npm test`, and `npm run demo`. Preserve deterministic output, add regression coverage for each syntax change, and keep sensitive values out of every report representation.
