# hashforge

Zero-dependency hashing, HMAC and codec toolkit. Compute **SHA-1 / SHA-256 /
SHA-384 / SHA-512** digests and **HMAC**, and encode/decode **base64 / hex** —
all built on the Web Crypto API so the same code runs in Node 18+ and in the
browser with **no dependencies and no build step**.

```js
import { hashText, hmacText, encode, decode, verify } from 'hashforge';

await hashText('abc', 'sha256');   // "ba7816bf…f20015ad"
await hmacText('msg', 'key', 'sha256');
encode('hi', 'base64');            // "aGk="
decode('aGk=', 'base64');          // "hi"
verify(expectedHex, actualHex);    // true / false
```

## Install

```bash
npm install hashforge
```

No dependencies are installed. Or try the CLI with `npx`:

```bash
npx hashforge hash "hello"
```

## Library

| Function | Returns | Notes |
| --- | --- | --- |
| `hashText(text, algo?)` | `Promise<string>` | hex digest of a UTF-8 string (default `sha256`). |
| `hashBytes(bytes, algo?)` | `Promise<string>` | hex digest of `Uint8Array` / `ArrayBuffer`. |
| `hashFile(path, algo?)` | `Promise<string>` | Node only — reads & hashes a file. |
| `hmacText(text, secret, algo?)` | `Promise<string>` | HMAC-SHA hex of a string. |
| `hmac(algo, secret, message)` | `Promise<string>` | HMAC over bytes. |
| `encode(text, enc?)` | `string` | `base64` (default) or `hex`. |
| `decode(str, enc?)` | `string` | inverse of `encode`. |
| `verify(expected, actual)` | `boolean` | case/whitespace-insensitive digest compare. |

MD5 is intentionally omitted (insecure, and unavailable in Web Crypto).

## CLI

```bash
hashforge hash  "hello"                  # sha256 hex
hashforge hash  "hello" --algo sha512    # sha512 hex
hashforge hmac  "msg"  --secret key      # hmac-sha256 hex
hashforge encode "hi"   --enc base64     # aGk=
hashforge decode "aGk=" --enc base64     # hi
hashforge file  ./build.zip --algo sha256
hashforge check ./build.zip <expected-hex>   # OK | MISMATCH
hashforge --help
```

## Browser

Native ESM + Web Crypto — drop it into a `<script type="module">`:

```html
<script type="module">
  import { hashText } from '../src/index.js';
  const d = await hashText('hello', 'sha256');
  document.body.textContent = d;
</script>
```

Or open the live playground:

```bash
npm run playground   # → http://localhost:4173/
```

## Develop

```bash
node --test "test/*.test.js"   # run tests
npm run demo                   # a couple of example calls
```

## License

[MIT](./LICENSE)
