/**
 * Cron expression parser & validator.
 *
 * Supports the standard 5-field form (`m h dom mon dow`) and, with
 * `{ seconds: true }`, the 6-field form with a leading seconds field. Field
 * syntax covers `*`, ranges (`1-5`), steps (`*\/15`, `1-10/2`), lists
 * (`1,15,30`), and month/day names (`jan`, `mon`, `fri`).
 *
 * @module core/parse
 */

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DOWS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export class CronError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CronError';
  }
}

/**
 * @typedef {Object} Cron
 *   @property {boolean} hasSeconds
 *   @property {Set<number>} seconds
 *   @property {Set<number>} minute
 *   @property {Set<number>} hour
 *   @property {Set<number>} dom
 *   @property {Set<number>} month
 *   @property {Set<number>} dow
 *   @property {boolean} domStar
 *   @property {boolean} dowStar
 */

/**
 * @param {string} expr
 * @param {{ seconds?: boolean }} [options]
 * @returns {Cron}
 */
export function parse(expr, options = {}) {
  const hasSeconds = options.seconds === true;
  const fields = String(expr).trim().split(/\s+/);
  const expected = hasSeconds ? 6 : 5;
  if (fields.length !== expected) {
    throw new CronError(`expected ${expected} fields, got ${fields.length}`);
  }

  let si = 0;
  const seconds = hasSeconds ? expand(fields[si++], 0, 59, null, 'seconds') : new Set([0]);
  const minute = expand(fields[si++], 0, 59, null, 'minute');
  const hour = expand(fields[si++], 0, 23, null, 'hour');
  const domRaw = fields[si++];
  const month = expand(fields[si++], 1, 12, MONTHS, 'month');
  const dowRaw = fields[si++];
  const dom = expand(domRaw, 1, 31, null, 'day-of-month');
  const dow = expandDow(dowRaw);

  return {
    hasSeconds,
    seconds,
    minute,
    hour,
    dom,
    month,
    dow,
    domStar: domRaw.trim() === '*',
    dowStar: dowRaw.trim() === '*',
  };
}

/**
 * Expand a single cron field into a set of allowed integers.
 * @param {string} field
 * @param {number} min
 * @param {number} max
 * @param {Record<string,number>|null} names
 * @param {string} label
 * @returns {Set<number>}
 */
function expand(field, min, max, names, label) {
  const set = new Set();
  for (const item of field.split(',')) {
    let step = 1;
    let base = item;
    if (item.includes('/')) {
      const [b, s] = item.split('/');
      base = b;
      step = Number(s);
      if (!Number.isInteger(step) || step <= 0) {
        throw new CronError(`invalid step in "${item}"`);
      }
    }
    let start;
    let end;
    if (base === '*') {
      start = min;
      end = max;
    } else if (base.includes('-')) {
      const [a, bb] = base.split('-');
      start = resolve(a, min, max, names, label);
      end = resolve(bb, min, max, names, label);
      if (start > end) throw new CronError(`range start after end in "${item}"`);
    } else {
      start = resolve(base, min, max, names, label);
      end = item.includes('/') ? max : start;
    }
    for (let v = start; v <= end; v += step) set.add(v);
  }
  return set;
}

/** @param {string} field @returns {Set<number>} */
function expandDow(field) {
  const set = new Set();
  for (const item of field.split(',')) {
    let step = 1;
    let base = item;
    if (item.includes('/')) {
      const [b, s] = item.split('/');
      base = b;
      step = Number(s);
      if (!Number.isInteger(step) || step <= 0) throw new CronError(`invalid step in "${item}"`);
    }
    let start;
    let end;
    if (base === '*') {
      start = 0;
      end = 6;
    } else if (base.includes('-')) {
      const [a, bb] = base.split('-');
      start = resolveDow(a);
      end = resolveDow(bb);
      if (start > end) throw new CronError(`range start after end in "${item}"`);
    } else {
      start = resolveDow(base);
      end = item.includes('/') ? 6 : start;
    }
    for (let v = start; v <= end; v += step) set.add(v % 7);
  }
  return set;
}

/** @param {string} tok @returns {number} */
function resolveDow(tok) {
  const low = tok.toLowerCase();
  if (low in DOWS) return DOWS[low];
  if (/^\d+$/.test(tok)) {
    const n = Number(tok);
    if (n === 7) return 0; // Sunday alias
    if (n >= 0 && n <= 6) return n;
  }
  throw new CronError(`invalid day-of-week "${tok}"`);
}

/**
 * @param {string} tok
 * @param {number} min
 * @param {number} max
 * @param {Record<string,number>|null} names
 * @param {string} label
 * @returns {number}
 */
function resolve(tok, min, max, names, label) {
  let v;
  const low = tok.toLowerCase();
  if (names && low in names) v = names[low];
  else if (/^\d+$/.test(tok)) v = Number(tok);
  else throw new CronError(`invalid ${label} value "${tok}"`);
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new CronError(`value ${v} out of range [${min},${max}] for ${label}`);
  }
  return v;
}
