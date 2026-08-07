# CSV ⇄ JSON · 表格转换

零依赖的 CSV 与 JSON 互转工具，正确处理带引号、逗号与换行符的字段。纯前端运行，数据不出本机。

## 功能

- **CSV → JSON**：首行可作表头（生成对象数组）或纯数组。
- **JSON → CSV**：支持对象数组（自动合并所有键为表头）与二维数组；值与表头按 RFC4180 转义。
- **分隔符自动识别**：逗号 / 分号 / Tab / 竖线，也可手动指定。
- **字段转义**：含分隔符、引号或换行的单元格会自动加引号并转义内部引号。

## 用法

通过 [Small Tools Lab 在线页面](https://wangzifan396-wzf.github.io/small-tools-lab/projects/csvjson/) 使用，或在本地运行：

```sh
npm start
```

核心解析器可以作为 ES 模块导入：

```js
import { csvToJson, jsonToCsv } from './src/index.js';

console.log(csvToJson('name,age\nAlice,30'));
console.log(jsonToCsv([{ name: 'Alice', age: 30 }]));
```

## 技术

- 自写的 CSV 解析器（逐字符扫描，正确处理引号包裹与转义）。
- 无第三方依赖；适配浅色 / 深色系统主题。
- 对重复 / 空表头、列数不一致、未闭合引号返回明确错误，避免静默丢数据。
- Node.js 20+ 可运行 `npm test`。
