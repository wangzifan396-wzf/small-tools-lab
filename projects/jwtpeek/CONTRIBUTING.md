# Contributing to ctxcalc

This project follows the [small-tools-lab contributing guide](../CONTRIBUTING.md).

- **Zero dependencies.** Do not add runtime `dependencies`. Node built-ins and
  the browser's Web/standard APIs only.
- **Dual runtime.** Code in `src/` must run unchanged in Node (ESM) and the
  browser. The playground `index.html` inlines its own copy of the core so it
  works over `file://`; keep the two in sync.
- **Estimates, not billing.** Token counts are heuristic and prices are
  illustrative. Document that clearly wherever shown.
- **Tests.** `npm test` runs `node --test`. Cover the estimator, fit math, cost,
  and CLI branches.

## Local dev

```bash
npm test        # run unit tests
npm start       # serve the browser playground locally
```
