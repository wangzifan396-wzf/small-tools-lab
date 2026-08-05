# Contributing to diffwords

Thanks for considering a contribution. diffwords stays **zero-dependency** and
**CJK-aware** — keep those two promises and most PRs are welcome.

## Getting started

```bash
git clone https://github.com/<you>/diffwords
cd diffwords
npm test          # node --test, no install step, no deps
```

No build step. The library is plain ES modules under `src/`; the CLI is
`bin/diffwords.js` → `src/cli.js` (the only module that touches the FS).

## Project layout

```
src/
  core/
    tokenize.js   CJK-aware tokenizer
    lcs.js        generic array LCS → ops
    diff.js       high-level diff + stats + line reconstruction
    format.js     inline / unified / html / json renderers
  cli.js          command-line surface
  index.js        public API barrel
test/             node:test cases, one file per module
examples/         sample texts used by tests and docs
playground/       browser demo (no build)
```

## Adding a renderer

1. Implement a `formatX(result, options)` function in `src/core/format.js`.
2. Export it from `src/index.js` and declare it in `types/index.d.ts`.
3. Wire a CLI flag in `src/cli.js` (`run`) and document it in `docs/format.md`.
4. Add tests in `test/format.test.js`.

## Adding a tokenizer feature

The tokenizer decides what counts as a "unit of change". Keep CJK as
per-character; group Latin letters/digits into words; keep whitespace and
punctuation as their own tokens so text always round-trips via `untokenize`.

## Style

- ES modules, no CommonJS, no dependencies.
- JSDoc the exported functions; TypeScript users consume `types/index.d.ts`.
- Keep the CLI the only module that imports `node:fs`.
- `npm test` must be green.

## Reporting bugs

Open an issue with the two texts (anonymised), the command you ran, and the
output. A failing test case is the fastest path to a fix.
