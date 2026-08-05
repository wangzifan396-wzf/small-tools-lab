# Contributing to cronly

Thanks for considering a contribution. cronly stays **zero-dependency** — keep
that promise and most PRs are welcome.

## Getting started

```bash
git clone https://github.com/<you>/cronly
cd cronly
npm test          # node --test, no install step, no deps
```

No build step. The library is plain ES modules under `src/`; the CLI is
`bin/cronly.js` → `src/cli.js` (the only module that touches the FS).

## Project layout

```
src/
  core/
    parse.js       cron parser + validator (throws CronError)
    describe.js    humanizer (English / Chinese)
    schedule.js    next/prev/nextRuns + timezone-aware matching
  cli.js           command-line surface
  index.js         public API barrel
test/             node:test cases, one file per module
playground/       browser demo (no build)
```

## Adding a feature

- New field syntax → extend `expand`/`expandDow` in `src/core/parse.js` and add
  a test in `test/parse.test.js`.
- New description language or phrasing → `src/core/describe.js` +
  `test/describe.test.js`.
- Scheduling edge cases → `src/core/schedule.js` + `test/schedule.test.js`.
  Always pass `{ timeZone: 'UTC' }` in tests for determinism.

## Style

- ES modules, no CommonJS, no dependencies.
- JSDoc the exported functions; TypeScript users consume `types/index.d.ts`.
- Keep the CLI the only module that imports `node:fs`.
- `npm test` must be green.

## Reporting bugs

Open an issue with the expression, the `--from`/`--tz` you used, and the output
you expected. A failing test case is the fastest path to a fix.
