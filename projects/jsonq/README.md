# jsonq

Zero-dependency JSON query & transform toolkit. Pick paths, keep/drop keys,
filter arrays, and sort — from the command line or straight in the browser.
No dependencies, no build step.

```js
import { get, pick, omit, filter, sortBy, select } from 'jsonq';

get({ a: { b: [10, 20] } }, 'a.b.0');      // 10
pick({ a: 1, b: 2, c: 3 }, ['a', 'c']);   // { a: 1, c: 3 }
filter([{ n: 3 }, { n: 1 }], 'n', 'gt', 2); // [{ n: 3 }]
sortBy([{ n: 3 }, { n: 1 }], 'n', 'desc');  // [{ n: 3 }, { n: 1 }]
```

## Install

```bash
npm install jsonq
```

No dependencies are installed. Or try the CLI with `npx`:

```bash
npx jsonq filter '[{"n":3},{"n":1}]' n gt 2
```

## Library

| Function | Description |
| --- | --- |
| `get(obj, path)` | value at a dot/slash path (`a.b.0`). |
| `pick(obj, keys[])` | new object with only the listed keys. |
| `omit(obj, keys[])` | new object without the listed keys. |
| `filter(arr, key, op, value)` | keep items where `get(item,key) op value`. |
| `sortBy(arr, key, dir?)` | stable sorted copy by `get(item,key)`. |
| `select(arr, keys[])` | map each item to a picked object. |

`op` for `filter`: `eq neq gt gte lt lte contains exists`.

## CLI

```bash
jsonq get    <json|@file> <path>
jsonq pick   <json|@file> <k1,k2,...>
jsonq omit   <json|@file> <k1,k2,...>
jsonq filter <json|@file> <key> <op> <value>
jsonq sort   <json|@file> <key> [--desc]
jsonq select <json|@file> <k1,k2,...>
jsonq --help
```

A value starting with `@` is read from a file; otherwise it is parsed as JSON.

```bash
jsonq get '{"a":{"b":[10,20]}}' a.b.0        # 10
jsonq filter '[{"n":3},{"n":1}]' n gt 2      # [{"n":3}]
echo '[{"n":3},{"n":1}]' > /tmp/arr.json
jsonq sort @/tmp/arr.json n --desc           # [{"n":3},{"n":1}]
```

## Browser

Native ESM — drop it into a `<script type="module">`:

```html
<script type="module">
  import { filter } from '../src/index.js';
  const out = filter([{ n: 3 }, { n: 1 }], 'n', 'gt', 2);
  document.body.textContent = JSON.stringify(out);
</script>
```

Or open the live playground:

```bash
npm run playground   # → http://localhost:4173/
```

## Develop

```bash
node --test "test/*.test.js"   # run tests
npm run demo                   # a couple of example calls
```

## License

[MIT](./LICENSE)
