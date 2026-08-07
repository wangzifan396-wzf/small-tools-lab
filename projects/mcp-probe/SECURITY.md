# Security

MCP Probe spawns only the command explicitly supplied after `--`, with shell execution disabled. Starting a server still executes that program with the caller's permissions. Inspect unknown packages before probing them and use `--clean-env` or a sandbox when appropriate.

The probe performs initialization and capability-list operations only. It never calls tools, reads resources, or fetches prompt bodies. Responses are size- and timeout-bounded, and child processes are terminated when the probe ends.

Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md).
