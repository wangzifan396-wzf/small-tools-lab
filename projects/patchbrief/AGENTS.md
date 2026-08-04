# PatchBrief contributor guide

PatchBrief is a zero-dependency Node.js CLI. Keep runtime code compatible with Node.js 20. It must never execute code from the repository being inspected or send context over the network.

Core files:

- `src/builder.js` owns Git comparisons, context discovery, redaction, token estimation, and budget selection.
- `src/reporters.js` owns terminal, Markdown, XML, JSON, and self-contained HTML output.
- `bin/patchbrief.js` owns CLI parsing, configuration, file output, and exit codes.
- `scripts/demo.js` creates and deletes a disposable Git repository for the visual demo.
- `tests/` uses real temporary Git repositories and Node's built-in test runner.

After changes, run `npm run check`, `npm test`, and `npm run demo`. Preserve deterministic ordering, keep output within the requested budget, and add a regression test for every discovery or redaction change.
