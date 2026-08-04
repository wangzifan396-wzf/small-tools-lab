# Security policy

## Reporting a vulnerability

Use GitHub private vulnerability reporting for redaction bypasses, path traversal, report injection, unintended file inclusion, or command execution. Never paste an active credential or private context packet into a public issue.

Include the PatchBrief version, operating system, Git version, minimal synthetic reproduction, and expected behavior. You should receive an acknowledgement within seven days.

## Data handling

PatchBrief reads local Git metadata and text files, never executes repository code, and makes no network requests. Redaction is enabled by default but remains a safety layer, not a guarantee that every sensitive value can be recognized.
