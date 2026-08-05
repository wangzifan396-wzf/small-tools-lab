/**
 * CJK typography rules.
 *
 * These are the rules that do not exist in any other subtitle linter, and
 * they are the reason subzen exists. Every one of them is autofixable, and
 * every one of them stays quiet on tracks that contain no CJK at all.
 *
 * @module rules/cjk
 */

import { cloneCues } from '../core/cue.js';
import {
  analyzeScript,
  addCjkLatinSpacing,
  normalizeCjkPunctuation,
  normalizeFullwidthLatin,
  normalizeEllipsis,
  hasFullwidthLatin,
  stripTrailingPeriod,
  endsWithPeriod,
  isCjkChar,
  mapOutsideMarkup,
  NO_LINE_START,
} from '../core/text.js';

/** @typedef {import('../core/lint.js').Rule} Rule */

/** @param {import('../core/cue.js').Cue} cue @returns {boolean} */
const hasCjk = (cue) => analyzeScript(cue.lines.join('')).cjk > 0;

/**
 * Build a rule that compares each line against a normaliser function.
 * @param {{ id: string, description: string, severity: import('../core/lint.js').Severity, message: string, transform: (line: string) => string, requiresCjk?: boolean }} spec
 * @returns {Rule}
 */
function lineRule(spec) {
  const { id, description, severity, message, transform, requiresCjk = true } = spec;
  return {
    id,
    description,
    severity,
    options: {},
    check(cues) {
      const out = [];
      for (const cue of cues) {
        if (requiresCjk && !hasCjk(cue)) continue;
        cue.lines.forEach((line, i) => {
          const fixed = transform(line);
          if (fixed !== line) out.push({ cue, line: i + 1, message, data: { suggestion: fixed } });
        });
      }
      return out;
    },
    fix(cues) {
      let changed = 0;
      const next = cloneCues(cues).map((cue) => {
        if (requiresCjk && !hasCjk(cue)) return cue;
        const lines = cue.lines.map(transform);
        if (lines.join('\n') !== cue.lines.join('\n')) changed += 1;
        return { ...cue, lines };
      });
      return { cues: next, changed };
    },
  };
}

/** @type {Rule} */
export const cjkLatinSpacing = lineRule({
  id: 'cjk-latin-spacing',
  description: 'Insert a space between CJK and Latin text (盘古之白).',
  severity: 'warn',
  message: 'missing space between CJK and Latin characters',
  transform: addCjkLatinSpacing,
});

/** @type {Rule} */
export const cjkPunctuationWidth = lineRule({
  id: 'cjk-punctuation-width',
  description: 'Use full-width punctuation inside Chinese text (，。！？ not ,.!?).',
  severity: 'warn',
  message: 'half-width punctuation inside CJK text',
  transform: normalizeCjkPunctuation,
});

/** @type {Rule} */
export const noFullwidthLatin = {
  id: 'no-fullwidth-latin',
  description: 'Full-width Latin letters and digits (Ａ１) are almost always an IME slip.',
  severity: 'warn',
  options: {},
  check(cues) {
    const out = [];
    for (const cue of cues) {
      cue.lines.forEach((line, i) => {
        if (hasFullwidthLatin(line)) {
          out.push({
            cue,
            line: i + 1,
            message: 'full-width Latin letters or digits',
            data: { suggestion: normalizeFullwidthLatin(line) },
          });
        }
      });
    }
    return out;
  },
  fix(cues) {
    let changed = 0;
    const next = cloneCues(cues).map((cue) => {
      const lines = cue.lines.map(normalizeFullwidthLatin);
      if (lines.join('\n') !== cue.lines.join('\n')) changed += 1;
      return { ...cue, lines };
    });
    return { cues: next, changed };
  },
};

/** @type {Rule} */
export const ellipsisStyle = lineRule({
  id: 'ellipsis-style',
  description: 'Normalise `...` and `。。。` to a proper ellipsis.',
  severity: 'info',
  message: 'non-standard ellipsis',
  transform: normalizeEllipsis,
  requiresCjk: false,
});

