# Security

Base64 runs locally and contains no network or telemetry code. Decoding uses a fatal UTF-8 decoder so malformed byte sequences are rejected instead of silently replaced.

Base64 is an encoding, not encryption. Never treat encoded credentials or personal data as protected. Report vulnerabilities through [SECURITY.md](../../SECURITY.md).
