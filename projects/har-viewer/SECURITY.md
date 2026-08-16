# Security

HAR Viewer treats every imported capture as untrusted and sensitive input.

- Files are parsed in the browser and are never uploaded, fetched, persisted, or sent to analytics.
- The page uses a Content Security Policy with `connect-src 'none'`, no runtime dependencies, and no external assets.
- Capture-controlled strings are rendered with `textContent` or equivalent text nodes, never interpreted as HTML.
- Waterfall graphics are created as native SVG elements; imported SVG or response bodies are never rendered.
- The interface rejects files larger than 25 MB to reduce accidental browser exhaustion. JSON parsing still requires memory proportional to the capture size.
- CSV cells are quoted, and values beginning with spreadsheet formula markers are prefixed defensively.
- The default redacted export removes request and response body text plus network-address metadata, then replaces common credential, cookie, and secret values.

Redaction cannot recognize arbitrary business-specific secret names or make an internal capture safe for public release. Review the exported file, prefer a minimum reproduction, and share it only with intended recipients.

Report vulnerabilities through the repository's private security reporting channel instead of a public issue.
