# Security

Password Generator runs locally and has no network or telemetry code. It requires Web Crypto, draws unbiased integers with rejection sampling, guarantees every enabled character set, and uses a cryptographically secure Fisher-Yates shuffle. It never falls back to `Math.random`.

The displayed entropy is an estimate based on length and selected alphabet size, not a password-strength audit. Generated passwords can still be exposed through clipboard history, screenshots, browser extensions, or a compromised device. Report vulnerabilities through the repository [security policy](../../SECURITY.md).
