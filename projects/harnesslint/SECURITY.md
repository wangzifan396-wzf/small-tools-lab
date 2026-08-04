# Security policy

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for issues that could expose secrets, execute unintended commands, or make SARIF/HTML output unsafe. Do not open a public issue containing an active credential or private configuration.

Include the HarnessLint version, operating system, minimal reproduction, and expected behavior. You should receive an acknowledgement within seven days.

## Scope

HarnessLint performs local, read-only analysis except when explicitly asked to write a report or baseline. It never executes commands found in scanned files and does not make network requests.
