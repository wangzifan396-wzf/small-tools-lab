/**
 * Compute next/previous run times for a parsed cron expression, timezone-aware
 * via `Intl.DateTimeFormat`.
 *
 * @module core/schedule
 */

import { parse } from './parse.js';

const DOW_SHORT = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const HORIZON_YEARS = 5;

/** @type {Map<string, Intl.DateTimeFormat>} */
const FORMATTERS = new Map();

/**
 * Get (or build) a cached formatter for a timezone. Building a
 * `Intl.DateTimeFormat` is comparatively expensive, so we reuse one per zone
 * instead of constructing it on every minute we evaluate.
 * @param {string} [tz]
 * @returns {Intl.DateTimeFormat}
 */
function formatter(tz) {
  const key = tz || '';
  let fmt = FORMATTERS.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    FORMATTERS.set(key, fmt);
  }
  return fmt;
}

/**
 * Break a Date into wall-clock parts in a given IANA timezone.
 * @param {Date} date
 * @param {string} [tz]  omit for the runtime's local zone
 * @returns {{ year:number, month:number, day:number, hour:number, minute:number, second:number, dow:number }}
 */
export function partsInTz(date, tz) {
  const fmt = formatter(tz);
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
    dow: DOW_SHORT[parts.weekday],
  };
}

/**
 * @param {import('./parse.js').Cron} cron
 * @param {{ minute:number, hour:number, day:number, month:number, dow:number }} p
 * @returns {boolean}
 */
export function dayMatches(cron, p) {
  const domOk = cron.dom.has(p.day);
  const dowOk = cron.dow.has(p.dow);
  if (cron.domStar && cron.dowStar) return true;
  if (cron.domStar) return dowOk;
  if (cron.dowStar) return domOk;
  return domOk || dowOk;
}

/** @param {import('./parse.js').Cron} cron @param {Date} from @param {string} [tz] */
function nextRun(cron, from, tz) {
  const fromMs = from.getTime();
  const cursor = new Date(fromMs);
  cursor.setSeconds(0, 0);
  const limit = fromMs + HORIZON_YEARS * 366 * 86400000;
  let guard = 0;
  while (cursor.getTime() <= limit && guard < 5_000_000) {
    const p = partsInTz(cursor, tz);
    if (
      cron.minute.has(p.minute) &&
      cron.hour.has(p.hour) &&
      cron.month.has(p.month) &&
      dayMatches(cron, p)
    ) {
      if (cron.hasSeconds) {
        for (let s = 0; s <= 59; s += 1) {
          if (!cron.seconds.has(s)) continue;
          const cand = new Date(cursor);
          cand.setSeconds(s, 0);
          if (cand.getTime() > fromMs) return cand;
        }
      } else if (cursor.getTime() > fromMs) {
        return new Date(cursor);
      }
    }
    cursor.setTime(cursor.getTime() + 60000);
    guard += 1;
  }
  return null;
}

/** @param {import('./parse.js').Cron} cron @param {Date} from @param {string} [tz] */
function prevRun(cron, from, tz) {
  const fromMs = from.getTime();
  const cursor = new Date(fromMs);
  cursor.setSeconds(0, 0);
  const limit = fromMs - HORIZON_YEARS * 366 * 86400000;
  let guard = 0;
  while (cursor.getTime() >= limit && guard < 5_000_000) {
    const p = partsInTz(cursor, tz);
    if (
      cron.minute.has(p.minute) &&
      cron.hour.has(p.hour) &&
      cron.month.has(p.month) &&
      dayMatches(cron, p)
    ) {
      if (cron.hasSeconds) {
        for (let s = 59; s >= 0; s -= 1) {
          if (!cron.seconds.has(s)) continue;
          const cand = new Date(cursor);
          cand.setSeconds(s, 0);
          if (cand.getTime() < fromMs) return cand;
        }
      } else if (cursor.getTime() < fromMs) {
        return new Date(cursor);
      }
    }
    cursor.setTime(cursor.getTime() - 60000);
    guard += 1;
  }
  return null;
}

/**
 * Next run time strictly after `from`.
 * @param {string} expr
 * @param {Date} [from]
 * @param {{ timeZone?: string, seconds?: boolean }} [options]
 * @returns {Date|null}
 */
export function next(expr, from = new Date(), options = {}) {
  const cron = parse(expr, options);
  return nextRun(cron, from, options.timeZone);
}

/**
 * Previous run time strictly before `from`.
 * @param {string} expr
 * @param {Date} [from]
 * @param {{ timeZone?: string, seconds?: boolean }} [options]
 * @returns {Date|null}
 */
export function prev(expr, from = new Date(), options = {}) {
  const cron = parse(expr, options);
  return prevRun(cron, from, options.timeZone);
}

/**
 * The next `count` run times.
 * @param {string} expr
 * @param {number} [count]
 * @param {Date} [from]
 * @param {{ timeZone?: string, seconds?: boolean }} [options]
 * @returns {Date[]}
 */
export function nextRuns(expr, count = 1, from = new Date(), options = {}) {
  const cron = parse(expr, options);
  /** @type {Date[]} */
  const out = [];
  let cursor = from;
  for (let i = 0; i < count; i += 1) {
    const r = nextRun(cron, cursor, options.timeZone);
    if (!r) break;
    out.push(r);
    cursor = r;
  }
  return out;
}
