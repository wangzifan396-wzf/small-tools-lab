# Secure Password Generator

A browser and Node.js password generator built on Web Crypto, with unbiased sampling and explicit character-set guarantees.

[Open the browser tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/password-generator/) · [Security notes](SECURITY.md)

## Security properties

- Requires `crypto.getRandomValues`; never falls back to `Math.random`
- Uses rejection sampling, avoiding modulo bias
- Includes at least one character from every enabled set
- Uses a secure Fisher-Yates shuffle after satisfying set guarantees
- Can remove ambiguous characters such as `0`, `O`, `1`, `l`, and `I`
- Renders generated values with `textContent`, not HTML interpolation

## Library API

```js
import { estimateEntropy, generatePassword, generatePasswords } from './src/index.js';

generatePassword(24, { symbols: true, excludeAmbiguous: true });
generatePasswords(5, { length: 20, digits: true });
estimateEntropy(20); // approximate bits based on the selected alphabet
```

Also exported: `randomInt`, `buildCharacterSets`, and `classifyEntropy`. TypeScript declarations are included.

Entropy output is an estimate, not a password audit. Clipboard managers, screenshots, extensions, and compromised devices can still expose generated passwords.

## Develop

```bash
npm test
npm start -- 4173
```

Then open `http://localhost:4173`.
