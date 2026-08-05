/**
 * Ordinal suffixes for English and Chinese.
 *
 * @module core/ordinal
 */

/**
 * @param {number} n
 * @param {object} [options]
 * @param {'en'|'zh'} [options.lang='en']
 * @returns {string} e.g. `"22nd"` (en) or `"第22"` (zh)
 */
export function ordinal(n, options = {}) {
  const { lang = 'en' } = options;
  const num = Math.floor(Number(n));
  if (!Number.isFinite(num)) {
    throw new TypeError(`ordinal: expected a finite number, got ${String(n)}`);
  }
  if (lang === 'zh') return `第${num}`;
  const abs = Math.abs(num) % 100;
  let suffix = 'th';
  if (abs % 10 === 1 && abs !== 11) suffix = 'st';
  else if (abs % 10 === 2 && abs !== 12) suffix = 'nd';
  else if (abs % 10 === 3 && abs !== 13) suffix = 'rd';
  return `${num}${suffix}`;
}
