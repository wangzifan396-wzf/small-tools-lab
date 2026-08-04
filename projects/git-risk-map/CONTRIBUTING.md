# Contributing

Git Risk Map turns observable Git metadata into an explainable review order. New signals should be deterministic, useful across more than one repository, and visible in the per-file score breakdown.

## Development

Node.js 20 or newer and Git are required. There are no package dependencies.

```sh
npm run check
npm test
npm run demo
```

## Pull requests

- Add or update tests for every scoring change.
- State the expected false-positive and false-negative tradeoff.
- Keep platform behavior consistent across Linux, macOS, and Windows.
- Never execute changed source files as part of analysis.
- Update the README when adding CLI options or configuration fields.

Scoring proposals are easiest to evaluate when they include a small before/after repository fixture and the expected point breakdown.
