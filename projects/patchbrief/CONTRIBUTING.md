# Contributing

PatchBrief should produce the smallest useful review packet without hiding how context was selected. Discovery rules must be local, deterministic, and explainable in the selection manifest.

## Development

Node.js 20 or newer and Git are required. There are no package dependencies.

```sh
npm run check
npm test
npm run demo
```

## Pull requests

- Add a real temporary-Git regression test for discovery changes.
- Prove that token-budget changes never exceed the requested budget.
- Include positive, negative, and overlapping fixtures for redaction changes.
- Keep output stable across Linux, macOS, and Windows.
- Never execute or upload inspected repository code.

Security pattern proposals must explain both the credential form they catch and the likely false-positive surface.
