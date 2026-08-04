# Security policy

## Reporting a vulnerability

Use GitHub private vulnerability reporting for unintended code execution, YAML parser abuse, path traversal, report injection, or unintended file access. Do not paste private workflow content or credentials into a public issue.

Include the Action Budget version, operating system, minimal synthetic workflow, command, and expected behavior. You should receive an acknowledgement within seven days.

## Data handling

Action Budget reads workflow YAML as data, never evaluates GitHub expressions or executes workflow steps, and makes no GitHub API requests. Reports include workflow filenames, job identifiers, runner labels, and reusable workflow references, so private-repository reports should remain private.
