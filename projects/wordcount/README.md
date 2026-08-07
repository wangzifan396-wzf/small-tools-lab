# Word Count · 文本统计

零依赖的中英混排文本统计工具。纯前端运行，数据不出本机。

## 功能

- 字符数（含 / 不含空格）
- 中文汉字数、英文词数（按词边界识别，含缩写与连字符）
- 行数、段落数、句子数
- 预计阅读时长（中文按 ~300 字/分、英文按 ~200 词/分估算）
- 实时统计，输入即更新

## 用法

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/wordcount/) 使用，或在本地运行：

```sh
npm start
```

核心统计也可以作为 ES 模块导入：

```js
import { countText } from './src/index.js';

console.log(countText('你好, open source.'));
```

## 技术

- 纯正则 + `String` API，无第三方依赖。
- 适配浅色 / 深色系统主题。
- 按 Unicode 码点统计字符，避免把 emoji 算成两个字符。
- Node.js 20+ 可运行 `npm test`。
