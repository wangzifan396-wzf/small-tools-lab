# Epoch · 时间戳转换

零依赖的时间戳 ⇄ 日期互转工具。纯前端运行，数据不出本机。

## 功能

- **时间戳 → 日期**：输入 Unix 时间戳（秒或毫秒），输出本地时间、UTC、ISO 8601，以及相对「现在」的时长。
- **日期 → 时间戳**：输入 `2024-05-30 12:00:00` 这类日期，得到秒 / 毫秒时间戳及标准格式。
- **自动识别单位**：默认按位数自动判断「秒 / 毫秒」（≥13 位视为毫秒），也可手动指定。
- **实时时钟**：顶部显示当前本地时间、秒级与毫秒级时间戳，每秒刷新。

## 用法

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/epoch/) 直接使用，或在本地启动：

```sh
npm start
```

然后打开终端显示的本地地址。页面使用原生 ES 模块，因此不建议通过 `file://` 直接打开。

作为模块使用：

```js
import { epochToDate, formatUtc } from './src/index.js';

const { date } = epochToDate('1717000000');
console.log(formatUtc(date));
```

## 技术

- 纯 `Date` API，无第三方依赖。
- 适配浅色 / 深色系统主题。
- Node.js 20+ 可运行 `npm test` 验证核心逻辑。
