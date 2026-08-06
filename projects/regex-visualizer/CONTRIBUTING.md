# Contributing to Regex Visualizer

This project follows the [small-tools-lab contributing guide](../CONTRIBUTING.md).

- **Zero dependencies.** Do not add runtime `dependencies`. Node built-ins and
  the browser's Web/standard APIs only.
- **Dual runtime.** Code in `src/` must run unchanged in Node (ESM) and the
  browser (the playground imports the tested `src/core/regex.js` module).
- **Explain, don't execute.** The parser in `src/core/regex.js` describes tokens;
  keep it defensive so invalid patterns return `{ error }` instead of throwing.
- **Tests.** `npm test` runs `node --test`. Cover new token kinds and any CLI branch.

## Local dev

```bash
npm test        # run unit tests
npm start       # serve the browser playground locally
```
