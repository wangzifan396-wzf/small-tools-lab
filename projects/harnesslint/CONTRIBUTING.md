# Contributing

HarnessLint favors deterministic checks with evidence a maintainer can verify. A useful rule should identify a concrete failure mode, avoid network access, and produce a practical remediation.

## Development

Node.js 20 or newer is required. There are no package dependencies.

```sh
npm run check
npm test
npm run lint:self
```

To inspect the bundled unsafe example:

```sh
npm run demo
```

## Pull requests

- Keep each change focused.
- Add a test fixture for new or changed detection behavior.
- Include the rule ID in rule-related commit and pull request titles.
- Update the README rule table when adding a rule.
- Never use real tokens, passwords, or private endpoints in tests.

False-positive reports are especially valuable. Include a minimal redacted harness file and explain why the instruction is safe in its actual scope.
