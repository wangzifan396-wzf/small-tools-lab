# Contributing to subzen

Thanks for considering a contribution. subzen aims to stay **zero-dependency**
and **CJK-aware** — keep those two promises and most PRs are welcome.

## Getting started

```bash
git clone https://github.com/<you>/subzen
cd subzen
npm test          # node --test, no install step, no deps
```

There is no build step. The library is plain ES modules under `src/` and the
CLI is `bin/subzen.js` → `src/cli.js`.

## Project layout

```
src/
  core/        timecode, cue, text (CJK analysis), wrap, lint, transform,
               bilingual, stats, report, colors
  formats/     srt, vtt, ass, lrc, json, index (registry + detect)
  rules/       timing, layout, cjk, index (registry + presets)
  cli.js       the command-line surface (only module that touches the FS)
  index.js     public API barrel
test/          node:test cases, one file per module
examples/      sample subtitles used by tests and docs
playground/    browser demo (no build)
```

## Adding a rule

1. Add the rule object to `src/rules/<group>.js`. A rule needs `id`,
   `description`, `severity`, and a `check(cues, options)` returning
   diagnostics. Add a `fix(cues, options)` if it is auto-fixable.
2. If it is auto-fixable, add its id to `fixOrder` in `src/rules/index.js` in
   the right place (text normalisation before re-wrap, re-wrap before timing).
3. Add it to the relevant preset in `src/rules/index.js` if it should be on by
   default somewhere.
4. Add tests in `test/rules.test.js` and document it in `docs/rules.md`.
5. Run `npm test` and `npm run lint:self`.

### Diagnostic shape

```js
{ cue, line?, message, fixable, data? }
```

`line` is 1-based when the problem is on a specific line. `data.suggestion`
holds the corrected line/text when available — the playground shows it.

## Style

- ES modules, no CommonJS, no dependencies.
- JSDoc the exported functions; TypeScript users consume `types/index.d.ts`.
- Keep the CLI the only module that imports `node:fs` / `node:path`.
- Chinese text in examples should stay real and respectful.

## Commit / PR

- Small, focused commits.
- `npm test` must be green.
- Describe the *why* in the PR body, especially for threshold changes.

## Reporting bugs

Open an issue with the subtitle snippet (anonymised), the command you ran, and
the output. A failing test case is the fastest path to a fix.
