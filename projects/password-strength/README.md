# Password Strength

Zero-dependency password strength analyzer. Estimates entropy from the
character-class pool, derives a 0–4 score, gives a rough offline crack-time
estimate, and lists concrete weaknesses — in the CLI and the browser. No native
build, no network, works in Node and the browser the same way.

## CLI

```bash
node bin/password-strength.js "Tr0ub4dour&9"
printf '%s' "Tr0ub4dour&9" | node bin/password-strength.js --stdin
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
estimate assumes `1e10` guesses/sec offline. This is a transparent heuristic,
not a password-cracking guarantee; common and obviously patterned passwords are
conservatively capped at low scores. Prefer a password manager for real secrets.

## Browser

Run `npm start`, then open <http://localhost:4173/>. The hosted version is
available from the [Small Tools Lab catalog](https://wangzifan396-wzf.github.io/small-tools-lab/).
The browser never sends or stores the password.

## Test

```bash
npm test     # node --test, zero dependencies
```
