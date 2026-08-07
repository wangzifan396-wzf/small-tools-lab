# Security

Port Origin executes only fixed read-only operating-system inventory commands. User input is parsed as a numeric port or PID and is never interpolated into a shell command. Child processes use argument arrays with shell execution disabled.

Command lines can contain secrets. The renderer masks common secret flags, URL credentials, and sensitive query parameters, but callers should still review reports before publishing them.

Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md).
