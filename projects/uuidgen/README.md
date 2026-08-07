# UUID Gen · 唯一标识生成

零依赖的 RFC4122 v4 UUID 批量生成工具。纯前端运行，数据不出本机。

## 功能

- 批量生成任意数量（1–200）的 v4 UUID。
- 可切换「含连字符 / 无连字符」与「大写 / 小写」。
- 只使用密码学安全随机数（`crypto.getRandomValues`）；不可用时明确报错，不会降级到 `Math.random`。

## 用法

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/uuidgen/) 使用，或在本地运行：

```sh
npm start
```

核心生成器也可以作为 ES 模块导入：

```js
import { generateUuids } from './src/index.js';

console.log(generateUuids(4));
```

## 技术

- 标准 v4 变体位：`6`（`0100`）固定为版本，`8/9/a/b`（`10xx`）固定为变体位。
- 无第三方依赖；适配浅色 / 深色系统主题。
- Node.js 20+ 可运行 `npm test`。
