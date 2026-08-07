# Security

UUID Gen requires `crypto.getRandomValues` and deliberately has no `Math.random` fallback. It performs all generation locally and contains no network or telemetry code.

Random UUIDs are identifiers, not authentication secrets. Do not use them as passwords, API keys, or proof of authorization. Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md).