/**
 * Spaces between two CJK characters are a hallmark of speech-recognition
 * output and word-segmentation leaks. Chinese does not use them.
 * @type {Rule}
 */
export const noCjkSpace = {
  id: 'no-cjk-space',
  description: 'Remove stray spaces between two CJK characters.',
  severity: 'warn',
  options: {},
  check(cues) {
    const out = [];
    for (const cue of cues) {
      cue.lines.forEach((line, i) => {
        const fixed = removeCjkSpaces(line);
        if (fixed !== line) {
          out.push({ cue, line: i + 1, message: 'space between CJK characters', data: { suggestion: fixed } });
        }
      });
    }
    return out;
  },
  fix(cues) {
    let changed = 0;
    const next = cloneCues(cues).map((cue) => {
      const lines = cue.lines.map(removeCjkSpaces);
      if (lines.join('\n') !== cue.lines.join('\n')) changed += 1;
      return { ...cue, lines };
    });
    return { cues: next, changed };
  },
};

/**
 * Broadcast subtitles conventionally drop the sentence-final period — the
 * cue boundary already ends the sentence.
 * @type {Rule}
 */
export const noLineEndPeriod = {
  id: 'no-line-end-period',
  description: 'Drop the trailing full stop on the last line of a cue.',
  severity: 'info',
  options: {},
  check(cues) {
    const out = [];
    for (const cue of cues) {
      const last = lastVisibleIndex(cue.lines);
      if (last === -1) continue;
      if (endsWithPeriod(cue.lines[last])) {
        out.push({ cue, line: last + 1, message: 'cue ends with a full stop' });
      }
    }
    return out;
  },
  fix(cues) {
    let changed = 0;
    const next = cloneCues(cues).map((cue) => {
      const last = lastVisibleIndex(cue.lines);
      if (last === -1 || !endsWithPeriod(cue.lines[last])) return cue;
      const lines = [...cue.lines];
      lines[last] = stripTrailingPeriod(lines[last]);
      changed += 1;
      return { ...cue, lines };
    });
    return { cues: next, changed };
  },
};

/**
 * 禁則処理 — a line must never begin with closing punctuation.
 * @type {Rule}
 */
export const cjkLineStart = {
  id: 'cjk-line-start',
  description: 'A wrapped line must not start with closing punctuation (行首禁则).',
  severity: 'warn',
  options: {},
  check(cues) {
    const out = [];
    for (const cue of cues) {
      for (let i = 1; i < cue.lines.length; i += 1) {
        const first = [...cue.lines[i].trimStart()][0];
        if (first && NO_LINE_START.includes(first)) {
          out.push({ cue, line: i + 1, message: `line starts with "${first}"` });
        }
      }
    }
    return out;
  },
  fix(cues) {
    let changed = 0;
    const next = cloneCues(cues).map((cue) => {
      const lines = [...cue.lines];
      let touched = false;
      for (let i = 1; i < lines.length; i += 1) {
        let guard = 0;
        while (guard < 4) {
          const trimmed = lines[i].trimStart();
          const first = [...trimmed][0];
          if (!first || !NO_LINE_START.includes(first)) break;
          lines[i - 1] += first;
          lines[i] = trimmed.slice(first.length);
          touched = true;
          guard += 1;
        }
      }
      if (touched) changed += 1;
      return touched ? { ...cue, lines } : cue;
    });
    return { cues: next, changed };
  },
};

/** @param {string[]} lines @returns {number} */
function lastVisibleIndex(lines) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim() !== '') return i;
  }
  return -1;
}

/** @param {string} line @returns {string} */
function removeCjkSpaces(line) {
  return mapOutsideMarkup(line, (chunk) => {
    const chars = [...chunk];
    /** @type {string[]} */
    const out = [];
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i];
      if (ch === ' ' && isCjkChar(chars[i - 1] ?? '') && isCjkChar(chars[i + 1] ?? '')) continue;
      out.push(ch);
    }
    return out.join('');
  });
}

export default [
  cjkLatinSpacing,
  cjkPunctuationWidth,
  noFullwidthLatin,
  noCjkSpace,
  ellipsisStyle,
  noLineEndPeriod,
  cjkLineStart,
];
