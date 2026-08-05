# quanty API reference

All functions are pure and throw `TypeError` for non-finite numeric input
(unless noted). `formatBytes` additionally throws `RangeError` for negative
byte counts.

## `formatBytes(bytes, options?)`

| Option     | Type      | Default | Notes                                                  |
| ---------- | --------- | ------- | ------------------------------------------------------ |
| `binary`   | `boolean` | `true`  | `true` → 1024-based (`B KiB MiB GiB …`); `false` → 1000-based (`B kB MB GB …`). |
| `decimals` | `number`  | `1`     | Fractional digits.                                     |
| `locale`   | `string`  | —       | BCP-47 tag. Decimal separator/grouping follow the locale. |
| `trimZero` | `boolean` | `true`  | Remove a trailing `.0`.                                |

The unit is chosen by repeatedly dividing by the base (1024 or 1000) until the
value is below the base or the largest unit is reached.

## `parseBytes(input)`

Inverse of `formatBytes`.

- Accepts `string` (e.g. `"1.5 KiB"`, `"1 MB"`, `"512"`) or `number`.
- Units are case-insensitive: `b kb kib mb mib gb gib tb tib pb pib eb eib`.
- Throws if the string cannot be parsed or the unit is unknown.

## `formatNumber(n, options?)`

| Option      | Type      | Default | Notes                                    |
| ----------- | --------- | ------- | ---------------------------------------- |
| `decimals`  | `number`  | `0`     | Fractional digits.                        |
| `thousands` | `boolean` | `true`  | Add `,` thousands separators.            |
| `locale`    | `string`  | —       | Delegate to `Intl.NumberFormat`.         |

## `formatCompact(n, options?)`

| Option     | Type          | Default | Notes                                          |
| ---------- | ------------- | ------- | ---------------------------------------------- |
| `style`    | `'si'\|'zh'`  | `'si'`  | `K/M/B/T` or `万/亿/万亿` threshold tables.     |
| `decimals` | `number`      | `1`     | Fractional digits.                             |

The Chinese table uses `万` (1e4), `亿` (1e8), `万亿` (1e12). This is a manual
implementation so the output is deterministic regardless of the host's ICU data.

## `ordinal(n, options?)`

`lang: 'en'` (default) appends `st`/`nd`/`rd`/`th` with the standard English
exception rules (11th, 12th, 13th). `lang: 'zh'` returns `第<n>`.

## Exit codes (CLI)

| Code | Meaning                              |
| ---- | ------------------------------------ |
| `0`  | Success.                             |
| `1`  | A command ran but its input was invalid. |
| `2`  | Unknown command or missing arguments. |
