# OpenAPI Lab

A local-first OpenAPI 3 explorer and request code generator. Paste or drop an OpenAPI document, inspect structural findings and operations, then generate working curl, browser Fetch, or Python requests with examples derived from the schemas.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/openapi-lab/)

## Why it exists

Large API descriptions are difficult to review as raw YAML. Hosted documentation platforms can also be the wrong place for private or pre-release contracts. OpenAPI Lab runs entirely in the browser: it does not upload the description, fetch external references, send generated requests, or require an account.

## Features

- OpenAPI 3.0.x and 3.1.x structural validation
- JSON and a strict, safe YAML subset
- Searchable operation catalog with method filters
- Path Item and Operation parameter merging
- Local JSON Pointer `$ref` resolution with broken/cyclic-reference detection
- Server variable defaults and operation/path/root server precedence
- Examples derived from schemas, references, `allOf`, `oneOf`, arrays, enums, formats, defaults, and explicit examples
- Path, query, header, and cookie parameter examples
- Common OpenAPI query serialization: `form`, exploded arrays/objects, and `deepObject`
- API key, HTTP Basic, Bearer, OAuth 2, and OpenID Connect credential placeholders
- JSON, URL-encoded, multipart, and text request bodies
- curl, Fetch, and Python Requests code generation
- File input and drag-and-drop, capped at 5 MB
- No runtime dependencies and no network requests

## Supported input

JSON documents follow the complete JSON grammar. YAML input uses the repository's hardened YAML subset parser. It supports the mappings, sequences, quoted/plain scalars, and flow collections used by typical OpenAPI documents. Anchors, aliases, tags, merge keys, block scalars, tabs, and multiple YAML documents are rejected rather than interpreted ambiguously.

External `$ref` values are reported as warnings but are never fetched. This is deliberate: automatically resolving them could disclose private document URLs or credentials and would make offline results depend on mutable network state.

## Scope

This is a practical contract explorer, not a full OpenAPI conformance validator. It checks the high-value structural rules needed for browsing and generation. Advanced parameter styles, callbacks, links, webhooks, XML encoding, discriminators, OAuth flows, and JSON Schema validation are displayed only where they affect the supported workflow.

Generated authentication values are visible placeholders such as `YOUR_API_KEY`; OpenAPI documents should not contain real secrets.

## Development

```bash
npm test
```

The reusable UMD core is in `src/core.js`. The browser controller is `src/app.mjs`, and the test suite covers validation, references, schema examples, serialization, authentication, request bodies, and generated source syntax.
