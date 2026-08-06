# Contributing to Unit Convert

This project follows the [small-tools-lab contributing guide](../CONTRIBUTING.md).

- **Zero dependencies.** Do not add runtime `dependencies`. Node built-ins and
  the browser's Web/standard APIs only.
- **Dual runtime.** Code in `src/` must run unchanged in Node (ESM) and the
  browser (the playground imports `../src/index.js` directly).
- **Add a unit = one line.** New units go into `src/core/convert.js` as a factor
  against the category base; temperature stays in the special branch.
- **Tests.** `npm test` runs `node --test`. Cover new units and any CLI branch.

## Local dev

```bash
npm test        # run unit tests
npm start       # serve the browser playground locally
```
