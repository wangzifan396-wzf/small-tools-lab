# Security

Query Parse runs locally and has no network or telemetry code. The browser interface constructs editable rows with DOM APIs and assigns user data through `textContent` or input values; query input is never interpolated into HTML.

Malformed percent encoding and unpaired Unicode surrogates are rejected explicitly. Object conversion uses a null prototype and own-property definitions so keys such as `__proto__` cannot mutate prototypes. Report vulnerabilities through the repository [security policy](../../SECURITY.md).
