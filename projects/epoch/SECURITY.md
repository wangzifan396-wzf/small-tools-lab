# Security

Epoch performs all conversions locally and contains no network or telemetry code. Date strings and timestamps are treated as untrusted input and validated before conversion.

When embedding the library in another application, insert formatted values with `textContent` rather than raw HTML. Report vulnerabilities privately through the repository policy in [SECURITY.md](../../SECURITY.md).
