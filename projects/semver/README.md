# SemVer Check

A strict SemVer 2.0 parser, precedence comparator, stable sorter, and practical range evaluator with no runtime dependencies.

[Open the browser tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/semver/) · [Security notes](SECURITY.md)

## Highlights

- Strict core and prerelease validation, with an optional `v` prefix for CLI/UI convenience
- Correct prerelease precedence and build-metadata handling
- Decimal-string comparison for identifiers larger than JavaScript's safe integer range
- Exact, comparator, caret, tilde, wildcard, missing-component, AND, `||`, and hyphen ranges
- Standard prerelease exclusion unless the range opts into the same core version

## Library API

```js
import { compareVersions, parseVersion, satisfies, sortVersions } from './src/index.js';

parseVersion('v1.2.3-rc.1+linux');
compareVersions('1.0.0-beta.11', '1.0.0-rc.1'); // -1
sortVersions(['2.0.0', '1.5.0']);
satisfies('1.7.2', '^1.2.0'); // true
```

Also exported: `formatVersion` and `isValidVersion`. TypeScript declarations are included. Build metadata is ignored for precedence as required by SemVer 2.0.

## Develop

```bash
npm test
npm start -- 4173
```

Then open `http://localhost:4173`.
