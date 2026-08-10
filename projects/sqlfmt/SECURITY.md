# Security

SQL Formatter runs locally and has no network, telemetry, database connection, or query execution code. Its lexer isolates quoted strings, quoted identifiers, PostgreSQL dollar strings, placeholders, and comments before formatting. Unterminated constructs and unbalanced parentheses are rejected with source locations.

This is a whitespace formatter, not a validating SQL parser. Always review formatted migrations and production queries, especially vendor-specific procedural syntax. Comment removal is opt-in because optimizer hints and executable comments can affect semantics. Report vulnerabilities through the repository [security policy](../../SECURITY.md).
