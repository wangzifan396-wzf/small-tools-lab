# Security policy

## Reporting a vulnerability

Use GitHub private vulnerability reporting for secret disclosure, report injection, path traversal, unintended file inclusion, or command execution. Do not include active credentials or private repository contents in a public issue.

Include the Env Matrix version, operating system, minimal synthetic reproduction, output format, and expected behavior. You should receive an acknowledgement within seven days.

## Data handling

Env Matrix reads local text files and Git's publish set, does not execute inspected source code, and makes no network requests. Values associated with sensitive variable names are redacted in returned report data. Name-based detection cannot identify every business secret, so reports should still be handled according to the repository's confidentiality.
