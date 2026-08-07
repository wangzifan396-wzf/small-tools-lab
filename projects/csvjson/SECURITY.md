# Security

CSVJSON parses and serializes data locally and contains no network or telemetry code. Malformed quoted fields, duplicate headers, and inconsistent row widths are rejected instead of being silently truncated.

CSV files opened in spreadsheet applications can execute formulas when a cell begins with characters such as `=`, `+`, `-`, or `@`. This converter preserves source values and does not claim to sanitize spreadsheet formulas; review untrusted exports before opening them in a spreadsheet. Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md).
