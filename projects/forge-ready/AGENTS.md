# ForgeReady contributor guide

ForgeReady is a zero-dependency Node.js CLI. Keep runtime code compatible with Node.js 20 and keep audits local, deterministic, and read-only.

Core files:

- `src/scanner.js` owns file discovery, profiles, evidence, rules, and category scoring.
- `src/reporters.js` owns pretty, JSON, Markdown, and self-contained HTML output.
- `bin/forge-ready.js` owns CLI parsing, configuration, output, and exit codes.
- `tests/` contains Node test-runner coverage using disposable repositories.

After changes, run `npm run check`, `npm test`, `npm run audit:self`, and `npm run demo`. Every new rule needs a fixture that passes and one that fails. Never use active credentials in examples or tests.
