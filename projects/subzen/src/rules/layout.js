/**
 * Layout and hygiene rules — line count, line width, leftover markup and
 * accidental duplicates.
 *
 * @module rules/layout
 */

import { cueText, cloneCues } from '../core/cue.js';
import { displayWidth, stripTags, hasMarkup } from '../core/text.js';
import { rewrapLines } from '../core/wrap.js';
import { formatHuman } from '../core/timecode.js';

/** @typedef {import('../core/lint.js').Rule} Rule */

/** @type {Rule} */
export const noEmptyCue = {
  id: 'no-empty-cue',
  description: 'A cue with no visible text wastes a slot and confuses players.',
  severity: 'warn',
  options: {},
  check(cues) {
    return cues
      .filter((cue) => stripTags(cueText(cue, '')).trim() === '')
      .map((cue) => ({ cue, message: 'cue has no visible text' }));
  },
  fix(cues) {
    const before = cues.length;
    const next = cues.filter((cue) => stripTags(cueText(cue, '')).trim() !== '').map((c) => ({
      ...c,
      lines: [...c.lines],
    }));
    return { cues: next, changed: before - next.length };
  },
};

/** @type {Rule} */
export const maxLines = {
  id: 'max-lines',
  description: 'Two lines is the ceiling for readable subtitles; three is a wall of text.',
  severity: 'warn',
  options: { max: 2, width: 40 },
  check(cues, options) {
    const max = options.max ?? 2;
    return cues
      .filter((cue) => cue.lines.filter((l) => l.trim() !== '').length > max)
      .map((cue) => ({
        cue,
        message: `${cue.lines.filter((l) => l.trim() !== '').length} lines (maximum ${max})`,
      }));
  },
  fix(cues, options) {
    return rewrapFix(cues, options.width ?? 40, options.max ?? 2);
  },
};

/** @type {Rule} */
export const maxLineWidth = {
  id: 'max-line-width',
  description:
    'Line length measured in display columns — a CJK character counts as two, like it renders.',
  severity: 'warn',
  options: { max: 40, maxLines: 2 },
  check(cues, options) {
    const max = options.max ?? 40;
    const out = [];
    for (const cue of cues) {
      cue.lines.forEach((line, i) => {
        const width = displayWidth(stripTags(line));
        if (width > max) {
          out.push({
            cue,
            line: i + 1,
            message: `line is ${width} columns wide (maximum ${max})`,
          });
        }
      });
    }
    return out;
  },
  fix(cues, options) {
    return rewrapFix(cues, options.max ?? 40, options.maxLines ?? 2);
  },
};

/** @type {Rule} */
export const noMarkup = {
  id: 'no-markup',
  description: 'Styling tags left in the text — often the residue of a bad conversion.',
  severity: 'info',
  options: {},
  check(cues) {
    return cues
      .filter((cue) => hasMarkup(cueText(cue, '\n')))
      .map((cue) => ({ cue, message: 'contains styling markup' }));
  },
  fix(cues) {
    let changed = 0;
    const next = cloneCues(cues).map((cue) => {
      const stripped = cue.lines.map((line) => stripTags(line).replace(/\s+/g, ' ').trim());
      if (stripped.join('\n') !== cue.lines.join('\n')) changed += 1;
      return { ...cue, lines: stripped };
    });
    return { cues: next, changed };
  },
};

/** @type {Rule} */
export const trailingWhitespace = {
  id: 'trailing-whitespace',
  description: 'Leading or trailing spaces shift the text off-centre in some players.',
  severity: 'info',
  options: {},
  check(cues) {
    const out = [];
    for (const cue of cues) {
      cue.lines.forEach((line, i) => {
        if (line !== line.trim() && line.trim() !== '') {
          out.push({ cue, line: i + 1, message: 'line has leading or trailing whitespace' });
        }
      });
    }
    return out;
  },
  fix(cues) {
    let changed = 0;
    const next = cloneCues(cues).map((cue) => {
      const trimmed = cue.lines.map((line) => line.trim());
      if (trimmed.join('\n') !== cue.lines.join('\n')) changed += 1;
      return { ...cue, lines: trimmed };
    });
    return { cues: next, changed };
  },
};

/** @type {Rule} */
export const noDuplicateAdjacent = {
  id: 'no-duplicate-adjacent',
  description: 'The same text repeated back to back — usually an ASR or merge artefact.',
  severity: 'warn',
  options: { maxGap: 500 },
  check(cues, options) {
    const maxGap = options.maxGap ?? 500;
    const out = [];
    for (let i = 1; i < cues.length; i += 1) {
      const prev = cues[i - 1];
      const cur = cues[i];
      if (key(prev) && key(prev) === key(cur) && cur.start - prev.end <= maxGap) {
        out.push({ cue: cur, message: 'identical to the previous cue' });
      }
    }
    return out;
  },
  fix(cues, options) {
    const maxGap = options.maxGap ?? 500;
    /** @type {import('../core/cue.js').Cue[]} */
    const next = [];
    let changed = 0;
    for (const cue of cloneCues(cues)) {
      const prev = next[next.length - 1];
      if (prev && key(prev) && key(prev) === key(cue) && cue.start - prev.end <= maxGap) {
        prev.end = Math.max(prev.end, cue.end);
        changed += 1;
        continue;
      }
      next.push(cue);
    }
    return { cues: next, changed };
  },
};

/** @type {Rule} */
export const gapTooLong = {
  id: 'gap-too-long',
  description: 'A long silence may mean a missing translation. Informational by default.',
  severity: 'off',
  options: { max: 30000 },
  check(cues, options) {
    const max = options.max ?? 30000;
    const out = [];
    for (let i = 1; i < cues.length; i += 1) {
      const gap = cues[i].start - cues[i - 1].end;
      if (gap > max) {
        out.push({ cue: cues[i], message: `${formatHuman(gap)} of silence before this cue` });
      }
    }
    return out;
  },
};

/**
 * @param {import('../core/cue.js').Cue} cue
 * @returns {string}
 */
function key(cue) {
  return stripTags(cueText(cue, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * @param {import('../core/cue.js').Cue[]} cues
 * @param {number} width
 * @param {number} lines
 */
function rewrapFix(cues, width, lines) {
  let changed = 0;
  const next = cloneCues(cues).map((cue) => {
    const nonEmpty = cue.lines.filter((l) => l.trim() !== '');
    if (nonEmpty.length === 0) return cue;

    const tooWide = nonEmpty.some((l) => displayWidth(stripTags(l)) > width);
    const tooMany = nonEmpty.length > lines;
    if (!tooWide && !tooMany) return cue;

    const wrapped = rewrapLines(nonEmpty, { width, maxLines: lines, balance: true });
    if (wrapped.length && wrapped.join('\n') !== cue.lines.join('\n')) {
      changed += 1;
      return { ...cue, lines: wrapped };
    }
    return cue;
  });
  return { cues: next, changed };
}

export default [
  noEmptyCue,
  maxLines,
  maxLineWidth,
  noMarkup,
  trailingWhitespace,
  noDuplicateAdjacent,
  gapTooLong,
];
