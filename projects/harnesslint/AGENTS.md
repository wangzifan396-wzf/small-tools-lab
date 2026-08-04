# HarnessLint contributor guide

HarnessLint is a zero-dependency Node.js CLI. Keep runtime code compatible with Node.js 20 and use only built-in modules unless a dependency removes substantial complexity.

Core files:

- `src/scanner.js` owns file discovery, rules, fingerprints, and scoring.
- `src/reporters.js` owns pretty, JSON, SARIF, and HTML output.
- `bin/harnesslint.js` owns CLI parsing, baselines, file output, and exit codes.
- `tests/` contains Node test-runner coverage.

After a change, run `npm run check`, `npm test`, and `npm run lint:self`. Add a regression test for every rule or CLI behavior change. Do not include real credentials in fixtures; use obviously synthetic values.
