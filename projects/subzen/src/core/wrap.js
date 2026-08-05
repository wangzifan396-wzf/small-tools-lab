/**
 * Line breaking for subtitles.
 *
 * Two things make this harder than `String.prototype.split(' ')`:
 *
 * 1. **CJK breaks anywhere** — there are no spaces, but not *every* position
 *    is legal. Japanese/Chinese typography calls the exceptions 禁則処理
 *    (kinsoku shori): a line may not start with `，。！` and may not end with
 *    an opening bracket.
 * 2. **Balance beats greed.** A subtitle split as 38/4 characters reads far
 *    worse than 21/21, even though both fit. Greedy wrapping always produces
 *    the first one.
 *
 * @module core/wrap
 */

import { displayWidth, stripTags, isCjkChar, isWide, NO_LINE_START, NO_LINE_END } from './text.js';

const TOKEN_RE = /(<\/?[A-Za-z][^<>]*>|\{[^{}]*\})|([ \t\u00a0]+)|([A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*)|([\s\S])/gu;

/**
 * @typedef {Object} Unit
 * @property {string} text
 * @property {number} width
 * @property {boolean} spaceBefore
 * @property {boolean} breakableBefore
 */

/**
 * Split text into break-aware units.
 * @param {string} text
 * @returns {Unit[]}
 */
export function tokenize(text) {
  const source = String(text ?? '').replace(/\s+/g, ' ').trim();
  /** @type {Unit[]} */
  const units = [];
  let pendingSpace = false;
  let afterMarkup = false;

  TOKEN_RE.lastIndex = 0;
  let match;
  while ((match = TOKEN_RE.exec(source)) !== null) {
    const [, markup, space, word, other] = match;

    if (space !== undefined) {
      pendingSpace = true;
      continue;
    }

    const piece = markup ?? word ?? other ?? '';
    if (!piece) continue;

    const isMarkup = markup !== undefined;
    const prev = units[units.length - 1];
    const prevChar = prev ? [...stripTags(prev.text)].pop() ?? '' : '';
    const firstChar = [...piece][0] ?? '';

    let breakable = pendingSpace;
    if (!breakable && prev && !isMarkup && !afterMarkup) {
      // A break is allowed at a CJK boundary even without whitespace.
      breakable = isCjkChar(firstChar) || (prevChar !== '' && isCjkChar(prevChar));
    }

    // 禁則処理 — never orphan punctuation onto a new line, never leave an
    // opening bracket dangling at the end of one.
    if (NO_LINE_START.includes(firstChar)) breakable = false;
    if (prevChar && NO_LINE_END.includes(prevChar)) breakable = false;
    if (isMarkup) breakable = false;

    units.push({
      text: piece,
      width: isMarkup ? 0 : displayWidth(piece),
      spaceBefore: pendingSpace,
      breakableBefore: units.length === 0 ? false : breakable,
    });

    pendingSpace = false;
    afterMarkup = isMarkup;
  }

  return units;
}

/**
 * @param {Unit[]} units
 * @param {number} from
 * @param {number} to
 * @returns {string}
 */
function render(units, from, to) {
  let out = '';
  for (let i = from; i < to; i += 1) {
    if (i > from && units[i].spaceBefore) out += ' ';
    out += units[i].text;
  }
  return out;
}

/**
 * @param {Unit[]} units
 * @param {number} from
 * @param {number} to
 * @returns {number}
 */
function measure(units, from, to) {
  let width = 0;
  for (let i = from; i < to; i += 1) {
    if (i > from && units[i].spaceBefore) width += 1;
    width += units[i].width;
  }
  return width;
}

/**
 * Classic greedy wrap, kinsoku-aware.
 * @param {Unit[]} units
 * @param {number} maxWidth
 * @returns {string[]}
 */
export function greedyWrap(units, maxWidth) {
  if (units.length === 0) return [];
  /** @type {string[]} */
  const lines = [];
  let start = 0;

  while (start < units.length) {
    let width = 0;
    let end = start;
    while (end < units.length) {
      const add = (end > start && units[end].spaceBefore ? 1 : 0) + units[end].width;
      if (end > start && width + add > maxWidth) break;
      width += add;
      end += 1;
    }

    if (end >= units.length) {
      lines.push(render(units, start, units.length));
      break;
    }

    // `end` overflows. Retreat to the last legal break point.
    let cut = -1;
    for (let j = end; j > start; j -= 1) {
      if (units[j].breakableBefore) {
        cut = j;
        break;
      }
    }

    if (cut === -1) {
      // Nothing legal behind us — run forward until a break becomes legal.
      cut = end;
      while (cut < units.length && !units[cut].breakableBefore) cut += 1;
      if (cut >= units.length) {
        lines.push(render(units, start, units.length));
        break;
      }
    }

    lines.push(render(units, start, cut));
    start = cut;
  }

  return lines.filter((line) => line.length > 0);
}

/**
 * Wrap a single logical line into display lines.
 *
 * @param {string} text
 * @param {{ width?: number, maxLines?: number, balance?: boolean }} [options]
 * @returns {string[]}
 */
export function wrapText(text, options = {}) {
  const { width = 42, maxLines = 2, balance = true } = options;
  const units = tokenize(text);
  if (units.length === 0) return [];

  const total = measure(units, 0, units.length);
  if (total <= width) return [render(units, 0, units.length)];

  if (!balance) return greedyWrap(units, width);

  // Try progressively narrower targets and keep the most even result that
  // still fits within `maxLines`.
  const lower = Math.max(1, Math.ceil(total / maxLines));
  /** @type {string[]|null} */
  let best = null;
  let bestScore = Infinity;

  for (let target = lower; target <= width; target += 1) {
    const lines = greedyWrap(units, target);
    if (lines.length === 0) continue;
    if (lines.length > maxLines) continue;

    const widths = lines.map((line) => displayWidth(stripTags(line)));
    const widest = Math.max(...widths);
    if (widest > width) continue;

    // Prefer fewer lines, then the smallest spread between them.
    const spread = widest - Math.min(...widths);
    const score = lines.length * 1000 + spread;
    if (score < bestScore) {
      bestScore = score;
      best = lines;
    }
  }

  return best ?? greedyWrap(units, width);
}

/**
 * Undo a line break the way a human would.
 *
 * Naively joining with a space is the single most common way tools corrupt
 * Chinese subtitles: `第一行` + `第二行` must become `第一行第二行`, not
 * `第一行 第二行`. A space is only correct when at least one side is Latin
 * text.
 *
 * @param {string[]} lines
 * @returns {string}
 */
export function joinLines(lines) {
  let out = '';
  for (const raw of lines) {
    const piece = String(raw ?? '').trim();
    if (!piece) continue;
    if (!out) {
      out = piece;
      continue;
    }
    const prev = [...stripTags(out)].pop() ?? '';
    const next = [...stripTags(piece)][0] ?? '';
    const prevWide = prev ? isWide(prev.codePointAt(0) ?? 0) : false;
    const nextWide = next ? isWide(next.codePointAt(0) ?? 0) : false;

    let space;
    if (prevWide === nextWide) {
      space = !prevWide; // Latin ↔ Latin needs a space, CJK ↔ CJK never does.
    } else {
      space = /[A-Za-z0-9]/.test(prevWide ? next : prev); // 盘古之白
    }

    out += (space ? ' ' : '') + piece;
  }
  return out.replace(/[ \t]+/g, ' ');
}

/**
 * Re-wrap text that already contains manual line breaks. Existing breaks are
 * discarded — that is the point — unless `respectExisting` is set.
 *
 * @param {string[]} lines
 * @param {{ width?: number, maxLines?: number, balance?: boolean, respectExisting?: boolean }} [options]
 * @returns {string[]}
 */
export function rewrapLines(lines, options = {}) {
  const { respectExisting = false, ...rest } = options;
  if (respectExisting) {
    return lines.flatMap((line) => wrapText(line, rest));
  }
  return wrapText(joinLines(lines), rest);
}
