# Security

JSON Format parses data locally with the built-in `JSON.parse` implementation and contains no network, telemetry, or code-evaluation path. Parsed keys are treated as data; recursive sorting builds null-prototype objects.

Do not paste secrets into tools you do not control. Report vulnerabilities through [SECURITY.md](../../SECURITY.md).
