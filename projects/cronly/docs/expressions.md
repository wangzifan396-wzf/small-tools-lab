# Cron expression reference

cronly supports the standard 5-field form and, with a leading seconds field, a
6-field form.

```
# 5-field
┌───────────── minute (0–59)
│ ┌─────────── hour (0–23)
│ │ ┌───────── day of month (1–31)
│ │ │ ┌─────── month (1–12 or jan–dec)
│ │ │ │ ┌───── day of week (0–6 or sun–sat; 7 = Sunday)
│ │ │ │ │
* * * * *

# 6-field (seconds first)
┌───────────── second (0–59)
│ ┌─────────── minute
│ │ ┌───────── hour
│ │ │ ┌─────── day of month
│ │ │ │ ┌───── month
│ │ │ │ │ ┌─── day of week
│ │ │ │ │ │
* * * * * *
```

## Per-field syntax

| Form       | Example    | Meaning                                |
| ---------- | ---------- | -------------------------------------- |
| `*`        | `*`        | every value in range                  |
| list       | `1,15,30`  | any of these values                   |
| range      | `1-5`      | inclusive range `1,2,3,4,5`          |
| step       | `*/15`     | every 15th value from the start       |
| step+range | `1-10/2`   | `1,3,5,7,9`                           |
| names      | `jan-mar`  | month names (`jan`–`dec`)             |
| names      | `mon-fri`  | weekday names (`sun`–`sat`)           |

## Day-of-month vs day-of-week

This follows standard Vixie cron semantics:

- If **both** day-of-month and day-of-week are `*` → every day matches.
- If only one is restricted, that field must match.
- If **both** are restricted (e.g. `0 0 13 * 5` — the 13th **or** every Friday),
  a day matches if it satisfies **either** field.

## Timezones

`next` / `prev` / `nextRuns` evaluate the expression against **wall-clock time
in a timezone**, using `Intl.DateTimeFormat`. Pass `{ timeZone: 'Asia/Shanghai' }`
(or any IANA zone) for correct local times; daylight-saving transitions are
handled automatically. With no `timeZone`, the runtime's local zone is used.

## Examples

| Expression            | Meaning                                      |
| --------------------- | -------------------------------------------- |
| `*/5 * * * *`         | every 5 minutes                             |
| `0 9 * * 1-5`         | 09:00, Monday–Friday                        |
| `0 0 1 * *`           | midnight on the 1st of every month          |
| `30 18 * * 6,0`       | 18:30 on Saturday and Sunday                |
| `0 0 * * 1`           | midnight every Monday                       |
| `*/20 * * * *`        | every 20 seconds (6-field form)             |
