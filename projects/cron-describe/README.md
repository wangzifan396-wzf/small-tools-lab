# cron-describe

Zero-dependency cron expression parser + humanizer. Turn a `分 时 日 月 周`
schedule into plain Chinese and list the next few run times. Works in the CLI
and in the browser (self-contained playground, no build step).

## Usage

```bash
cron-describe "0 0 * * 1" 3
# 每天 0 点 0 分 执行。（日 与 周 同时限定为「或」关系）
#
# 下次运行（最多 3 次）：
# 1. 2026-08-10 00:00
# 2. 2026-08-17 00:00
# 3. 2026-08-24 00:00
```

## Features

- 5-field (`分 时 日 月 周`) and 6-field (with seconds) expressions
- `@daily` / `@hourly` / `@weekly` / `@monthly` / `@yearly` macros
- Steps (`*/15`), ranges (`9-17`), lists (`1,3,5`), names (`jan`, `mon`)
- Honours cron's day-of-month / day-of-week **OR** rule
- `nextRuns(expr, count, from)` accepts a fixed reference time (deterministic)

## Library

```js
import { parse, describe, nextRuns } from 'cron-describe';
const p = parse('0 0 1 * *');        // { ok: true, fields, stars, hasSeconds }
const d = describe(p);               // { zh, en }
const r = nextRuns('0 0 1 * *', 5);  // { ok: true, runs: Date[] }
```

## Try it

Open `playground/index.html` directly in a browser (works over `file://` too),
or run `npm start` for the localhost server.
