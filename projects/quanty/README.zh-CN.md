# quanty

零依赖的数字与字节格式化工具集。

可以格式化字节大小（`formatBytes` / `parseBytes`）、添加千分位与小数点
（`formatNumber`）、生成紧凑表示（SI 风格 `1.5M` 或中文风格 `150万`，
`formatCompact`）、以及添加序数后缀（`1st`、`第22`）。可作为库、命令行工具，
或直接运行在浏览器中——无需构建、零依赖。

```js
import { formatBytes, parseBytes, formatNumber, formatCompact, ordinal } from 'quanty';

formatBytes(1536);                        // "1.5 KiB"
formatBytes(1500000, { binary: false });  // "1.5 MB"
parseBytes('1.5 KiB');                    // 1536  （与 formatBytes 可逆）
formatNumber(1234567);                    // "1,234,567"
formatCompact(1500000, { style: 'zh' });  // "150万"
ordinal(22, { lang: 'zh' });              // "第22"
```

## 安装

```bash
npm install quanty
```

不会安装任何依赖。也可以直接用 `npx` 试用命令行：

```bash
npx quanty bytes 1536
```

## 库用法

### `formatBytes(bytes, options?)`

| 选项        | 类型      | 默认值  | 说明                                       |
| ----------- | --------- | ------- | ------------------------------------------ |
| `binary`    | `boolean` | `true`  | `true` 用 1024 进制单位（`KiB`）；`false` 用 1000 进制（`kB`）。 |
| `decimals`  | `number`  | `1`     | 小数位数。                                  |
| `locale`    | `string`  | —       | BCP-47 语言标签；小数与分组遵循该区域设置。 |
| `trimZero`  | `boolean` | `true`  | 去掉末尾的 `.0`。                           |

非有限数值抛 `TypeError`，负数抛 `RangeError`。

### `parseBytes(input)`

`formatBytes` 的逆操作。接受 `"1.5 KiB"`、`"1 MB"`、`"512"` 或纯数字，单位不区分大小写。

### `formatNumber(n, options?)`

| 选项        | 类型      | 默认值  | 说明                       |
| ----------- | --------- | ------- | -------------------------- |
| `decimals`  | `number`  | `0`     | 小数位数。                 |
| `thousands` | `boolean` | `true`  | 添加千分位分隔符。         |
| `locale`    | `string`  | —       | 委托给 `Intl.NumberFormat`。|

### `formatCompact(n, options?)`

| 选项      | 类型           | 默认值  | 说明                                  |
| --------- | -------------- | ------- | ------------------------------------- |
| `style`   | `'si'\|'zh'`   | `'si'`  | `K/M/B/T`（si）或 `万/亿/万亿`（zh）。|
| `decimals`| `number`       | `1`     | 小数位数。                            |

### `ordinal(n, options?)`

`lang: 'en'`（默认）→ `1st`/`2nd`/`3rd`/`4th`；`lang: 'zh'` → `第1`/`第22`。

## 命令行

```bash
quanty bytes 1536                 # 1.5 KiB
quanty bytes 1500000 --si         # 1.5 MB
quanty parse "1.5 KiB"            # 1536
quanty number 1234567 --locale de-DE   # 1.234.567
quanty compact 1500000 --style zh      # 150万
quanty ordinal 22 --lang zh       # 第22
quanty --help
```

## 浏览器

本包为原生 ESM 且零依赖，可直接在浏览器 `<script type="module">` 中加载：

```html
<script type="module">
  import { formatBytes } from '../src/index.js';
  document.body.textContent = formatBytes(1536);
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
