# Security

SBOM Atlas treats every imported document as untrusted and potentially confidential.

- Documents are parsed in the browser and are never uploaded, fetched, persisted, or sent to analytics.
- The page has no runtime dependencies or external assets and uses a Content Security Policy with `connect-src 'none'`.
- Document-controlled strings are rendered with `textContent` and related text-node APIs, never interpreted as markup.
- External references, package URLs, CPEs, repository URLs, and vulnerability references are displayed but never opened or resolved automatically.
- The interface limits files to 20 MB. JSON parsing and graph analysis still require memory proportional to document size.
- Dependency-cycle detection is iterative and graph traversal visits each normalized identifier once, reducing stack-exhaustion exposure from deeply nested dependency graphs.
- CSV cells are quoted and values beginning with spreadsheet formula markers are prefixed defensively.

SBOM Atlas does not redact imported inventories. CSV exports still contain component identifiers, versions, package URLs, suppliers, licenses, and other selected metadata. Review exports before sharing them.

Report vulnerabilities through the repository's private security reporting channel rather than a public issue.
