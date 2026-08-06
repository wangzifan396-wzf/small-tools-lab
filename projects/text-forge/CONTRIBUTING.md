# Contributing to Text Forge

This project follows the [small-tools-lab contributing guide](../CONTRIBUTING.md).

- **Zero dependencies.** Do not add runtime `dependencies`. Node built-ins and
  the browser's Web/standard APIs only.
- **Dual runtime.** Code in `src/` must run unchanged in Node (ESM) and the
  browser (the full API is exported from `src/index.js`).
- **Unicode-aware.** Keep CJK characters in slugs, and prefer `String.prototype
  .normalize` plus Unicode property escapes over ASCII-only regexes.
- **Tests.** `npm test` runs `node --test`. Cover each transform, including CJK
  and diacritic cases.

## Local dev

```bash
npm test        # run unit tests
```
