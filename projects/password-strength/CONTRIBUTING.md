# Contributing to Password Strength

This project follows the [small-tools-lab contributing guide](../CONTRIBUTING.md).

- **Zero dependencies.** Do not add runtime `dependencies`. Node built-ins and
  the browser's Web/standard APIs only.
- **Dual runtime.** Code in `src/` must run unchanged in Node (ESM) and the
  browser (the playground inlines `src/core/strength.js` so it works over `file://`).
- **Heuristics, not gospel.** Entropy and crack-time are rough estimates; keep
  the common-password list and pool assumptions explicit and easy to tune.
- **Tests.** `npm test` runs `node --test`. Cover scoring bands and every flag.

## Local dev

```bash
npm test        # run unit tests
npm start       # serve the browser playground locally
```
