# Configuration

subzen reads configuration from a `.subzenrc` (JSON or JSONC) or
`subzen.config.json` file, walking up from the current directory. A file in the
project root is enough; CI usually needs none.

## File

```jsonc
{
  // Base ruleset. One of: recommended | strict | loose | cjk | netflix
  "preset": "cjk",

  // Per-rule overrides. Value is a severity, or [severity, options].
  "rules": {
    "max-cps": "off",                       // turn a rule off
    "max-line-width": ["error", { "max": 30 }],
    "min-gap": ["warn", { "min": 120 }],
    "cjk-latin-spacing": "error"
  },

  // Defaults applied to every command when --encoding is not passed.
  "encoding": "utf8"
}
```

## Resolution order

Command-line flags win over the file, which wins over the preset's defaults:

1. `--preset` / `--rules` (CLI)
2. `.subzenrc` in the current or an ancestor directory
3. the preset named in that file (or `recommended` by default)
4. each rule's built-in default severity

So a project can pin `preset: cjk` in `.subzenrc` and still override a single
rule per-invocation with `--rules '{"max-cps":"off"}'`.

## Rule options

Pass rule-specific options as the second tuple element:

```jsonc
{
  "preset": "strict",
  "rules": {
    "min-duration": ["error", { "min": 1000 }],
    "max-duration": ["error", { "max": 6000 }],
    "max-cps": ["error", { "cjkCps": 8, "latinCps": 17 }],
    "max-line-width": ["error", { "max": 38 }],
    "max-lines": ["error", { "max": 2 }],
    "no-duplicate-adjacent": ["warn", { "maxGap": 300 }]
  }
}
```

Option reference:

| Rule                  | Option        | Meaning                                  | Default   |
| --------------------- | ------------- | ---------------------------------------- | --------- |
| `no-overlap`         | `minGap`      | Required gap between cues (ms).          | `0`       |
| `min-gap`            | `min`         | Minimum gap between cues (ms).           | `84`      |
| `min-duration`       | `min`         | Minimum cue duration (ms).               | `833`     |
| `max-duration`       | `max`         | Maximum cue duration (ms).               | `7000`    |
| `max-cps`            | `cjkCps`      | CJK reading-speed budget (chars/sec).    | `9`       |
| `max-cps`            | `latinCps`    | Latin reading-speed budget (chars/sec).  | `20`      |
| `max-lines`          | `max`         | Maximum visible lines per cue.           | `2`       |
| `max-lines`          | `width`       | Target column width when re-wrapping.    | `40`      |
| `max-line-width`     | `max`         | Maximum display columns per line.        | `40`      |
| `max-line-width`     | `maxLines`    | Lines to target when re-wrapping.         | `2`       |
| `no-duplicate-adjacent` | `maxGap`   | Max gap to still consider adjacent (ms).  | `500`     |
| `gap-too-long`       | `max`         | Silence length that triggers a warning.  | `30000`   |

## Scaffolding

```bash
subzen init --preset cjk > .subzenrc
```

writes a starting `.subzenrc` for the chosen preset. Edit it to taste.
