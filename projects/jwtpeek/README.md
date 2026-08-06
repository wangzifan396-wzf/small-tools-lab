# jwtpeek

Zero-dependency **JWT decoder**. Paste a JSON Web Token and instantly see its
header, payload, signature, and expiry timing — entirely in your browser or
from the CLI. No network, no dependencies, no build step.

> ⚠️ **Inspection only.** jwtpeek decodes tokens; it does **not** verify
> signatures. Anyone can forge a token, so never trust identity based on a
> decoded JWT alone.

## Features

- Decode `header.payload.signature` (base64url) with UTF-8 safe parsing
- Show `exp` / `iat` / `nbf` as human-readable UTC times
- A clear verdict: **valid** · **expired** · **not-yet** (nbf) · **no-exp**
- Handles unsigned tokens (empty signature) gracefully
- CLI + browser playground — same logic, zero dependencies

## Browser

Open `index.html` directly (double-click) or run a local server:

```bash
node playground/serve.js      # or: npm start
# → http://localhost:4173/
```

## CLI

```bash
jwtpeek "<token>"                 # decode + summary
jwtpeek "<token>" --json          # full parse as JSON
jwtpeek "<token>" --header        # header only
jwtpeek "<token>" --payload       # payload only
jwtpeek --help
```

## API

```js
import { parse, summarize, b64urlDecode } from "jwtpeek";

const r = parse(token);
// r.valid, r.header, r.payload, r.hasSignature, r.timing.status ...

const { code, out } = summarize(token);
```

`timing.status` is one of `valid` | `expired` | `not-yet` | `no-exp`.

## Tests

```bash
npm test
```

## License

MIT
