# cron-describe

零依赖的 cron 表达式解析 + 人话解读工具。把 `分 时 日 月 周` 翻译成中文，
并列出接下来几次的执行时间。同时支持命令行与浏览器（自包含 playground，
无需构建）。

## 用法

```bash
cron-describe "0 0 * * 1" 3
```

支持 5 段（含秒为 6 段）、`@daily`/`@hourly`/`@weekly` 等宏、步长（`*/15`）、
区间（`9-17`）、列表（`1,3,5`）、月份与星期英文名（`jan`、`mon`）。

## 作为库使用

```js
import { parse, describe, nextRuns } from 'cron-describe';
const p = parse('0 0 1 * *');
const d = describe(p);              // { zh, en }
const r = nextRuns('0 0 1 * *', 5); // { ok: true, runs: Date[] }
```

`nextRuns(expr, count, from)` 接受固定参考时间，结果可复现，便于测试。

## 试一试

直接用浏览器打开 `index.html`（也支持 `file://`），或 `npm start`
启动本地服务。
