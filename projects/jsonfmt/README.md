# jsonfmt · JSON 格式化 / 校验

粘贴混乱的 JSON，一键**格式化（美化）、压缩（单行）或仅校验**合法性。

## 功能
- 格式化：带 2 空格缩进的漂亮输出
- 压缩：去掉空白的紧凑单行
- 校验：只检查是否合法 JSON，并提示错误
- 一键复制、载入示例

## 用法

[在线使用](https://wangzifan396-wzf.github.io/small-tools-lab/projects/jsonfmt/)，或在本地运行：

```sh
npm start
```

核心模块支持自定义缩进、递归键排序、末尾换行和结构化校验结果：

```js
import { formatJson, validateJson } from './src/index.js';

console.log(formatJson('{"z":1,"a":2}', { sortKeys: true }));
console.log(validateJson('{broken}'));
```

Node.js 20+ 可运行 `npm test`。纯前端、零依赖、数据不出本机。
