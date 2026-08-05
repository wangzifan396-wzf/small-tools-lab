# Rule reference

subzen ships **21 rules** in three groups: timing, layout, and CJK typography.
Each rule has a default severity and a `fixable` flag. Presets turn rules on or
off and can pass rule-specific options.

- **Severity**: `off` · `info` · `warn` · `error`
- **Fixable**: an ✅ means `subzen fix` can resolve it automatically.

## Timing

| Rule             | Default     | Fix | Description                                                              | Options            |
| ---------------- | ----------- | --- | ------------------------------------------------------------------------ | ------------------ |
| `time-order`     | `error`     |     | A cue must end after it starts.                                          | —                  |
| `negative-time`  | `error`     | ✅  | Timecodes must not be negative.                                          | —                  |
| `no-overlap`     | `error`     | ✅  | Consecutive cues must not overlap in time.                               | `minGap`           |
| `min-gap`        | `warn`      | ✅  | Leave a small gap between cues so the render does not flicker.           | `min` (84ms)       |
| `min-duration`   | `warn`      | ✅  | A cue that flashes by is worse than no cue.                              | `min` (833ms)      |
| `max-duration`   | `warn`      |     | A cue lingering too long usually means two cues were merged.            | `max` (7000ms)     |
| `max-cps`        | `warn`      |     | Reading speed; CJK and Latin get separate budgets so mixed lines are fair. | `cjkCps` (9), `latinCps` (20) |

## Layout

| Rule                  | Default | Fix | Description                                                       | Options              |
| --------------------- | ------- | --- | ----------------------------------------------------------------- | -------------------- |
| `no-empty-cue`        | `warn`  | ✅  | A cue with no visible text wastes a slot.                         | —                    |
| `max-lines`           | `warn`  | ✅  | Two lines is the ceiling; three is a wall of text.                 | `max` (2), `width`   |
| `max-line-width`      | `warn`  | ✅  | Line length in **display columns** — a CJK char counts as 2.       | `max` (40), `maxLines` |
| `no-markup`           | `info`  | ✅  | Styling tags left in the text (often a bad conversion).           | —                    |
| `trailing-whitespace` | `info`  | ✅  | Leading/trailing spaces shift text off-centre.                    | —                    |
| `no-duplicate-adjacent` | `warn` | ✅ | Same text repeated back to back (ASR/merge artefact).             | `maxGap` (500ms)     |
| `gap-too-long`        | `off`   |     | A long silence may mean a missing translation.                    | `max` (30000ms)      |

## CJK typography

These rules stay silent on tracks with no CJK text, and every one is
autofixable. They are the reason subzen exists.

| Rule                  | Default | Fix | Description                                                          | Options |
| --------------------- | ------- | --- | -------------------------------------------------------------------- | ------- |
| `cjk-latin-spacing`   | `warn`  | ✅  | Insert a space between CJK and Latin text (盘古之白).                | —       |
| `cjk-punctuation-width` | `warn` | ✅  | Use full-width punctuation inside CJK (，。！？ not ,.!?).           | —       |
| `no-fullwidth-latin`  | `warn`  | ✅  | Full-width Latin/digits (Ａ１) are almost always an IME slip.        | —       |
| `no-cjk-space`        | `warn`  | ✅  | Remove stray spaces between two CJK characters.                      | —       |
| `ellipsis-style`      | `info`  | ✅  | Normalise `...` / `。。。 ` to a proper ellipsis.                    | —       |
| `no-line-end-period`  | `info`  | ✅  | Drop the trailing full stop on the last line of a cue.              | —       |
| `cjk-line-start`      | `warn`  | ✅  | A wrapped line must not start with closing punctuation (行首禁则).  | —       |

## Autofix order

`fix` applies rules in a deliberate order so each stage sees clean input from
the one before it:

```
no-markup → trailing-whitespace → no-fullwidth-latin → no-cjk-space
→ cjk-punctuation-width → cjk-latin-spacing → ellipsis-style
→ no-line-end-period → no-empty-cue → no-duplicate-adjacent
→ max-lines → max-line-width → cjk-line-start
→ negative-time → no-overlap → min-gap → min-duration
```

Text normalisation runs before re-wrapping, and re-wrapping before timing
repair — so by the time widths are recomputed the punctuation and spacing are
already correct.

## Presets

| Preset        | Notes                                                          |
| ------------- | ------------------------------------------------------------- |
| `recommended` | Balanced defaults; safe fixes on, `no-markup`/`gap-too-long` off. |
| `cjk`         | Tuned for Chinese/Japanese/Korean; width cap = 32 columns (16 full-width chars). |
| `strict`      | Everything on, tighter thresholds — a good CI gate.           |
| `loose`       | Only what breaks playback (timing + ordering).                |
| `netflix`     | Approximates the Netflix timed-text style guide.              |

See [`config.md`](./config.md) for how to override rules per project.
