/**
 * Byte-size formatting & parsing.
 *
 * Supports both binary (IEC, 1024-based: KiB/MiB/…) and decimal (SI,
 * 1000-based: kB/MB/…) conventions, locale-aware decimal separators, and a
 * lossless `parseBytes` inverse.
 *
 * @module core/bytes
 */

const UNITS_BINARY = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];
const UNITS_SI = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB'];

const UNIT_MULTIPLIERS = {
  b: 1,
  k: 1e3, kb: 1e3, kib: 1024,
  m: 1e6, mb: 1e6, mib: 1024 ** 2,
  g: 1e9, gb: 1e9, gib: 1024 ** 3,
  t: 1e12, tb: 1e12, tib: 1024 ** 4,
  p: 1e15, pb: 1e15, pib: 1024 ** 5,
  e: 1e18, eb: 1e18, eib: 1024 ** 6,
};

/**
 * Trim trailing zeros from a fixed-decimal string without mangling integers.
 * @param {string} s
 * @returns {string}
 */
function trimZeros(s) {
  return s.replace(/\.(\d*?)0+$/, (_, d) => '.' + d).replace(/\.$/, '');
}

/**
 * Format a byte count into a human-readable string.
 *
 * @param {number} bytes
 * @param {object} [options]
 * @param {boolean} [options.binary=true]  Use 1024-based units (KiB) when true, 1000-based (kB) when false.
 * @param {number}  [options.decimals=1]   Fractional digits.
 * @param {string}  [options.locale]        BCP-47 tag; when set, decimal/grouping follow the locale.
 * @param {boolean} [options.trimZero=true] Drop a trailing `.0`.
 * @returns {string}
 */
export function formatBytes(bytes, options = {}) {
  const { binary = true, decimals = 1, locale, trimZero = true } = options;
  const n = Number(bytes);
  if (!Number.isFinite(n)) {
    throw new TypeError(`formatBytes: expected a finite number, got ${String(bytes)}`);
  }
  if (n < 0) {
    throw new RangeError('formatBytes: bytes cannot be negative');
  }
  if (n === 0) return `0 ${binary ? 'B' : 'B'}`;

  const base = binary ? 1024 : 1000;
  const units = binary ? UNITS_BINARY : UNITS_SI;
  let i = 0;
  let value = n;
  while (value >= base && i < units.length - 1) {
    value /= base;
    i += 1;
  }

  let numStr;
  if (locale) {
    numStr = new Intl.NumberFormat(locale, {
      minimumFractionDigits: trimZero ? 0 : decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } else {
    numStr = trimZero ? trimZeros(value.toFixed(decimals)) : value.toFixed(decimals);
  }
  return `${numStr} ${units[i]}`;
}

/**
 * Parse a human-readable byte string back into a number of bytes.
 * Inverse of `formatBytes` (case-insensitive, e.g. `"1.5 KiB"` → `1536`).
 *
 * @param {string|number} input
 * @returns {number}
 */
export function parseBytes(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new TypeError('parseBytes: expected a finite number');
    return input;
  }
  const m = String(input).trim().match(/^([-+]?\d*\.?\d+)\s*([a-z]*)$/i);
  if (!m) throw new Error(`parseBytes: cannot parse "${String(input)}"`);
  const value = parseFloat(m[1]);
  const unit = (m[2] || 'b').toLowerCase();
  const mult = UNIT_MULTIPLIERS[unit];
  if (mult === undefined) throw new Error(`parseBytes: unknown unit "${unit}"`);
  return value * mult;
}
