# Security

SemVer Check runs locally, has no network or telemetry code, and does not execute version or range input. Numeric identifiers are compared as decimal strings, avoiding precision loss from unsafe JavaScript number conversion.

Range evaluation follows common SemVer range conventions and intentionally excludes prereleases unless a comparator explicitly references the same core version. Report vulnerabilities through the repository [security policy](../../SECURITY.md).
