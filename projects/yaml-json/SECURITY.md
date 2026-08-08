# Security

YAML/JSON runs locally and has no network or telemetry code. Parsed mappings use null-prototype objects and own-property definitions, so keys such as `__proto__` remain ordinary data.

This is a deliberately small YAML subset, not a loader for trusted or untrusted full YAML. Anchors, aliases, tags, merge keys, block scalars, and multiple documents are rejected. Report vulnerabilities through the repository [security policy](../../SECURITY.md).
