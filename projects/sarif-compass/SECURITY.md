# Security

SARIF Compass treats every imported report as untrusted and potentially confidential.

- Reports are parsed locally and are never uploaded, fetched, persisted, or sent to analytics.
- The page has no runtime dependencies or external assets and enforces `connect-src 'none'` through Content Security Policy.
- Report-controlled strings, Markdown, snippets, paths, rule help, and code-flow messages are rendered as text, never interpreted as HTML.
- Artifact and help URIs are displayed but never opened or resolved over the network.
- Usernames and passwords are removed from resolved artifact URLs before display.
- The browser limits imported files to 25 MB; parsing still requires memory proportional to the JSON and normalized result count.
- CSV cells are quoted and formula-leading values receive a defensive prefix.
- The privacy-clean exporter removes common source, invocation, environment, web-traffic, fix, attachment, URI-base, and URI-secret surfaces.

Custom properties and result messages can still contain organization-specific secrets. Review privacy-clean exports before sharing them outside the intended audience.

Report vulnerabilities through the repository's private security reporting channel instead of a public issue.
