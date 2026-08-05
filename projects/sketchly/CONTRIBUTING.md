# Contributing to Sketchly

Thanks for wanting to help! Sketchly is intentionally small and dependency-free,
so contributions stay focused.

## Getting started

```bash
npm test          # run the unit tests on the pure core
npm run serve     # preview at http://localhost:4173
npm run build     # regenerate dist/sketchly.html
```

## Architecture

Keep the **core** pure and DOM-free so it stays unit-testable in Node:

- `src/geometry.js` — coordinates, bounds, hit-testing, resize math.
- `src/scene.js` — element model + (de)serialization.
- `src/store.js` — persistence.

The browser-only parts (`render.js`, `app.js`, `theme.js`) may use the DOM and
Canvas, but they must import only from the core modules — never the other way
around.

## Guidelines

- **Zero dependencies.** Do not add npm packages; vendor tiny helpers instead.
- **Offline-first.** No network requests, no tracking.
- **Test the core.** Add a unit test for any new geometry/scene/store logic
  under `test/`.
- **Keep it local.** Features should work from the single-file `dist/sketchly.html`
  opened via `file://`.

## PR process

1. Fork and branch from `main`.
2. Make your change with tests.
3. Run `npm test` and `npm run build`.
4. Open a PR using the template.

## Code style

2-space indent, LF line endings (see `.editorconfig`). Keep functions small and
named clearly.
