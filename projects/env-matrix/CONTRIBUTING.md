# Contributing

Env Matrix should keep configuration discovery deterministic, explainable, and safe to run against an untrusted repository.

## Development

Node.js 20 or newer and Git are required. There are no package dependencies.

```sh
npm run check
npm test
npm run demo
```

## Pull requests

- Add positive and negative fixtures for every new source or deployment pattern.
- Keep findings tied to a file, line, concrete explanation, and repair suggestion.
- Preserve stable ordering across Linux, macOS, and Windows.
- Treat default values for sensitive variable names as confidential in all returned data and output formats.
- Do not execute inspected code or make network requests during a scan.

Parser proposals should include representative syntax, known false positives, and the static boundary they can support without becoming a full language parser.
