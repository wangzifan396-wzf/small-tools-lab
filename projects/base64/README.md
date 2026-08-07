# base64 · Base64 编解码

文本与 Base64 互转，**完整支持中文等 UTF-8**（用 `TextEncoder`/`TextDecoder` + `btoa`/`atob`）。

## 功能
- 编码：文本 → Base64
- 解码：Base64 → 文本（非法输入会报错）
- 一键复制结果、输入/输出互换

## 用法

[在线使用](https://wangzifan396-wzf.github.io/small-tools-lab/projects/base64/)，或在本地运行：

```sh
npm start
```

核心模块也支持 Base64URL、无填充输出和严格 UTF-8 解码：

```js
import { encodeBase64, decodeBase64 } from './src/index.js';

const encoded = encodeBase64('你好 😀', { urlSafe: true, padding: false });
console.log(decodeBase64(encoded));
```

Node.js 20+ 可运行 `npm test`。纯前端、零依赖、数据不出本机。Base64 是编码而不是加密。
