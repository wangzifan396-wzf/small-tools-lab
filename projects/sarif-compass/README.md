# SARIF Compass

A private, local-first SARIF 2.1.0 triage and comparison workbench. Open static-analysis output from CodeQL, Semgrep, ESLint, or another SARIF producer; normalize multiple runs into one queue; inspect rules, locations, snippets, code flows, suppressions, and baselines; compare scans; then export filtered CSV or a privacy-clean SARIF copy.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/sarif-compass/)

## Why it exists

SARIF is a strong interchange format, but its useful context is nested across runs, tool components, rule descriptors, artifacts, URI bases, thread flows, suppressions, and result fingerprints. Reviewing the raw JSON is slow. Uploading it to an unfamiliar viewer can also disclose source snippets, internal paths, scanner commands, environment variables, repository structure, web traffic, or vulnerability details.

SARIF Compass performs every operation in the current browser tab. It has no backend, account, telemetry, external assets, runtime dependencies, or network requests.

## Features

- SARIF 2.1.0 JSON parsing with best-effort compatibility notices for other versions
- Multiple runs and tools combined into a single deterministic result queue
- Driver and extension rule resolution through IDs, indexes, and tool-component references
- Rule name, descriptions, tags, precision, help URI, default level, and security-severity context
- Artifact URI and artifact-index resolution through chained `originalUriBaseIds`
- Credentials removed from resolved URLs before display
- Physical region, logical location, source snippet, related location, fix, rank, and result-kind normalization
- Code flows flattened and sorted by flow, thread, and execution order
- Baseline states, accepted/under-review/rejected suppressions, and stable partial/full fingerprints
- Filters for level, tool, rule, baseline state, suppression state, code-flow presence, and free text
- Scan-to-scan comparison with added, removed, updated, and unchanged results
- Update detection for level, message, location, and suppression changes when stable fingerprints match
- Safe fallback identity based on rule and primary location when no fingerprint exists
- Spreadsheet-formula-resistant CSV export of the current filtered queue
- Privacy-clean SARIF export
- Strict Content Security Policy and untrusted strings rendered only as text
- Responsive light and dark interfaces with a built-in multi-tool sample

## Privacy-clean export

The browser action removes data that is often unnecessary for sharing a finding report:

- invocation command lines, arguments, response files, and environment variables;
- `originalUriBaseIds`, which often reveal absolute checkout paths;
- embedded artifact contents;
- source and context snippets throughout results and code flows;
- fixes and attachments;
- embedded web requests and responses;
- usernames, passwords, queries, and fragments in URI-valued fields.

Rules, messages, artifact paths, line/column regions, fingerprints, properties, suppression metadata, and tool metadata remain because they are central to triage. Privacy cleaning reduces exposure; it does not prove that a report is anonymous. Review the exported JSON before sharing it.

## Comparison behavior

The preferred identity is the rule ID plus sorted `partialFingerprints`; full `fingerprints` are used when partial fingerprints are absent. Without either, the fallback is rule ID, primary artifact URI, start line, and start column.

Duplicate occurrences with the same identity are preserved and matched in document order. A matching identity with a changed level, message, location, or suppression state is `updated`. Unmatched identities are added or removed. SARIF `baselineState` remains visible but does not override the independent comparison.

## Boundaries

SARIF Compass is a practical viewer, not a full schema validator. It does not execute fixes, open help links, fetch artifacts, recalculate severity, verify suppressions, render Markdown, or determine whether a finding is a true positive. Message Markdown is shown as literal text.

Artifact URIs are resolved for display only. The tool never reads referenced local files or contacts referenced HTTP endpoints.

## Development

```bash
npm test
```

The dependency-free UMD module in `src/core.js` exposes `parseSarif`, `analyzeSarif`, `filterResults`, `compareSarif`, `sanitizeSarif`, `resultsToCsv`, `formatRegion`, and `formatLocation`. The browser controller is `src/app.mjs`.
