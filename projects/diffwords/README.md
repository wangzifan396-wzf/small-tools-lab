# diffwords

> Word-level, **CJK-aware** text differ. Zero dependencies, runs in Node.js and
> the browser. Shows exactly what changed between two drafts.

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-36%20passing-brightgreen)](./test)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](#)

`diff` and `git diff` are line-oriented. For prose, docs and translated text
that is a blunt instrument: a one-word change rewrites the whole line, and for
**Chinese / Japanese / Korean** there are no word spaces at all, so a
character-level change is invisible at the line level. diffwords diffs at the
unit that actually matters — words for Latin text, characters for CJK — and
renders it four ways: terminal inline, unified, standalone HTML, and JSON.

```bash
# inline (default): deletions struck through, insertions added
npx diffwords draft-v1.txt draft-v2.txt

# classic unified diff
npx diffwords a.txt b.txt --unified

# a standalone, openable HTML report
npx diffwords zh-old.txt zh-new.txt --html review.html

# machine-readable
npx diffwords a.txt b.txt --json
```

---

## Why diffwords?

- **CJK-aware.** Chinese has no spaces, so the honest unit of change is the
  character. diffwords tokenises CJK runs per-character and Latin runs per-word,
  so a single 字 swapped shows as a single-character diff — not a whole-line
  rewrite.
- **Word-level for Latin.** `jumps` → `leaps` is one word swapped, not a line
  replaced.
- **Four renderers.** Inline (terminal), unified (patches/review), HTML
  (shareable report), JSON (tooling).
- **Zero dependencies.** Plain ES modules, no build step, drops into Node or a
  `<script type="module">`.

---

## Install

```bash
npm install diffwords       # library
npm install -g diffwords    # CLI
```

Node ≥ 18.

---

## CLI

```
diffwords <a> <b> [options]

  a, b     file paths, or "-" for stdin

Options
  -u, --unified     Classic unified diff (line hunks).
      --inline      Inline view: deletions struck, insertions added (default).
      --html [file] Standalone HTML diff (omit file for stdout).
      --side        Side-by-side layout for --html.
      --json        Machine-readable JSON (ops + stats).
      --stats       Print a token summary line.
      --context N   Context lines for --unified (default 3).
      --color on|off|auto
      --a-label S   Old-side label in unified output.
      --b-label S   New-side label in unified output.
  -h, --help
      --version
```

Exit code is `1` when the texts differ and `0` when they are identical — so it
slots into scripts and CI.

### Examples

```bash
diffwords old.md new.md --stats
diffwords a.txt b.txt --unified --context 1
diffwords zh-v1.txt zh-v2.txt --html --side report.html
cat old.md | diffwords - new.md --json
```

---

## Library

```js
import { diff, formatInline, formatUnified, formatHtml, formatJson } from 'diffwords';

const result = diff(originalText, revisedText);
console.log(result.stats);          // { unchanged, added, removed, similarity, ... }

process.stdout.write(formatInline(result));        // terminal
process.stdout.write(formatUnified(result));       // patch
```

Modules are importable directly for tree-shaking:

```js
import { tokenize, isCjk } from 'diffwords/src/core/tokenize.js';
import { diffArrays } from 'diffwords/src/core/lcs.js';
```

See [`docs/format.md`](./docs/format.md) for the output formats and the
`DiffResult` shape.

---

## Browser

diffwords has no Node-only dependencies in its core, so it runs in the browser.
A live playground lives in [`playground/`](./playground) — run
`npm run playground` and open the printed URL to paste two texts and watch the
diff render live (inline and side-by-side).

---

## Development

```bash
git clone <your-fork>
cd diffwords
npm test        # node --test, zero deps
npm run demo    # diff the bundled before/after examples
```

Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
