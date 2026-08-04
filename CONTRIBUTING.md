# Contributing

Small Tools Lab accepts focused tools with a clear user job, an honest boundary, and a repeatable verification path.

## Project shape

Add each tool under `projects/<kebab-case-name>/`. A project should include:

- A README with the problem, quick start, limits, and license.
- Focused tests proportional to its risk.
- No committed secrets, local data, generated reports, or dependency directories.
- A browser entry point or CLI command that works as documented.
- A catalog entry in root `app.js`.

Projects may use different runtimes when the dependency cost is justified. Prefer static browser APIs and standard libraries for small utilities. Use established parsers or engines for structured formats and domain logic.

## Verification

```sh
npm install
npm run verify
npm run test:python
```

Run the affected project directly while developing. A pull request should explain why the tool belongs in the collection, what it deliberately does not support, and which fixtures prove its core behavior.
