/**
 * Bilingual subtitle merging and splitting.
 *
 * Merging two tracks is not a zip: the translated track rarely has the same
 * number of cues, and its timings drift. subzen matches by **time overlap**,
 * assigning each secondary cue to whichever primary cue it overlaps most,
 * which survives one-to-many and many-to-one splits.
 *
 * @module core/bilingual
 */

import { cloneCues, normalizeCues, overlapMs, overlapRatio, createCue } from './cue.js';
import { analyzeScript } from './text.js';

/**
 * @typedef {Object} MergeOptions
 * @property {number} [minOverlap]     0..1, minimum overlap with the shorter cue (default 0.2)
 * @property {boolean} [keepUnmatched] keep secondary cues that matched nothing (default true)
 * @property {'primary'|'secondary'} [top] which language goes on the first line (default 'primary')
 * @property {string} [separator]      joins the two languages (default '\n')
 */

/**
 * @param {import('./cue.js').Cue[]} primary
 * @param {import('./cue.js').Cue[]} secondary
 * @param {MergeOptions} [options]
 * @returns {{ cues: import('./cue.js').Cue[], matched: number, unmatched: number }}
 */
export function mergeBilingual(primary, secondary, options = {}) {
  const { minOverlap = 0.2, keepUnmatched = true, top = 'primary', separator = '\n' } = options;

  const base = normalizeCues(primary);
  const other = normalizeCues(secondary);

  /** @type {Map<number, string[][]>} */
  const attached = new Map();
  const usedSecondary = new Set();

  for (let s = 0; s < other.length; s += 1) {
    let bestIndex = -1;
    let bestOverlap = 0;

    for (let p = 0; p < base.length; p += 1) {
      // Tracks are sorted, so we can stop once we are past the window.
      if (base[p].start > other[s].end) break;
      const ms = overlapMs(base[p], other[s]);
      if (ms > bestOverlap) {
        bestOverlap = ms;
        bestIndex = p;
      }
    }

    if (bestIndex === -1) continue;
    if (overlapRatio(base[bestIndex], other[s]) < minOverlap) continue;

    if (!attached.has(bestIndex)) attached.set(bestIndex, []);
    /** @type {string[][]} */ (attached.get(bestIndex)).push(other[s].lines);
    usedSecondary.add(s);
  }

  const merged = base.map((cue, i) => {
    const extras = attached.get(i);
    if (!extras || extras.length === 0) return cue;

    const secondaryLines = extras.flat().filter((line) => line.trim() !== '');
    if (secondaryLines.length === 0) return cue;

    const primaryLines = cue.lines.filter((line) => line.trim() !== '');
    const lines =
      top === 'primary'
        ? [...primaryLines, ...secondaryLines]
        : [...secondaryLines, ...primaryLines];

    return { ...cue, lines: separator === '\n' ? lines : [lines.join(separator)] };
  });

  /** @type {import('./cue.js').Cue[]} */
  const leftovers = [];
  if (keepUnmatched) {
    for (let s = 0; s < other.length; s += 1) {
      if (!usedSecondary.has(s)) leftovers.push(other[s]);
    }
  }

  return {
    cues: normalizeCues([...merged, ...leftovers]),
    matched: usedSecondary.size,
    unmatched: other.length - usedSecondary.size,
  };
}

/**
 * @typedef {Object} SplitOptions
 * @property {'script'|'line'} [strategy] how to decide which line is which language
 * @property {'cjk'|'latin'} [first]      which script the first track should collect
 */

/**
 * Split a bilingual track back into two.
 *
 * `script` (default) classifies each line by writing system, which handles
 * cues where the order is inconsistent. `line` simply takes line 1 vs the
 * rest, which is right for tracks that are reliably formatted.
 *
 * @param {import('./cue.js').Cue[]} cues
 * @param {SplitOptions} [options]
 * @returns {{ first: import('./cue.js').Cue[], second: import('./cue.js').Cue[] }}
 */
export function splitBilingual(cues, options = {}) {
  const { strategy = 'script', first = 'cjk' } = options;

  /** @type {import('./cue.js').Cue[]} */
  const trackA = [];
  /** @type {import('./cue.js').Cue[]} */
  const trackB = [];

  for (const cue of cloneCues(cues)) {
    const visible = cue.lines.filter((line) => line.trim() !== '');
    if (visible.length === 0) continue;

    /** @type {string[]} */
    let a = [];
    /** @type {string[]} */
    let b = [];

    if (strategy === 'line' || visible.length === 1) {
      a = visible.slice(0, 1);
      b = visible.slice(1);
    } else {
      for (const line of visible) {
        const profile = analyzeScript(line);
        const isCjk = profile.cjk >= profile.latin;
        const goesFirst = first === 'cjk' ? isCjk : !isCjk;
        (goesFirst ? a : b).push(line);
      }
      // All lines landed on one side — fall back to positional split.
      if (a.length === 0 || b.length === 0) {
        a = visible.slice(0, 1);
        b = visible.slice(1);
      }
    }

    if (a.length) trackA.push(createCue({ start: cue.start, end: cue.end, lines: a, style: cue.style }));
    if (b.length) trackB.push(createCue({ start: cue.start, end: cue.end, lines: b, style: cue.style }));
  }

  return { first: normalizeCues(trackA), second: normalizeCues(trackB) };
}

/**
 * Report how well two tracks line up, before committing to a merge.
 * @param {import('./cue.js').Cue[]} primary
 * @param {import('./cue.js').Cue[]} secondary
 * @param {{ minOverlap?: number }} [options]
 */
export function analyzeAlignment(primary, secondary, options = {}) {
  const { minOverlap = 0.2 } = options;
  const base = normalizeCues(primary);
  const other = normalizeCues(secondary);

  let matched = 0;
  let totalDrift = 0;

  for (const cue of other) {
    let best = null;
    let bestOverlap = 0;
    for (const candidate of base) {
      if (candidate.start > cue.end) break;
      const ms = overlapMs(candidate, cue);
      if (ms > bestOverlap) {
        bestOverlap = ms;
        best = candidate;
      }
    }
    if (best && overlapRatio(best, cue) >= minOverlap) {
      matched += 1;
      totalDrift += Math.abs(best.start - cue.start);
    }
  }

  return {
    primaryCues: base.length,
    secondaryCues: other.length,
    matched,
    matchRate: other.length ? matched / other.length : 0,
    averageDrift: matched ? Math.round(totalDrift / matched) : 0,
  };
}
