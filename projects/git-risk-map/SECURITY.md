# Security policy

## Reporting a vulnerability

Use GitHub private vulnerability reporting for command injection, unsafe path handling, report injection, or unintended disclosure. Do not include private repository contents in a public issue.

Include the Git Risk Map version, operating system, Git version, minimal redacted reproduction, and expected behavior. You should receive an acknowledgement within seven days.

## Data handling

Git Risk Map runs locally. It reads Git metadata and changed files for line counts, never executes repository code, and makes no network requests. It writes only the output file explicitly requested by the user.
