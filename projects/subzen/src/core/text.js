/**
 * CJK-aware text analysis.
 *
 * This is the part most subtitle tools get wrong. A line of 40 Latin
 * characters and a line of 40 Chinese characters are *not* comparable:
 * the CJK line is twice as wide on screen and takes roughly twice as long
 * to read. Everything in subzen that measures text goes through here.
 *
 * @module core/text
 */

/** Code point ranges rendered at double width in a monospace/subtitle context. */
const WIDE_RANGES = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2e80, 0x303e], // CJK radicals, Kangxi, CJK symbols & punctuation
  [0x3041, 0x33ff], // Kana, Bopomofo, Hangul compat, enclosed CJK
  [0x3400, 0x4dbf], // CJK Unified Ext A
  [0x4e00, 0x9fff], // CJK Unified
  [0xa000, 0xa4cf], // Yi
  [0xa960, 0xa97f], // Hangul Jamo Extended-A
  [0xac00, 0xd7a3], // Hangul syllables
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xfe10, 0xfe19], // Vertical forms
  [0xfe30, 0xfe6f], // CJK compatibility forms, small form variants
  [0xff00, 0xff60], // Fullwidth forms
  [0xffe0, 0xffe6], // Fullwidth signs
  [0x1f300, 0x1f64f], // Emoji
  [0x1f900, 0x1f9ff], // Supplemental emoji
  [0x20000, 0x2fffd], // CJK Ext B+
  [0x30000, 0x3fffd],
];

/** Ranges that count as "CJK script" for language detection (no fullwidth Latin). */
const IDEOGRAPH_RANGES = [
  [0x3040, 0x30ff], // Hiragana + Katakana
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xac00, 0xd7a3], // Hangul
  [0xf900, 0xfaff],
  [0x20000, 0x2fffd],
];

const ZERO_WIDTH = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]);

/** Punctuation that must never start a line (行首禁则). */
export const NO_LINE_START = '，。、；：！？）］｝〉》」』】〕…‥・ー～%,.;:!?)]}>\'"’”';

/** Punctuation that must never end a line (行尾禁则). */
export const NO_LINE_END = '（［｛〈《「『【〔([{<\'"‘“¥$';

/** Sentence-ending punctuation, both widths. */
export const SENTENCE_END = '。．.！!？?';

const inRanges = (cp, ranges) => {
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
    if (cp < lo) return false;
  }
  return false;
};

/** @param {number} cp @returns {boolean} */
export function isWide(cp) {
  return inRanges(cp, WIDE_RANGES);
}

/** @param {number} cp @returns {boolean} */
export function isIdeograph(cp) {
  return inRanges(cp, IDEOGRAPH_RANGES);
}

/** @param {string} ch @returns {boolean} */
export function isCjkChar(ch) {
  const cp = ch.codePointAt(0);
  return cp === undefined ? false : isIdeograph(cp);
}

/**
 * On-screen width where a Latin character is 1 and a CJK character is 2.
 * Combining marks and zero-width characters contribute nothing.
 *
 * @param {string} text
 * @returns {number}
 */
export function displayWidth(text) {
  let width = 0;
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ZERO_WIDTH.has(cp)) continue;
    if (cp >= 0x0300 && cp <= 0x036f) continue; // combining diacritics
    width += isWide(cp) ? 2 : 1;
  }
  return width;
}

/**
 * Remove markup so we measure what the viewer actually reads.
 * Handles HTML-ish tags (`<i>`, `<font color=…>`), ASS override blocks
 * (`{\an8}`), ASS drawing commands and the `\N` / `\h` escapes.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripTags(text) {
  return String(text ?? '')
    .replace(/\{[^{}]*\}/g, '') // ASS override blocks
    .replace(/<\/?[A-Za-z][^<>]*>/g, '') // HTML-ish tags
    .replace(/\\[Nn]/g, '\n')
    .replace(/\\h/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** @param {string} text @returns {boolean} */
export function hasMarkup(text) {
  return /<\/?[A-Za-z][^<>]*>|\{[^{}]*\}/.test(String(text ?? ''));
}

