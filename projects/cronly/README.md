# cronly

> Zero-dependency **cron** toolkit: parse & validate expressions, describe them
> in **English or Chinese**, and compute the **next / previous run times**
> (timezone-aware). Runs in Node.js and the browser.

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-31%20passing-brightgreen)](./test)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](#)

cronly turns a cron string into something you can trust and read:

- **Parse & validate** — catch `70 0 0 * * *` and `0 0 0 * foo` before they
  ship. Field syntax covers `*`, ranges, steps, lists, and month/weekday names.
- **Describe** — `0 9 * * 1-5` becomes *"At 09:00 on Monday, Tuesday,
  Wednesday, Thursday, Friday"*, or the Chinese *"在 09:00，周一至周五运行"*.
- **Schedule** — `next` / `prev` / `nextRuns` compute actual run instants,
  correctly handling timezones, DST, and the cron "day-of-month **or**
  day-of-week" rule.

No dependencies, no native build, Node ≥ 18.

---

## Install

```bash
npm install cronly          # library
npm install -g cronly       # CLI
```

---

## CLI

```
cronly <command> <expression> [options]

Commands
  parse     Validate and show the expanded fields.
  describe  Human-readable description (--lang en|zh).
  next      Next run time(s) (--count N --from ISO --tz IANA).
  prev      Previous run time(s).

Options
      --lang en|zh     Language for describe (default en).
      --count N        Number of runs to list (default 1).
      --from ISO       Reference time (default now).
      --tz IANA        IANA timezone, e.g. America/New_York.
      --seconds        Treat a 6-field expression as seconds-included.
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

## Library

```js
import { parse, describe, next, nextRuns } from 'cronly';

parse('0 9 * * 1-5');                       // throws CronError on bad input
console.log(describe('0 9 * * 1-5', { lang: 'zh' }));

const runs = nextRuns('0 9 * * 1-5', 3, new Date(), { timeZone: 'UTC' });
console.log(runs.map((d) => d.toISOString()));
```

Modules are importable directly for tree-shaking:

```js
import { parse, CronError } from 'cronly/src/core/parse.js';
import { next, prev } from 'cronly/src/core/schedule.js';
```

---

## Expression syntax

`minute hour day-of-month month day-of-week` (optionally prefixed with a
`seconds` field). Each field supports:

| Form      | Example     | Meaning                          |
| --------- | ----------- | -------------------------------- |
| `*`       | `*`         | every value                     |
| list      | `1,15,30`   | any of these                    |
| range     | `1-5`       | inclusive range                 |
| step      | `*/15`      | every 15th from the start       |
| step+range| `1-10/2`    | 1,3,5,7,9                       |
| names     | `jan`, `mon`| month / weekday names          |

Day-of-week uses `0`–`6` (Sunday `0`); `7` is also accepted as Sunday. When
**both** day-of-month and day-of-week are restricted, a day matches if it
satisfies **either** (standard Vixie cron semantics).

---

## Browser

cronly's core uses only `Intl` (available in modern browsers), so it runs in
the browser too. A live playground lives in [`playground/`](./playground) — run
`npm run playground` and open the printed URL to parse and preview run times
live.

---

## Development

```bash
git clone <your-fork>
cd cronly
npm test        # node --test, zero deps
npm run demo    # next 5 runs of "0 9 * * 1-5"
```

Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
