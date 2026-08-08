# Query Parse

A loss-aware URL query parser and deterministic rebuilder for browsers and Node.js, with no runtime dependencies.

[Open the browser tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/query-parse/) · [Security notes](SECURITY.md)

## What it preserves

- Full URLs, relative URLs, leading `?`, and naked query strings
- Repeated keys and original pair order
- The semantic difference between `flag` and `flag=`
- URL fragments, including an explicitly empty fragment
- A trailing question mark when the original URL had one
- Optional form-style `+`/space conversion

Malformed percent encoding is rejected with a segment number. Object conversion uses a null prototype so `__proto__` and `constructor` remain ordinary keys. The UI creates editable rows with DOM APIs instead of interpolating user input into HTML.

## Library API

```js
import { buildQuery, pairsToObject, parseQuery, rebuildUrl } from './src/index.js';

const parsed = parseQuery('/search?tag=web&tag=tools&debug#top');
buildQuery(parsed.pairs);
rebuildUrl(parsed);
pairsToObject(parsed.pairs); // repeated keys are combined by default
```

TypeScript declarations are included. Duplicate-key conversion can use `combine`, `first`, or `last` behavior.

## Develop

```bash
npm test
npm start -- 4173
```

Then open `http://localhost:4173`.
