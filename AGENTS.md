# Small Tools Lab contributor guide

This repository is a collection of independent tools. Keep changes inside the relevant `projects/<name>/` folder unless the catalog, shared CI, or repository policy genuinely needs to change.

Root responsibilities:

- `app.js`, `index.html`, and `style.css` provide the static project catalog.
- `scripts/` discovers and runs project verification without merging project internals.
- `tests/` validates catalog integrity.
- `projects/` contains independently documented and tested tools.

Never execute repository content being inspected by one of the CLI tools. Preserve local-first and no-telemetry behavior. After changes, run the affected project's tests plus `npm run check` and `npm test`; run `npm run verify` before repository-wide changes.
