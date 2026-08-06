# Security policy

Password Strength analyzes values locally and makes no network requests or
telemetry. Passing a password as a command-line argument can expose it through
shell history or process listings; use `--stdin` for sensitive values.

Report suspected vulnerabilities privately through the repository's
[security policy](../../SECURITY.md), with the affected input path and a
minimal reproduction that does not contain a real secret.
