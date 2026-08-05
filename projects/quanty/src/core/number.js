/**
 * Number formatting helpers (thousands separators, compact notation).
 *
 * The compact formatter is locale-independent and supports both SI
 * (`K`/`M`/`B`/`T`) and Chinese (`万`/`亿`/`万亿`) threshold tables, so its
 * output is deterministic regardless of the host's ICU data.
 *
 * @module core/number
 */

const SI = [
  { v: 1e12, s: 'T' },
  { v: 1e9, s: 'B' },
  { v: 1e6, s: 'M' },
  { v: 1e3, s: 'K' },
  { v: 1, s: '' },
];

const ZH = [
  { v: 1e12, s: '万亿' },
  { v: 1e8, s: '亿' },
  { v: 1e4, s: '万' },
  { v: 1, s: '' },
];

function trimZeros(s) {
  return s.replace(/\.(\d*?)0+$/, (_, d) => '.' + d).replace(/\.$/, '');
}

/**
 * Format a number with optional thousands separators and fractional digits.
 *
 * @param {number} n
 * @param {object} [options]
 * @param {number}  [options.decimals=0]
 * @param {boolean} [options.thousands=true]
 * @param {string}  [options.locale]  When set, delegates to `Intl.NumberFormat`.
 * @returns {string}
 */
export function formatNumber(n, options = {}) {
  const { decimals = 0, thousands = true, locale } = options;
  const num = Number(n);
  if (!Number.isFinite(num)) {
    throw new TypeError(`formatNumber: expected a finite number, got ${String(n)}`);
  }
  if (locale) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: thousands,
    }).format(num);
  }
  let s = Math.abs(num).toFixed(decimals);
  if (thousands) {
    const [intPart, dec] = s.split('.');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    s = grouped + (dec ? '.' + dec : '');
  }
  return (num < 0 ? '-' : '') + s;
}

/**
 * Compact notation: `1500000` → `"1.5M"` (si) or `"150万"` (zh).
 *
 * @param {number} n
 * @param {object} [options]
 * @param {'si'|'zh'} [options.style='si']
 * @param {number}     [options.decimals=1]
 * @returns {string}
 */
export function formatCompact(n, options = {}) {
  const { style = 'si', decimals = 1 } = options;
  const num = Number(n);
  if (!Number.isFinite(num)) {
    throw new TypeError(`formatCompact: expected a finite number, got ${String(n)}`);
  }
  const table = style === 'zh' ? ZH : SI;
  const abs = Math.abs(num);
  for (const { v, s } of table) {
    if (abs >= v) {
      const scaled = num / v;
      return trimZeros(scaled.toFixed(decimals)) + s;
    }
  }
  return String(num);
}
