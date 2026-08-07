# Security

Word Count analyzes text entirely in the browser and has no network or telemetry code. The UI renders statistics with DOM text nodes, so pasted HTML is never executed.

Applications embedding the library should preserve that boundary and avoid inserting untrusted source text with `innerHTML`. Report vulnerabilities privately through the repository policy in [SECURITY.md](../../SECURITY.md).
