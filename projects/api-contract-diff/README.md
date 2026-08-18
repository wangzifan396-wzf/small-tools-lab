# API Contract Diff

A local OpenAPI JSON compatibility checker for release reviews. Paste a baseline and candidate document to detect removed operations, required parameter and request-field changes, response status/schema breaks, enum narrowing, operation ID drift, and security requirement changes.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/api-contract-diff/)

The tool supports OpenAPI 3.x and Swagger 2.0-shaped documents, local `$ref` resolution, path-level parameters, Swagger body parameters, request/response schemas, severity filtering, and Markdown/JSON export. It is intentionally conservative: a breaking finding means a client may need code changes; review policy-specific compatibility rules before publishing.

Current boundaries: input is JSON rather than YAML, remote references are not fetched, the first declared media schema is compared, and composed/discriminator semantics still require a dedicated OpenAPI validator. These limits keep the page dependency-free and prevent unexpected network access.

Everything runs in the browser. No document, schema, endpoint, or telemetry leaves the page. Run `npm test` for the dependency-free core suite.
