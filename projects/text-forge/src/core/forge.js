// Pure, zero-dependency text transformation toolkit. Works in Node (ESM) and
// the browser. Unicode-aware: keeps CJK in slugs, handles full/half-width, and
// strips diacritics via Unicode normalization.

const CJK = '\\u4e00-\\u9fff\\u3400-\\u4dbf';

// Split a string into words: ASCII letter/digit runs and individual CJK chars.
function splitWords(s) {
  let t = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  const m = t.match(/[A-Za-z0-9]+|[\u4e00-\u9fff\u3400-\u4dbf]/g);
  return m || [];
}

export function slugify(input, opts = {}) {
  const { lower = true, sep = '-' } = opts;
  if (typeof sep !== 'string' || sep.length === 0) throw new Error('sep 必须是非空字符串');
  const escapedSep = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let s = String(input == null ? '' : input);
  s = s.normalize('NFKC');
  if (lower) s = s.toLowerCase();
  // keep ASCII alphanumerics + CJK; replace everything else with the separator
  s = s.replace(new RegExp(`[^a-z0-9${CJK}]`, 'gi'), () => sep);
  s = s.replace(new RegExp(`(?:${escapedSep})+`, 'g'), () => sep);
  s = s.replace(new RegExp(`^(?:${escapedSep})+|(?:${escapedSep})+$`, 'g'), '');
  return s;
}

function toCamel(s) {
  return splitWords(s).map((w, i) => (
    i === 0 ? w.charAt(0).toLowerCase() + w.slice(1)
      : w.charAt(0).toUpperCase() + w.slice(1)
  )).join('');
}
function toPascal(s) {
  return splitWords(s).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
function toSnake(s) {
  return splitWords(s).map((w) => w.toLowerCase()).join('_');
}
function toKebab(s) {
  return splitWords(s).map((w) => w.toLowerCase()).join('-');
}
function toConstant(s) {
  return toSnake(s).toUpperCase();
}
function toTitle(s) {
  return splitWords(s).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
function toSentence(s) {
  return splitWords(s).map((w, i) => (
    i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      : w.toLowerCase()
  )).join(' ');
}

export function toCase(input, mode) {
  const s = String(input == null ? '' : input);
  switch (mode) {
    case 'camel': return toCamel(s);
    case 'pascal': return toPascal(s);
    case 'snake': return toSnake(s);
    case 'kebab': return toKebab(s);
    case 'constant': return toConstant(s);
    case 'title': return toTitle(s);
    case 'lower': return s.toLowerCase();
    case 'upper': return s.toUpperCase();
    case 'sentence': return toSentence(s);
    default: throw new Error('未知大小写模式: ' + mode);
  }
}

const FORMS = new Set(['NFC', 'NFD', 'NFKC', 'NFKD']);

export function normalizeUnicode(input, form) {
  const f = String(form || '');
  if (!FORMS.has(f)) throw new Error('normalizeUnicode 需要 NFC/NFD/NFKC/NFKD，收到: ' + f);
  return String(input).normalize(f);
}

export function removeDiacritics(input) {
  return String(input).normalize('NFD').replace(/\p{M}/gu, '');
}

// Convert width between full-width (U+FF01..U+FF5E, full space U+3000) and
// half-width (ASCII 0x20..0x7E).
export function width(input, to) {
  const s = String(input);
  if (to === 'full') {
    return s.replace(/[!-~ ]/g, (ch) => {
      if (ch === ' ') return '　';
      return String.fromCharCode(ch.charCodeAt(0) - 0x20 + 0xFF00);
    });
  }
  if (to === 'half') {
    return s.replace(/[！-～　]/g, (ch) => {
      if (ch === '　') return ' ';
      const code = ch.charCodeAt(0);
      if (code >= 0xFF01 && code <= 0xFF5E) return String.fromCharCode(code - 0xFF00 + 0x20);
      return ch;
    });
  }
  throw new Error('width 方向必须是 "full" 或 "half"');
}

export function toFullWidth(input) { return width(input, 'full'); }
export function toHalfWidth(input) { return width(input, 'half'); }

export function cleanWhitespace(input, opts = {}) {
  const { collapse = true, trim = true } = opts;
  let s = String(input == null ? '' : input);
  if (collapse) s = s.replace(/\s+/g, ' ');
  if (trim) s = s.trim();
  return s;
}
