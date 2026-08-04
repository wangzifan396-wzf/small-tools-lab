# Contributing

ForgeReady values evidence over generic checklists. A useful rule should identify a concrete public-release risk, explain what was observed, and suggest a proportionate repair.

## Development

Node.js 20 or newer is required. There are no package dependencies.

```sh
npm run check
npm test
npm run audit:self
npm run demo
```

## Pull requests

- Keep scoring changes focused and explain the expected tradeoff.
- Add passing and failing fixtures for every rule change.
- Keep Linux, macOS, and Windows behavior consistent.
- Do not add network access or execute code from scanned repositories.
- Update the rule table and configuration documentation when behavior changes.

False-positive reports should include a minimal redacted repository layout and the profile used for the audit.
