# SRI Studio

Inspect HTML resource tags for [Subresource Integrity](https://www.w3.org/TR/SRI/) before shipping. SRI Studio extracts external scripts and stylesheets, validates SHA-256/384/512 expressions, checks cross-origin `crossorigin` configuration, flags insecure HTTP resources, compares HTML snapshots, and generates hashes from pasted bytes with Web Crypto.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/sri-studio/)

The page never fetches a resource or follows a pasted URL. HTML is treated as inert text; only resource tags are extracted. URL resolution is for classification, not network access. The checker is intentionally dependency-free and does not replace browser integration tests for redirects, MIME handling, CORS response headers, or deployment pipelines.

Run `npm test` for the core suite.
