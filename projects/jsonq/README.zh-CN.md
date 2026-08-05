# jsonq

零依赖的 JSON 查询与转换工具集。按路径取值、保留/剔除字段、过滤数组、排序——
命令行或浏览器里直接用，**无任何依赖、无需构建**。

```js
import { get, pick, omit, filter, sortBy, select } from 'jsonq';

get({ a: { b: [10, 20] } }, 'a.b.0');      // 10
pick({ a: 1, b: 2, c: 3 }, ['a', 'c']);   // { a: 1, c: 3 }
filter([{ n: 3 }, { n: 1 }], 'n', 'gt', 2); // [{ n: 3 }]
sortBy([{ n: 3 }, { n: 1 }], 'n', 'desc');  // [{ n: 3 }, { n: 1 }]
```

## 安装

```bash
npm install jsonq
```

不会安装任何依赖。也可以直接用 `npx` 试用命令行：

```bash
npx jsonq filter '[{"n":3},{"n":1}]' n gt 2
```

## 库用法

| 函数 | 说明 |
| --- | --- |
| `get(obj, path)` | 按点/斜杠路径取值（`a.b.0`）。 |
| `pick(obj, keys[])` | 只保留指定键的新对象。 |
| `omit(obj, keys[])` | 剔除指定键的新对象。 |
| `filter(arr, key, op, value)` | 保留 `get(item,key) op value` 的项。 |
| `sortBy(arr, key, dir?)` | 按 `get(item,key)` 排序的副本（稳定）。 |
| `select(arr, keys[])` | 把每个项映射为保留指定键的对象。 |

`filter` 的 `op`：`eq neq gt gte lt lte contains exists`。

## 命令行

```bash
jsonq get    <json|@file> <path>
jsonq pick   <json|@file> <k1,k2,...>
jsonq omit   <json|@file> <k1,k2,...>
jsonq filter <json|@file> <key> <op> <value>
jsonq sort   <json|@file> <key> [--desc]
jsonq select <json|@file> <k1,k2,...>
jsonq --help
```

以 `@` 开头的值会从文件读取，否则按 JSON 解析。

```bash
jsonq get '{"a":{"b":[10,20]}}' a.b.0        # 10
jsonq filter '[{"n":3},{"n":1}]' n gt 2      # [{"n":3}]
echo '[{"n":3},{"n":1}]' > /tmp/arr.json
jsonq sort @/tmp/arr.json n --desc           # [{"n":3},{"n":1}]
```

## 浏览器

原生 ESM，可直接放进 `<script type="module">`：

```html
<script type="module">
  import { filter } from '../src/index.js';
  document.body.textContent = JSON.stringify(filter([{ n: 3 }, { n: 1 }], 'n', 'gt', 2));
</script>
```

也可以打开在线演示：

```bash
npm run playground   # → http://localhost:4173/
```

## 开发

```bash
node --test "test/*.test.js"   # 运行测试
npm run demo                   # 几个示例调用
```

## 许可证

[MIT](./LICENSE)
