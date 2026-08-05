# Unit Convert

Zero-dependency unit converter. Ten categories — length, mass, temperature,
speed, data (decimal **and** binary), time, area, volume, energy, pressure —
for both the CLI and the browser. No native build, no network, works in Node
and the browser the same way.

## CLI

```bash
node bin/unit-convert.js 100 km mi        # 62.13711922 mi
node bin/unit-convert.js 0 C F            # 32 F
node bin/unit-convert.js 1 MB MiB        # 0.953674316 MiB  (decimal vs binary)
node bin/unit-convert.js --list           # every category and its units
node bin/unit-convert.js --cat length     # units in one category
```

Binary data units (`KiB`/`MiB`/`GiB`/`TiB`) use powers of 1024; decimal
(`KB`/`MB`/`GB`/`TB`) use powers of 1000 — the common source of off-by-7%
"missing" storage.

## Library

```js
import { convert, convertWithUnit } from './src/index.js';

convert(100, 'km', 'mi');                 // 62.1371192237334
convertWithUnit(0, 'C', 'F').formatted;   // "32 F"
```

Temperature is handled with offset math (C/F/K); every other category scales
through a base unit, so adding a new unit is a one-line factor.

## Browser

Open `playground/index.html` (or `start` to serve it) for a live converter with
two dropdowns and an instant result.

## Test

```bash
npm test     # node --test, zero dependencies
```
