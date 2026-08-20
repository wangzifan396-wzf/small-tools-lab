# Security notes

- JWTs and key material are processed in memory in the current browser tab.
- The application has `connect-src 'none'` and does not fetch remote JWKS, `jku`, or `x5u` values.
- Do not paste production bearer tokens into shared computers, recordings, or issue trackers.
- Verification is only as trustworthy as the JWK supplied and the issuer/audience policy you configure.

Please report a reproducible security issue privately before opening a public issue.
