# Password Strength

Zero-dependency password strength analyzer. Estimates entropy from the
character-class pool, derives a 0–4 score, gives a rough offline crack-time
estimate, and lists concrete weaknesses — in the CLI and the browser. No native
build, no network, works in Node and the browser the same way.

## CLI

```bash
node bin/password-strength.js "Tr0ub4dour&9"
```

Prints score (0–4), entropy in bits, a rough crack-time estimate, the triggered
flags (too short, missing classes, sequential runs, repeats, common patterns),
and improvement suggestions.

## Library

```js
import { analyze } from './src/index.js';

analyze('Tr0ub4dour&9');
// { score, entropyBits, crackEstimate, timeToCrack, length, flags, suggestions }
```

Entropy assumes a pool per character class present — lower = 26, upper = 26,
digit = 10, symbol ≈ 32 — so `bits = length × log2(pool)`. The score bands are
`<28` → 0 (very weak), `<36` → 1, `<60` → 2, `<128` → 3, `>=128` → 4. The crack
estimate assumes `1e10` guesses/sec offline.

## Browser

Open `playground/index.html` directly (works over `file://`) or run `start`.
Live strength meter — per Chinese UI convention weak = red, strong = green —
entropy readout, checklist of met criteria, and suggestions.

## Test

```bash
npm test     # node --test, zero dependencies
```