/**
 * Apply `fn` only to the plain-text parts of a string, leaving any markup
 * untouched. Without this, an autofix would happily insert a space inside
 * `<font color="#fff">`.
 *
 * @param {string} text
 * @param {(chunk: string) => string} fn
 * @returns {string}
 */
export function mapOutsideMarkup(text, fn) {
  const source = String(text ?? '');
  const pattern = /(<\/?[A-Za-z][^<>]*>|\{[^{}]*\})/g;
  let result = '';
  let last = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    result += fn(source.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return result + fn(source.slice(last));
}

/**
 * @typedef {Object} ScriptProfile
 * @property {number} cjk       ideographic / kana / hangul characters
 * @property {number} latin     letters and digits in the Latin range
 * @property {number} punct     punctuation and symbols
 * @property {number} space     whitespace
 * @property {number} total     everything except whitespace
 * @property {'cjk'|'latin'|'mixed'|'unknown'} dominant
 */

/**
 * Break a string down by script. Markup is stripped first.
 * @param {string} text
 * @returns {ScriptProfile}
 */
export function analyzeScript(text) {
  const clean = stripTags(text);
  let cjk = 0;
  let latin = 0;
  let punct = 0;
  let space = 0;

  for (const ch of clean) {
    const cp = ch.codePointAt(0) ?? 0;
    if (/\s/.test(ch)) {
      space += 1;
    } else if (isIdeograph(cp)) {
      cjk += 1;
    } else if (/[0-9A-Za-z\u00c0-\u024f]/.test(ch)) {
      latin += 1;
    } else {
      punct += 1;
    }
  }

  const total = cjk + latin + punct;
  /** @type {ScriptProfile['dominant']} */
  let dominant = 'unknown';
  if (total > 0) {
    const letters = cjk + latin;
    if (letters === 0) dominant = 'unknown';
    else if (cjk / letters >= 0.7) dominant = 'cjk';
    else if (latin / letters >= 0.7) dominant = 'latin';
    else dominant = 'mixed';
  }

  return { cjk, latin, punct, space, total, dominant };
}

/**
 * How long the text *should* take to read, in milliseconds.
 *
 * Rather than a single "characters per second" number — which is meaningless
 * for mixed scripts — we treat CJK and Latin as separate budgets and add
 * them. 9 CJK chars/s and 20 Latin chars/s are the widely used broadcast
 * defaults (Netflix, BBC and CCTV guidelines all land near these numbers).
 *
 * @param {string} text
 * @param {{ cjkCps?: number, latinCps?: number }} [options]
 * @returns {number} milliseconds
 */
export function readingTime(text, options = {}) {
  const { cjkCps = 9, latinCps = 20 } = options;
  const { cjk, latin, punct } = analyzeScript(text);
  // Punctuation is not free, but it is cheap — count it at a third of a char.
  const cjkLoad = (cjk + punct * 0.33) / cjkCps;
  const latinLoad = latin / latinCps;
  return Math.round((cjkLoad + latinLoad) * 1000);
}

/**
 * Reading pressure: `> 1` means the cue is on screen for less time than a
 * viewer needs. This is the number `max-cps` actually checks.
 *
 * @param {string} text
 * @param {number} durationMs
 * @param {{ cjkCps?: number, latinCps?: number }} [options]
 * @returns {number}
 */
export function readingPressure(text, durationMs, options = {}) {
  if (durationMs <= 0) return Infinity;
  return readingTime(text, options) / durationMs;
}

/**
 * Plain characters-per-second, for reporting only.
 * @param {string} text
 * @param {number} durationMs
 * @returns {number}
 */
export function charsPerSecond(text, durationMs) {
  if (durationMs <= 0) return Infinity;
  const { total } = analyzeScript(text);
  return (total / durationMs) * 1000;
}

/* ------------------------------------------------------------------ *
 * Typography fixes
 * ------------------------------------------------------------------ */

const CJK_CLASS = '\\u2e80-\\u303e\\u3041-\\u33ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uac00-\\ud7a3';
const LATIN_CLASS = 'A-Za-z0-9';

const CJK_THEN_LATIN = new RegExp(`([${CJK_CLASS}])([${LATIN_CLASS}])`, 'g');
const LATIN_THEN_CJK = new RegExp(`([${LATIN_CLASS}])([${CJK_CLASS}])`, 'g');

/**
 * Insert a space between CJK and Latin/digits — the "盘古之白" convention
 * recommended by most Chinese style guides.
 *
 * @param {string} text
 * @returns {string}
 */
export function addCjkLatinSpacing(text) {
  return mapOutsideMarkup(text, (chunk) =>
    chunk.replace(CJK_THEN_LATIN, '$1 $2').replace(LATIN_THEN_CJK, '$1 $2'),
  );
}

/** @param {string} text @returns {boolean} */
export function needsCjkLatinSpacing(text) {
  return text !== addCjkLatinSpacing(text);
}

const HALF_TO_FULL = { ',': '，', ';': '；', ':': '：', '!': '！', '?': '？', '(': '（', ')': '）' };
const CJK_TEST = new RegExp(`[${CJK_CLASS}]`);

/**
 * Convert half-width punctuation to full-width when it sits inside CJK text.
 * A period between digits (`1.5`) or inside a Latin run (`e.g.`) is left
 * alone — that is the tricky part every naive implementation gets wrong.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeCjkPunctuation(text) {
  return mapOutsideMarkup(text, (chunk) => {
    const chars = [...chunk];
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i];
      const prev = chars[i - 1] ?? '';
      const next = chars[i + 1] ?? '';

      if (ch === '.') {
        if (/\d/.test(prev) && /\d/.test(next)) continue; // 1.5
        if (chars[i + 1] === '.' || chars[i - 1] === '.') continue; // ellipsis
        if (CJK_TEST.test(prev)) chars[i] = '。';
        continue;
      }

      if (ch in HALF_TO_FULL) {
        if (CJK_TEST.test(prev) || CJK_TEST.test(next)) chars[i] = HALF_TO_FULL[ch];
      }
    }
    return chars.join('');
  });
}

/** @param {string} text @returns {boolean} */
export function hasMixedPunctuationWidth(text) {
  return text !== normalizeCjkPunctuation(text);
}

const FULLWIDTH_LATIN = /[\uff01-\uff5e]/;

/**
 * Fullwidth Latin letters, digits and ASCII punctuation (`Ａ１！`) are almost
 * always an IME accident. Convert them back to half-width, but keep the
 * fullwidth punctuation that Chinese actually wants.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeFullwidthLatin(text) {
  return mapOutsideMarkup(text, (chunk) =>
    chunk.replace(/[\uff21-\uff3a\uff41-\uff5a\uff10-\uff19]/g, (ch) =>
      String.fromCharCode((ch.codePointAt(0) ?? 0) - 0xfee0),
    ),
  );
}

/** @param {string} text @returns {boolean} */
export function hasFullwidthLatin(text) {
  return /[\uff21-\uff3a\uff41-\uff5a\uff10-\uff19]/.test(String(text ?? ''));
}

/**
 * `...` → `…`, `。。。` → `……`
 * @param {string} text
 * @returns {string}
 */
export function normalizeEllipsis(text) {
  return mapOutsideMarkup(text, (chunk) =>
    chunk.replace(/。{3,}/g, '……').replace(/\.{3,}/g, (m) => (m.length >= 6 ? '……' : '…')),
  );
}

/** Collapse doubled spaces and trim, without touching newlines. */
export function tidyWhitespace(text) {
  return String(text ?? '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ ?([，。、；：！？])/g, '$1')
    .trim();
}

/**
 * Strip the trailing full stop that broadcast subtitles conventionally omit
 * (`。` and `.`). Question and exclamation marks are kept — they carry tone.
 *
 * @param {string} line
 * @returns {string}
 */
export function stripTrailingPeriod(line) {
  return String(line ?? '').replace(/[。．.]+\s*$/u, '');
}

/** @param {string} line @returns {boolean} */
export function endsWithPeriod(line) {
  const clean = stripTags(line).trimEnd();
  if (!clean) return false;
  if (/\.\.\.$|…$/.test(clean)) return false; // ellipsis is a continuation, not a stop
  return /[。．.]$/.test(clean);
}
