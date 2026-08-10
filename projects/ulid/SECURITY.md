# Security

ULID Toolkit runs locally and has no network or telemetry code. Generation requires Web Crypto (`crypto.getRandomValues`) and never falls back to `Math.random`. Timestamp and 80-bit randomness bounds are checked against the canonical ULID specification.

ULIDs are sortable identifiers, not secrets. Their first ten characters reveal creation time, and the random component is not an authentication token or encryption key. Report vulnerabilities through the repository [security policy](../../SECURITY.md).
