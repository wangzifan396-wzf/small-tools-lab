# Git Risk Map contributor guide

Git Risk Map is a zero-dependency Node.js CLI. Keep runtime code compatible with Node.js 20 and do not execute code from analyzed repositories.

Core files:

- `src/analyzer.js` owns Git discovery, change metadata, classification, scoring, and review planning.
- `src/reporters.js` owns pretty, JSON, Markdown, and self-contained HTML output.
- `bin/git-risk-map.js` owns CLI parsing, config loading, output, and exit codes.
- `scripts/demo.js` creates a disposable Git repository for the visual demo.
- `tests/` uses Node's built-in test runner and real temporary Git repositories.

After changes, run `npm run check`, `npm test`, and `npm run demo`. Keep scoring signals deterministic and explainable. Add a regression test for every scoring or CLI behavior change.
