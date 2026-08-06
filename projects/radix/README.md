# radix

Zero-dependency **number base converter**. Convert between arbitrary bases
(2–36) with BigInt-exact math, and inspect the binary / octal / decimal / hex
forms plus a bit & byte view. CLI and browser playground, no dependencies, no
build step.

## Features

- Convert any value between bases 2–36
- BigInt-backed: very large numbers stay exact (no float rounding)
- One-shot view of binary / octal / decimal / hex
- Bit-width and byte-aligned view for the unsigned magnitude
- CLI + browser playground — same logic, zero dependencies

## Browser

Open `index.html` directly (double-click) or run a local server:

```bash
node playground/serve.js      # or: npm start
# → http://localhost:4173/
```

## CLI

```bash
radix <value> <fromBase> <toBase>   # convert
radix --all <value> <fromBase>      # show 2/8/10/16
radix --bits <value> <fromBase>     # binary + byte view
radix --help
```

Examples:

```bash
radix ff 16 10        # → 255
radix 255 10 16       # → ff
radix --all 255 10    # binary / octal / decimal / hex
```

## API

```js
import { convert, commonConversions, bitView } from "radix";

convert("ff", 16, 10);          // { value: "255", decimal: "255", ... }
commonConversions("255", 10);   // { binary, octal, decimal, hex }
bitView("255", 10);             // { binary, bits, byteLength, bytes }
```

## Tests

```bash
npm test
```

## License

MIT
