# Contributing

Action Budget should make workflow exposure visible without presenting uncertain runtime behavior as an exact bill.

## Development

Node.js 20 or newer is required.

```sh
npm install
npm run check
npm test
npm run demo
```

## Pull requests

- Add official GitHub syntax references and positive/negative fixtures for matrix changes.
- Test `include`, `exclude`, expression, empty-axis, and non-scalar cases where relevant.
- Label lower bounds, upper bounds, assumptions, and unknown values accurately.
- Preserve deterministic ordering across Linux, macOS, and Windows.
- Never execute workflow expressions, actions, scripts, or repository code during analysis.

New dollar-cost models should be optional and data-driven. Do not bake one account plan or runner price into the structural metrics.
