# Security policy

## Reporting

Use GitHub private vulnerability reporting for code execution, path traversal, credential disclosure, report injection, dependency compromise, or unsafe handling of local data. Do not place active credentials, private screenshots, context packets, or knowledge-base documents in a public issue.

Include the affected project folder, version or commit, operating system, minimal synthetic reproduction, and expected behavior. You should receive an acknowledgement within seven days.

## Data boundaries

Browser tools are designed to process data locally and do not include telemetry. Developer CLIs read repository files but must not execute inspected code or upload it. Local AI projects may contact Ollama on the local machine; Screenshot QA contacts DeepSeek only when that provider is explicitly selected. Review each project README before using private data.
