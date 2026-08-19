# Cookie Sentry

Audit `Set-Cookie` headers locally before shipping. Cookie Sentry checks Secure, HttpOnly, SameSite, Domain, expiry, `__Host-`/`__Secure-` prefixes, and Partitioned-cookie requirements. It can compare a previous snapshot, generate a hardened session template, and export a Markdown review.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/cookie-sentry/)

The parser accepts one `Set-Cookie` line per row and also includes a small `Cookie` request-header parser in the core API. Everything stays in the browser: no uploads, network requests, analytics, or runtime dependencies. This is a focused static audit, not a full browser cookie-store simulator; public-suffix validation and user-agent-specific quirks still need integration tests.

Run `npm test` for the dependency-free core suite.
