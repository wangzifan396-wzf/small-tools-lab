# Security policy

Regex Visualizer executes user-supplied regular expressions with the native
JavaScript engine. It is local-first and makes no network requests, but complex
patterns can still consume substantial CPU (regular-expression denial of
service). Do not run untrusted patterns against large text in a shared server.

Report suspected vulnerabilities privately through the repository's
[security policy](../../SECURITY.md), with a minimal pattern and sample.
