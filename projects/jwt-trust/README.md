# JWT Trust

JWT Trust is a local-first workbench for verifying compact JWT signatures against pasted JWK/JWKS material and auditing token claims. It complements `jwtpeek`: decoding is not verification, and this project makes that trust boundary explicit.

## Features

- Verify HS256/384/512, RS256/384/512, PS256/384/512, and ES256/384/512 with Web Crypto.
- Select a key by `kid`, `alg`, and `use` without fetching `jku` or `x5u`.
- Audit `exp`, `nbf`, `iat`, `iss`, `aud`, and missing `kid` claims.
- Export a Markdown or JSON report locally.
- No telemetry, dependencies, build step, or network requests.

## Use

Open `index.html` from a local server or GitHub Pages, paste a compact JWT and a JWK/JWKS JSON object, then choose **Verify signature**. A JWK set should look like `{ "keys": [ ... ] }`; the tool never discovers or downloads keys.

This is an inspection aid, not an identity provider. A valid signature only proves possession of the selected key; your application still needs issuer, audience, authorization, replay, and key lifecycle policy.

## Tests

```bash
npm test
```

## License

MIT
