# cronly

> 零依赖 **cron** 工具箱：解析并校验表达式、用**中文或英文**描述、并计算**下一次/上一次运行时间**（感知时区）。可在 Node.js 与浏览器中运行。

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-31%20passing-brightgreen)](./test)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](#)

cronly 把一条 cron 表达式变成可信、可读的东西：

- **解析与校验** —— 在出问题前拦住 `70 0 0 * * *`、`0 0 0 * foo`。支持 `*`、范围、步长、列表，以及月份/星期名称。
- **描述** —— `0 9 * * 1-5` 变成 *"At 09:00 on Monday…Friday"*，或中文 *"在 09:00，周一至周五运行"*。
- **排程** —— `next` / `prev` / `nextRuns` 计算真实的运行时刻，正确处理时区、夏令时，以及 cron「日 **或** 星期」的匹配规则。

无依赖、无原生编译，Node ≥ 18。

---

## 安装

```bash
npm install cronly          # 作为库
npm install -g cronly       # 作为命令行
```

---

## 命令行

```
cronly <命令> <表达式> [选项]

命令
  parse     校验并展示展开后的字段
  describe  人类可读的描述（--lang en|zh）
  next      下一次运行时间（--count N --from ISO --tz IANA）
  prev      上一次运行时间

选项
      --lang en|zh     描述语言（默认 en）
      --count N        列出多少次运行（默认 1）
      --from ISO       参考时间（默认现在）
      --tz IANA        IANA 时区，如 America/New_York
      --seconds        把 6 段表达式视为含秒
  -h, --help
      --version
```

```bash
cronly describe "0 9 * * 1-5"
cronly describe "0 9 * * 1-5" --lang zh
cronly next "0 9 * * 1-5" --count 5
cronly next "0 9 * * 1-5" --tz Asia/Shanghai --count 3
cronly parse "*/15 0 0 * * 1,15"
```

---

## 作为库使用

```js
import { parse, describe, next, nextRuns } from 'cronly';

parse('0 9 * * 1-5');                       // 非法输入会抛 CronError
console.log(describe('0 9 * * 1-5', { lang: 'zh' }));

const runs = nextRuns('0 9 * * 1-5', 3, new Date(), { timeZone: 'UTC' });
console.log(runs.map((d) => d.toISOString()));
```

模块也可单独引入以便按需打包：

```js
import { parse, CronError } from 'cronly/src/core/parse.js';
import { next, prev } from 'cronly/src/core/schedule.js';
```

---

## 表达式语法

`分 时 日 月 星期`（可加前置的 `秒` 字段）。每段支持：

| 形式     | 示例      | 含义               |
| -------- | --------- | ------------------ |
| `*`      | `*`       | 任意值             |
| 列表     | `1,15,30` | 其中任意一个       |
| 范围     | `1-5`     | 闭区间             |
| 步长     | `*/15`    | 从起点起每 15 个   |
| 步长+范围| `1-10/2`  | 1,3,5,7,9          |
| 名称     | `jan`,`mon`| 月份 / 星期名称   |

星期用 `0`–`6`（周日 `0`），`7` 也视为周日。当**日与星期同时受限**时，满足**任一**即匹配（标准 Vixie cron 语义）。

---

## 浏览器

cronly 核心仅依赖 `Intl`（现代浏览器均支持），可在浏览器运行。在线试玩位于
[`playground/`](./playground) —— 运行 `npm run playground` 后打开打印出的地址，
即可实时解析并预览运行时间。

---

## 开发

```bash
git clone <你的-fork>
cd cronly
npm test        # node --test，零依赖
npm run demo    # 列出 "0 9 * * 1-5" 的后 5 次运行
```

欢迎参与贡献，详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

[MIT](./LICENSE)
