/**
 * Timecode parsing and formatting.
 *
 * subzen keeps every time value as an **integer number of milliseconds**.
 * Formats only differ in how they render that number, so all conversion
 * lives here.
 *
 * @module core/timecode
 */

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** `[[hh:]mm:]ss[.,fff]` — hours and the fractional part are optional. */
const TIMECODE_RE = /^(?:(\d{1,4}):)?(?:(\d{1,2}):)?(\d{1,2})(?:[.,:](\d{1,3}))?$/;

/** `12.5s` / `250ms` / `-3s` / `2m` / `1h` */
const DURATION_RE = /^([+-]?\d*\.?\d+)\s*(ms|s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hours?)?$/i;

const DURATION_UNITS = {
  ms: 1,
  s: MS_PER_SECOND,
  sec: MS_PER_SECOND,
  secs: MS_PER_SECOND,
  second: MS_PER_SECOND,
  seconds: MS_PER_SECOND,
  m: MS_PER_MINUTE,
  min: MS_PER_MINUTE,
  mins: MS_PER_MINUTE,
  minute: MS_PER_MINUTE,
  minutes: MS_PER_MINUTE,
  h: MS_PER_HOUR,
  hr: MS_PER_HOUR,
  hour: MS_PER_HOUR,
  hours: MS_PER_HOUR,
};

/**
 * Parse a timecode into milliseconds.
 *
 * Accepts every shape the common subtitle formats throw at us:
 * `01:02:03,456` (SRT), `01:02:03.456` (WebVTT), `1:02:03.45` (ASS,
 * centiseconds), `02:03.500` and even `03`.
 *
 * @param {string} input
 * @returns {number} milliseconds, or `NaN` when the input is not a timecode
 */
export function parseTimecode(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : NaN;
  if (typeof input !== 'string') return NaN;

  const trimmed = input.trim();
  if (!trimmed) return NaN;

  const negative = trimmed.startsWith('-');
  const match = TIMECODE_RE.exec(negative ? trimmed.slice(1) : trimmed);
  if (!match) return NaN;

  const [, a, b, c, frac] = match;

  // With three groups it is hh:mm:ss; with two it is mm:ss; with one, ss.
  let hours = 0;
  let minutes = 0;
  const seconds = Number(c);

  if (a !== undefined && b !== undefined) {
    hours = Number(a);
    minutes = Number(b);
  } else if (a !== undefined) {
    minutes = Number(a);
  }

  if (minutes > 59 || seconds > 59) {
    // Tolerate overflowing values (some tools emit `00:00:75,000`) but keep
    // the arithmetic honest.
    // Intentionally no early return — the maths below handles it.
  }

  const millis = frac === undefined ? 0 : Number(frac.padEnd(3, '0'));
  const total = hours * MS_PER_HOUR + minutes * MS_PER_MINUTE + seconds * MS_PER_SECOND + millis;

  return negative ? -total : total;
}

/**
 * Parse a human duration such as `2.5s`, `250ms`, `-1m`, or a raw timecode.
 * Bare numbers are interpreted as **seconds**.
 *
 * @param {string|number} input
 * @returns {number} milliseconds, or `NaN`
 */
export function parseDuration(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : NaN;
  if (typeof input !== 'string') return NaN;

  const trimmed = input.trim();
  if (!trimmed) return NaN;

  if (trimmed.includes(':')) return parseTimecode(trimmed);

  const match = DURATION_RE.exec(trimmed);
  if (!match) return NaN;

  const value = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const factor = DURATION_UNITS[unit];
  if (factor === undefined) return NaN;

  return Math.round(value * factor);
}

/**
 * @param {number} ms
 * @param {{ separator?: string, fractionDigits?: number, hourDigits?: number, clamp?: boolean }} [options]
 * @returns {string}
 */
export function formatTimecode(ms, options = {}) {
  const { separator = ',', fractionDigits = 3, hourDigits = 2, clamp = true } = options;

  let value = Math.round(Number(ms) || 0);
  const negative = value < 0;
  if (negative && clamp) value = 0;
  const abs = Math.abs(value);

  const scale = 10 ** (3 - fractionDigits);
  // Round the fraction at the requested precision, then carry into seconds.
  const totalAtPrecision = Math.round(abs / scale);
  const fraction = totalAtPrecision % (10 ** fractionDigits);
  const totalSeconds = Math.floor(totalAtPrecision / 10 ** fractionDigits);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const head =
    `${String(hours).padStart(hourDigits, '0')}:` +
    `${String(minutes).padStart(2, '0')}:` +
    `${String(seconds).padStart(2, '0')}`;

  const tail = fractionDigits > 0 ? separator + String(fraction).padStart(fractionDigits, '0') : '';

  return (negative && !clamp ? '-' : '') + head + tail;
}

/** `00:01:02,345` */
export function formatSrtTime(ms) {
  return formatTimecode(ms, { separator: ',', fractionDigits: 3, hourDigits: 2 });
}

/** `00:01:02.345` */
export function formatVttTime(ms) {
  return formatTimecode(ms, { separator: '.', fractionDigits: 3, hourDigits: 2 });
}

/** `0:01:02.34` (ASS uses centiseconds and a single hour digit) */
export function formatAssTime(ms) {
  return formatTimecode(ms, { separator: '.', fractionDigits: 2, hourDigits: 1 });
}

/** `[01:02.34]` (LRC) */
export function formatLrcTime(ms) {
  const value = Math.max(0, Math.round(Number(ms) || 0));
  const totalCs = Math.round(value / 10);
  const centis = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return (
    `[${String(minutes).padStart(2, '0')}:` +
    `${String(seconds).padStart(2, '0')}.` +
    `${String(centis).padStart(2, '0')}]`
  );
}

/**
 * Compact, human friendly duration: `1h02m03s`, `2.5s`, `340ms`.
 * @param {number} ms
 * @returns {string}
 */
export function formatHuman(ms) {
  const value = Math.round(Number(ms) || 0);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs < 1000) return `${sign}${abs}ms`;
  if (abs < MS_PER_MINUTE) return `${sign}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}s`;

  const hours = Math.floor(abs / MS_PER_HOUR);
  const minutes = Math.floor((abs % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.round((abs % MS_PER_MINUTE) / 1000);

  if (hours > 0) {
    return `${sign}${hours}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
  }
  return `${sign}${minutes}m${String(seconds).padStart(2, '0')}s`;
}

/**
 * Common broadcast frame rates, handy for `subzen fps`.
 * @type {Record<string, number>}
 */
export const FRAME_RATES = {
  film: 24,
  ntsc_film: 24000 / 1001,
  pal: 25,
  ntsc: 30000 / 1001,
  ntsc_video: 30000 / 1001,
  web: 30,
  hfr: 60,
};

/**
 * Resolve a frame rate given either a number or a named preset.
 * @param {string|number} input
 * @returns {number} NaN when unknown
 */
export function resolveFrameRate(input) {
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? input : NaN;
  if (typeof input !== 'string') return NaN;

  const key = input.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (key in FRAME_RATES) return FRAME_RATES[key];

  const numeric = Number(key);
  if (Number.isFinite(numeric) && numeric > 0) {
    // 23.976 and 29.97 are shorthands for the exact 1000/1001 ratios.
    if (Math.abs(numeric - 23.976) < 0.0005) return 24000 / 1001;
    if (Math.abs(numeric - 29.97) < 0.0005) return 30000 / 1001;
    if (Math.abs(numeric - 59.94) < 0.0005) return 60000 / 1001;
    return numeric;
  }
  return NaN;
}
