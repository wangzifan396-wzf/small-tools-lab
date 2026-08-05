# Contributing to hashforge

Thanks for your interest! This is a small, zero-dependency library, so the
contribution surface is intentionally narrow.

## Layout

```
src/core/hash.js   digest, hashText, hashBytes, hashFile, hmac, hmacText, encode, decode, verify
src/index.js       barrel exports
src/cli.js         command-line interface
bin/hashforge.js   CLI entry point
test/*.test.js     node:test suites
```

## Adding a function

1. Put it in `src/core/hash.js`.
2. Export it from `src/index.js`.
3. Add a `test/<name>.test.js` suite — every public function needs coverage.
4. Expose it via the CLI in `src/cli.js` if it makes sense as a subcommand.
5. Document it in `README.md` and `README.zh-CN.md`.
6. Add TypeScript declarations in `types/index.d.ts`.

## Style

- ES modules, no build step, **no runtime dependencies**.
- 2-space indentation, LF line endings (see `.editorconfig`).
- Keep the browser path working: only use Web Crypto APIs available in modern
  browsers (so the playground and the CLI share one implementation).
- MD5 is intentionally unsupported (insecure + absent from Web Crypto).

## Running tests

```bash
node --test "test/*.test.js"
```

All suites must pass before a PR is merged.
