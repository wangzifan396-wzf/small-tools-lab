# YAML ↔ JSON

A strict, zero-dependency YAML subset parser and safe JSON-to-YAML serializer for browsers and Node.js 20+.

[Open the browser tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/yaml-json/) · [Security notes](SECURITY.md)

## Why this subset?

Full YAML has anchors, aliases, tags, merge keys, block scalars, and other features that are unnecessary or surprising in many small configuration tasks. This package supports a documented block-style subset and rejects unsupported syntax instead of silently guessing.

Supported syntax:

- Nested mappings and sequences, including sequence mappings
- Flow arrays and objects (`[a, b]`, `{enabled: true}`)
- Quoted strings, finite numbers, booleans, and null
- Full-line and whitespace-prefixed inline comments
- Exactly two spaces per indentation level

Mappings have a null prototype, duplicate keys are rejected, and errors include source line numbers.

## Library API

```js
import { parseYaml, stringifyYaml } from './src/index.js';

const config = parseYaml('server:\n  port: 8080\n');
const yaml = stringifyYaml({ users: [{ name: 'Ada' }] });
```

Also exported: `parseScalar` and `stringifyScalar`. TypeScript declarations are included.

## Develop

```bash
npm test
npm start -- 4173
```

Then open `http://localhost:4173`. The static server validates the port, limits file access to this project, and adds defensive response headers.
