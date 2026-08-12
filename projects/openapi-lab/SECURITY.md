# Security

OpenAPI Lab treats every imported document as untrusted data.

- Documents are parsed locally and are never uploaded.
- External `$ref` URLs are not fetched.
- Document-controlled strings are rendered with `textContent`; they are not inserted as HTML.
- Markdown and HTML inside descriptions are displayed as plain text.
- Generated code contains visible credential placeholders, never stored credentials.
- Files larger than 5 MB are rejected by the browser interface.
- The YAML subset rejects executable/custom tags, aliases, merge keys, duplicate keys, and prototype-polluting mappings.

The generated requests are examples and are not executed by this tool. Review their URLs, parameters, credentials, and request bodies before running them.

Report vulnerabilities through the repository's private security reporting channel rather than a public issue.
