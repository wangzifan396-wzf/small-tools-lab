# Security

- Reports stay in the browser and are never uploaded or fetched.
- A strict Content Security Policy disables connections and external assets.
- Report strings are rendered as text, never HTML.
- Files larger than 25 MB are rejected by the interface.
- Privacy cleaning removes the highest-risk screenshots, diagnostic detail trees and URL secrets.
- CSV output quotes every cell and prefixes spreadsheet formula markers.

Reports can still reveal origins, scores and technology choices. Review exports before sharing. Report vulnerabilities through the repository's private security channel.
