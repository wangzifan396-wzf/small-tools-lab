# ULID Toolkit

Spec-strict, cryptographically secure ULID generation and decoding for browsers and Node.js 20+, with a clock-rollback-safe monotonic factory.

[Open the browser tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/ulid/) · [Canonical ULID specification](https://github.com/ulid/spec) · [Security notes](SECURITY.md)

## Guarantees

- Enforces the 48-bit millisecond timestamp and 80-bit randomness limits
- Requires Web Crypto and never falls back to `Math.random`
- Rejects overflowed first characters and non-Crockford symbols
- Accepts lowercase input while returning canonical uppercase ULIDs
- Monotonic mode increments randomness within a millisecond and remains ordered if the clock moves backward
- Supports deterministic crypto injection for tests

## Library API

```js
import { createMonotonicFactory, decodeUlid, generateUlid } from './src/index.js';

const id = generateUlid();
const decoded = decodeUlid(id);

const monotonic = createMonotonicFactory();
monotonic();
monotonic(); // lexicographically greater, even in the same millisecond
```

Low-level Crockford helpers and compatibility aliases (`generate`, `decode`, `isValid`) are also exported. TypeScript declarations are included.

ULIDs expose their creation timestamp and are identifiers, not secrets or authentication tokens.

## Develop

```bash
npm test
npm start -- 4173
```
