# quanty

[![npm](https://img.shields.io/badge/npm-quanty-blue.svg)](https://www.npmjs.com/package/quanty)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)

**Zero-dependency number & byte formatting toolkit.**

Format byte counts (`formatBytes` / `parseBytes`), group and round numbers
(`formatNumber`), produce compact notation in either SI (`1.5M`) or Chinese
(`150万`) thresholds (`formatCompact`), and add ordinal suffixes (`1st`, `第22`).
Works as a library, a CLI, and directly in the browser — no build step, no
dependencies.

```js
import { formatBytes, parseBytes, formatNumber, formatCompact, ordinal } from 'quanty';

formatBytes(1536);                 // "1.5 KiB"
formatBytes(1500000, { binary: false }); // "1.5 MB"
parseBytes('1.5 KiB');             // 1536  (round-trips formatBytes)
formatNumber(1234567);             // "1,234,567"
formatCompact(1500000, { style: 'zh' }); // "150万"
ordinal(22, { lang: 'zh' });       // "第22"
```

## Install

```bash
npm install quanty
```

No dependencies are installed. For a quick try, run the CLI with `npx`:

```bash
npx quanty bytes 1536
```

## Library usage

### `formatBytes(bytes, options?)`

| Option       | Type      | Default | Description                                            |
| ------------ | --------- | ------- | ------------------------------------------------------ |
| `binary`     | `boolean` | `true`  | 1024-based units (`KiB`) when `true`; 1000-based (`kB`) when `false`. |
| `decimals`   | `number`  | `1`     | Fractional digits.                                     |
| `locale`     | `string`  | —       | BCP-47 tag; decimal/grouping follow the locale.        |
| `trimZero`   | `boolean` | `true`  | Drop a trailing `.0`.                                  |

Throws `TypeError` for non-finite input and `RangeError` for negative bytes.

### `parseBytes(input)`

Inverse of `formatBytes`. Accepts strings like `"1.5 KiB"`, `"1 MB"`, `"512"`,
or a plain number. Case-insensitive units.

### `formatNumber(n, options?)`

| Option      | Type      | Default | Description                              |
| ----------- | --------- | ------- | ---------------------------------------- |
| `decimals`  | `number`  | `0`     | Fractional digits.                        |
| `thousands` | `boolean` | `true`  | Add thousands separators.                 |
| `locale`    | `string`  | —       | Delegate to `Intl.NumberFormat`.         |

### `formatCompact(n, options?)`

| Option     | Type           | Default | Description                                    |
| ---------- | -------------- | ------- | ---------------------------------------------- |
| `style`    | `'si'\|'zh'`   | `'si'`  | `K/M/B/T` (si) or `万/亿/万亿` (zh) thresholds.|
| `decimals` | `number`       | `1`     | Fractional digits.                             |

### `ordinal(n, options?)`

`lang: 'en'` (default) → `1st`/`2nd`/`3rd`/`4th`; `lang: 'zh'` → `第1`/`第22`.

## CLI

```bash
quanty bytes 1536                 # 1.5 KiB
quanty bytes 1500000 --si         # 1.5 MB
quanty parse "1.5 KiB"            # 1536
quanty number 1234567 --locale de-DE   # 1.234.567
quanty compact 1500000 --style zh      # 150万
quanty ordinal 22 --lang zh       # 第22
quanty --help
```

## Browser

This package is native ESM with no dependencies, so it loads straight into a
browser `<script type="module">`:

```html
<script type="module">
  import { formatBytes } from '../src/index.js';
  document.body.textContent = formatBytes(1536);
</script>
```

Or open the live playground:

```bash
npm run playground   # → http://localhost:4173/
```

## Development

```bash
node --test "test/*.test.js"   # run tests
npm run demo                   # a few example invocations
```

## License

[MIT](./LICENSE)
