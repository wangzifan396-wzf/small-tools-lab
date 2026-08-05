/**
 * CJK-aware text tokenizer.
 *
 * The diff is computed over *tokens*, not characters (except inside CJK runs,
 * where each ideograph is its own token — Chinese has no word spaces, so a
 * character-level granularity is the honest unit of meaning). Latin text is
 * split into words, digits and punctuation; whitespace is preserved as its own
 * token so the original text can always be reconstructed exactly.
 *
 * @module core/tokenize
 */

const CJK_RE =
  /[㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/;

/** A single token of a diffable string. */
export class Token {
  /**
   * @param {string} value
   * @param {'space'|'cjk'|'word'|'punct'} type
   */
  constructor(value, type) {
    this.value = value;
    this.type = type;
  }
}

/** @param {string} ch @returns {boolean} */
export function isCjk(ch) {
  return CJK_RE.test(ch);
}

/**
 * Split text into diffable tokens.
 * @param {string} text
 * @returns {Token[]}
 */
export function tokenize(text) {
  /** @type {Token[]} */
  const out = [];
  const n = text.length;
  let i = 0;

  while (i < n) {
    const ch = text[i];

    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j += 1;
      out.push(new Token(text.slice(i, j), 'space'));
      i = j;
    } else if (isCjk(ch)) {
      out.push(new Token(ch, 'cjk'));
      i += 1;
    } else if (/[\p{L}\p{N}]/u.test(ch)) {
      let j = i + 1;
      while (j < n && /[\p{L}\p{N}]/u.test(text[j])) j += 1;
      out.push(new Token(text.slice(i, j), 'word'));
      i = j;
    } else {
      out.push(new Token(ch, 'punct'));
      i += 1;
    }
  }

  return out;
}

/**
 * Coalesce a token stream back into a string (used by formatters).
 * @param {Token[]} tokens
 * @returns {string}
 */
export function untokenize(tokens) {
  return tokens.map((t) => t.value).join('');
}
