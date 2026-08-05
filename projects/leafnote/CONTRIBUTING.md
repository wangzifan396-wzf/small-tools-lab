# Contributing to Leafnote

Thanks for your interest in improving Leafnote! This document explains how to
get set up and what we look for in contributions.

## Getting started

```bash
git clone https://github.com/your-org/leafnote.git
cd leafnote
npm test      # no install needed — zero runtime dependencies
npm run serve # open http://localhost:4173
```

## Ground rules

1. **Keep it dependency-free.** Leafnote deliberately has zero runtime
   dependencies. New features should not introduce npm packages unless there
   is a very strong reason. Core modules (`util`, `markdown`, `search`,
   `store`) must stay free of DOM access so they keep running under
   `node --test`.
2. **Tests for behavior.** Add or update a `test/*.test.js` case for any
   logic change. Run `npm test` and make sure all green before opening a PR.
3. **XSS safety is non-negotiable.** Any HTML emitted from Markdown must go
   through `escapeHtml`, and URLs must pass through `sanitizeUrl`. Don't
   introduce `innerHTML` from untrusted strings elsewhere.
4. **Single-file build must stay clean.** After changing `src/`, run
   `npm run build` and confirm `dist/leafnote.html` opens and works. The
   bundle must not contain stray top-level `import`/`export` statements.

## Making a change

- Fork the repo and create a branch (`feat/...`, `fix/...`).
- Keep commits focused and write clear messages.
- Run `npm test` and `npm run build`.
- Open a pull request against `main` and fill in the template.

## Reporting bugs / ideas

Use the issue templates. For security issues, please disclose privately
rather than opening a public issue.

## Code style

- 2-space indent, LF line endings (see `.editorconfig`).
- Plain ES modules; no transpiler required.
- Prefer small, pure, well-named functions.

Happy hacking! 🌿
