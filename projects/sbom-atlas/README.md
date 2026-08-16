# SBOM Atlas

A local-first CycloneDX and SPDX software bill of materials explorer. Normalize two major SBOM formats into one inventory, trace dependency paths, review structural and metadata gaps, inspect embedded vulnerability/VEX context, compare releases, and export a safe CSV without uploading the document.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/sbom-atlas/)

## Why it exists

SBOMs are designed for exchange, but raw JSON is difficult to review and may reveal private package names, internal suppliers, unreleased versions, repository locations, infrastructure, and vulnerability posture. SBOM Atlas runs entirely in the current browser tab. It has no account, backend, telemetry, external lookups, runtime dependencies, or network requests.

The project deliberately focuses on a gap left by many small viewers: one local interface for both CycloneDX and SPDX, plus structural diagnostics, dependency context, release-to-release comparison, and explicit metadata coverage.

## Supported input

- CycloneDX JSON 1.2 through 1.7
- SPDX JSON 2.2 and 2.3
- Files up to 20 MB in the browser interface

Newer or older compatible documents are parsed on a best-effort basis with a visible compatibility notice. XML, protobuf, tag/value SPDX, YAML, RDF, SPDX 3.x, attestations that merely wrap an SBOM, and external references are not resolved.

## Features

- CycloneDX `metadata.component`, nested component inventory, `bom-ref`, purl, CPE, supplier/manufacturer, licenses, hashes, scope, and external-reference normalization
- SPDX packages, `SPDXID`, `DESCRIBES`, `DESCRIBED_BY`, `DEPENDS_ON`, and the standard `*_DEPENDENCY_OF` relationship family
- Explicit roots with safe graph-based root inference when a document subject is absent
- Direct dependency and reverse-dependent browsing
- Shortest path from an inventory root to the selected component
- Iterative dependency-cycle detection that avoids recursive graph traversal limits
- Duplicate identifier, dangling dependency, invalid root, unknown vulnerability target, missing graph, and unreachable-component findings
- Separate version, license, purl, hash, and supplier coverage percentages
- CycloneDX vulnerability severity, score, affected component, and VEX analysis-state summaries
- Filters for text, component type, license state, graph reachability, and embedded vulnerability findings
- Release comparison for added, removed, version-changed, license-changed, hash-changed, and supplier-changed components
- Formula-injection-resistant CSV export of the filtered inventory
- Strict Content Security Policy and capture-controlled strings rendered only as text
- Responsive light and dark interfaces, plus built-in CycloneDX and SPDX samples

## What the findings mean

SBOM Atlas reports structural facts and metadata gaps, not whether software is safe or legally compliant. The top-level completeness figure is the simple average of five visible coverage percentages: version, declared license, purl, hash, and supplier. It is not a weighted risk score.

`NOASSERTION`, a missing license, and SPDX `NONE` remain distinct states. A license expression is displayed as document data; SBOM Atlas does not decide compatibility, obligations, policy approval, or whether a declaration is correct.

Embedded CycloneDX vulnerabilities are shown exactly as inventory context. The tool does not contact vulnerability databases, infer whether an absent advisory means a component is safe, verify VEX claims, or recalculate CVSS.

## Graph interpretation

CycloneDX dependency edges come only from the top-level `dependencies` graph. Nested `components` are included in the inventory but are not silently treated as runtime dependencies. SPDX edges come only from dependency relationship types. `CONTAINS`, `GENERATED_FROM`, and other relationships are not reinterpreted as dependencies.

When there is no explicit root, nodes with no incoming dependency edges are marked as inferred roots. This is useful for navigation but is not proof that those nodes are the intended document subjects.

## Comparison identity

Components are primarily matched by package URL with its version removed. Without a purl, the fallback is normalized type, group/namespace, and name. If multiple versions of the same identity occur in either inventory, exact versions are matched first; unmatched versions are reported as additions/removals rather than guessed upgrades.

## Development

```bash
npm test
```

The reusable dependency-free UMD module is in `src/core.js`. It exposes `parseDocument`, `detectFormat`, `normalizeSbom`, `analyzeSbom`, `shortestPath`, `filterComponents`, `compareSboms`, and `componentsToCsv`. The browser controller is `src/app.mjs`.
