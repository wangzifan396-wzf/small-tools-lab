# Action Budget contributor guide

Action Budget is a Node.js 20 CLI that parses GitHub Actions YAML as untrusted data. It must never evaluate expressions, execute workflow or repository code, or claim an exact cost when fanout is not statically visible.

Core files:

- `src/analyzer.js` owns YAML parsing, matrix expansion, triggers, job metrics, findings, and scoring.
- `src/reporters.js` owns terminal, JSON, Markdown, and self-contained HTML output.
- `bin/action-budget.js` owns CLI parsing, configuration, output, and exit codes.
- `tests/` uses disposable repositories and Node's built-in test runner.

After changes, run `npm run check`, `npm test`, and `npm run demo`. Add regression coverage for every matrix rule and keep assumptions, lower bounds, upper bounds, and unknown values visibly distinct.
