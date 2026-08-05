# Contributing to jsonq

Thanks for your interest! This is a small, zero-dependency library, so the
contribution surface is intentionally narrow.

## Layout

```
src/core/query.js   get, pick, omit, filter, sortBy, select
src/index.js        barrel exports
src/cli.js          command-line interface
bin/jsonq.js        CLI entry point
test/*.test.js      node:test suites
```

## Adding a function

1. Put it in `src/core/query.js`.
2. Export it from `src/index.js`.
3. Add a `test/<name>.test.js` suite — every public function needs coverage.
4. Expose it via the CLI in `src/cli.js` if it makes sense as a subcommand.
5. Document it in `README.md` and `README.zh-CN.md`.
6. Add TypeScript declarations in `types/index.d.ts`.

## Style

- ES modules, no build step, **no runtime dependencies**.
- 2-space indentation, LF line endings (see `.editorconfig`).
- Prefer small, pure functions; throw `TypeError` for wrong input types.

## Running tests

```bash
node --test "test/*.test.js"
```

All suites must pass before a PR is merged.
