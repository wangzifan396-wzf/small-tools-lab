# Header Sentinel

A local HTTP response security-header auditor and release-drift comparator. Paste a raw response header block to check HSTS, MIME sniffing, enforced CSP and anti-framing, Referrer Policy, Permissions Policy, CORS credentials, sensitive caching, disclosure fields, and COOP/COEP/CORP isolation readiness.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/header-sentinel/)

Header Sentinel supports HTML and API/asset contexts, an explicit sensitive-response mode, an optional cross-origin-isolation gate, contextual baseline generation, snapshot comparison, severity/search filters, and Markdown/JSON export. Everything runs in browser memory with no network requests, analytics, external assets, or runtime dependencies.

The rules follow the current [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html) and relevant MDN guidance such as [Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security) and [Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy). Generated values are a starting baseline, not a substitute for application-specific CSP, CORS, embedding, caching, or subdomain rollout review.

Run `npm test` for the dependency-free core suite.
