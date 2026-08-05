# subzen

> Zero-dependency subtitle toolkit & quality linter with **first-class CJK
> (Chinese / Japanese / Korean) typography** support. Runs in Node.js and the
> browser.

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-93%20passing-brightgreen)](./test)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](#)

subzen does the boring parts of subtitle work for you: parse every common
format, **catch quality problems a human would miss**, auto-fix the fixable
ones, resync drift, merge bilingual tracks, and re-wrap lines so Chinese text
never breaks awkwardly. It is a single ES module with **no dependencies**, so it
drops into a Node script, a CI pipeline, or a `<script type="module">` tag
without a build step.

```bash
# lint a file (SRT / VTT / ASS / LRC / JSON auto-detected)
npx subzen lint subtitles.zh.srt

# auto-fix what can be fixed, write back
npx subzen fix subtitles.zh.srt -w

# convert and normalize punctuation/spacing in one shot
npx subzen convert eng.srt -as vtt -o eng.vtt
```

---

## Why subzen?

Most subtitle tooling assumes Latin text. For CJK subtitles that means:

- **Wrong line widths** — a Chinese character is 2 columns wide, but most
  tools count it as 1, so "max line width" limits are silently wrong.
- **Missing 盘古之白** — the space between CJK and Latin ("模型 model" vs
  "模型model") that Chinese typography expects.
- **Full-width punctuation slips** — half-width `,`/`.` sneaking into Chinese
  sentences, or full-width Latin (ＡＢＣ) from a mis-set IME.
- **Line breaks that split a sentence mid-thought** — no respect for
  kinsoku (禁則処理): a line should never *start* with `。` `、` `」`.

subzen models all of this. It is the linter we wished existed when shipping
Chinese/Japanese/Korean captions.

---

## Install

```bash
npm install subzen          # library
npm install -g subzen       # CLI
```

No dependencies, no native build, Node ≥ 18.

---

## CLI

```
subzen <command> [files...] [options]

Commands
  lint      Check files and print a report (exit 1 if errors).
  fix       Apply auto-fixes and print (or -w write) the result.
  convert   Parse one format and serialize another.
  shift     Offset every cue by a time delta.
  resync    Stretch/shrink the timeline from 2 matched anchors.
  fps       Convert frame-based times between frame rates.
  merge     Merge two tracks (e.g. zh + en) by time overlap.
  split     Split a bilingual track into two monolingual tracks.
  wrap      Re-wrap lines to a display width (CJK-aware).
  clean     Normalize spacing/punctuation without linting.
  stats     Print reading-speed & script statistics.
  rules     List every rule and its default severity.
  init      Write a .subzenrc from a preset.

Common options
  -a, --as <fmt>     Force input format (lint/fix) or output format (convert).
  -o, --out <file>   Write output to a file.
  -w, --write        Overwrite the input file in place.
  --preset <name>    recommended | strict | loose | cjk | netflix
  --rules <json>     Per-rule overrides, e.g. '{"max-cps":"off"}'
  --encoding <enc>   Fallback decode (utf8|gbk|gb18030|big5|shift-jis)
  --color <on|off>   Force colored output.
  -q, --quiet        Only print the report summary / errors.
  -h, --help         Show help (add a command for command help).
```

### Examples

```bash
# Lint with the CJK preset, surface warnings and errors
subzen lint drama.zh.srt --preset cjk

# Fix in place, then re-lint to confirm what's left
subzen fix drama.zh.srt -w --preset cjk
subzen lint drama.zh.srt --preset cjk

# Resync a track that drifts +1.2s over 50 minutes
subzen resync sub.srt 00:01:00,000 00:01:01,200 00:50:00,000 00:50:01,200 -o fixed.srt

# Merge Chinese + English into a stacked bilingual SRT
subzen merge zh.srt en.srt -o bilingual.srt

# Re-wrap a 40-character Chinese line to fit 2 lines of 18
subzen wrap long.zh.srt --width 18 --lines 2 -w
```

---

## Library

```js
import { parse, serialize, lint, fix, presets } from 'subzen';

const cues = parse(await readFile('ep01.zh.srt', 'utf8'));
const report = lint(cues, { preset: 'cjk' });
console.log(report.warningCount, 'warnings');

const { cues: fixed } = fix(cues, { preset: 'cjk' });
await writeFile('ep01.fixed.srt', serialize(fixed, 'srt'));
```

Every module is also importable directly for tree-shaking:

```js
import { parseTimecode, formatSrtTime } from 'subzen/src/core/timecode.js';
import { mergeBilingual } from 'subzen/src/core/bilingual.js';
import { computeStats } from 'subzen/src/core/stats.js';
```

See [`docs/rules.md`](./docs/rules.md) for the full rule reference and
[`docs/config.md`](./docs/config.md) for `.subzenrc` configuration.

---

## Rules

Rules carry a severity (`off` / `info` / `warn` / `error`) and some are
**auto-fixable**. Presets bundle sensible defaults:

| Preset        | Best for                                    |
| ------------- | ------------------------------------------- |
| `recommended` | General cleanup, safe fixes on.             |
| `cjk`         | Chinese/Japanese/Korean typography focus.   |
| `strict`      | Everything on, including style preferences. |
| `loose`       | Only hard errors.                           |
| `netflix`     | Netflix caption style guide heuristics.     |

Run `subzen rules --preset cjk` to see every rule with its severity and whether
it is fixable.

---

## Browser

subzen is plain ESM with no Node-only APIs in the core, so it runs in the
browser. A live playground lives in [`playground/`](./playground) — open
`playground/index.html` (or run `npm run playground` and visit the printed URL)
to paste subtitles and watch fixes happen live.

---

## Development

```bash
git clone <your-fork>
cd subzen
npm test            # node --test, 90+ cases, zero deps
npm run demo        # stats on the bundled example
npm run lint:self   # lint the bundled messy example
```

Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
