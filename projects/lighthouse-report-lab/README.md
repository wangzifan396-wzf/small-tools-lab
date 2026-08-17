# Lighthouse Report Lab

A local Lighthouse JSON analyzer and comparison workbench. Review Core Web Vitals, category scores, failed audits, opportunities and performance budgets; compare two runs; export CSV or a privacy-clean report without uploading page data.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/lighthouse-report-lab/)

## Features

- Lighthouse report parsing across current JSON result shapes
- FCP, LCP, TBT, CLS, Speed Index, TTI, INP and server-response metrics when present
- Category scores, scored/binary/manual/informative audit modes and opportunity savings
- Default transparent budgets for categories, user-experience metrics and total transfer bytes
- Search and filters for result state, score mode and opportunities
- Two-run comparison with correct directionality: lower metric time/shift is better, higher category score is better
- Audit CSV export with spreadsheet-formula protection
- Privacy-clean JSON that removes audit details, explanations, screenshots, timing internals and URL credentials/query/fragment data
- No runtime dependencies, external assets, analytics or network access

Budgets are review thresholds, not guarantees of field performance. Lighthouse lab results vary with hardware, throttling, network conditions, cache state and Lighthouse version. The tool does not replace CrUX/RUM field data.

The privacy-clean export retains audit titles, scores, numeric values, categories, tool settings and sanitized page origins. Review it before sharing.

## Development

```bash
npm test
```

The UMD core in `src/core.js` exposes parsing, normalization, filtering, budget evaluation, comparison, sanitization, CSV and value formatting.
