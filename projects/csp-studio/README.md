# CSP Studio

A local Content Security Policy parser, auditor, effective-directive explorer, URL simulator and hardened-policy generator.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/csp-studio/)

It checks unsafe inline/eval execution, broad wildcards, active `data:` content, insecure schemes, mixed `'none'`, incomplete `strict-dynamic`, and missing `default-src`, `object-src`, `base-uri`, `frame-ancestors`, or `form-action`. The simulator implements the important CSP3 fetch-directive fallback chains and common host/scheme/self matching.

This is a practical design tool, not a browser conformance engine. Redirects, paths, opaque origins, nonces/hashes for inline execution, multiple-policy intersection and browser-version differences require real browser testing. Generated nonces are placeholders and must be unpredictable per response.

Run `npm test` for the dependency-free core test suite.
