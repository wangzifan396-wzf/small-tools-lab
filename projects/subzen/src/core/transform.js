/**
 * Timeline and content transforms. Every function is pure: cues go in,
 * new cues come out.
 *
 * @module core/transform
 */

import { cloneCues, normalizeCues, cueText, cueDuration } from './cue.js';
import { stripTags } from './text.js';
import { rewrapLines } from './wrap.js';

/**
 * Move every cue by a fixed offset.
 * @param {import('./cue.js').Cue[]} cues
 * @param {number} ms  positive delays, negative advances
 * @param {{ clamp?: boolean }} [options]
 * @returns {import('./cue.js').Cue[]}
 */
export function shift(cues, ms, options = {}) {
  const { clamp = true } = options;
  const delta = Math.round(ms);
  return cloneCues(cues).map((cue) => {
    const start = cue.start + delta;
    const end = cue.end + delta;
    return {
      ...cue,
      start: clamp ? Math.max(0, start) : start,
      end: clamp ? Math.max(0, end) : end,
    };
  });
}

/**
 * Stretch or compress the timeline around a pivot.
 * @param {import('./cue.js').Cue[]} cues
 * @param {number} factor
 * @param {{ pivot?: number, clamp?: boolean }} [options]
 * @returns {import('./cue.js').Cue[]}
 */
export function scale(cues, factor, options = {}) {
  const { pivot = 0, clamp = true } = options;
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`scale() needs a positive factor, received ${factor}`);
  }
  const map = (t) => Math.round(pivot + (t - pivot) * factor);
  return cloneCues(cues).map((cue) => ({
    ...cue,
    start: clamp ? Math.max(0, map(cue.start)) : map(cue.start),
    end: clamp ? Math.max(0, map(cue.end)) : map(cue.end),
  }));
}

/**
 * @typedef {Object} Anchor
 * @property {number} from  time as it appears in the file
 * @property {number} to    time it should be
 */

/**
 * Linear re-sync from anchor points.
 *
 * One anchor is a pure offset. Two or more solve for both drift and offset
 * by least squares — this is what fixes the classic "correct at the start,
 * ten seconds off at the end" problem caused by a frame-rate mismatch.
 *
 * @param {import('./cue.js').Cue[]} cues
 * @param {Anchor[]} anchors
 * @param {{ clamp?: boolean }} [options]
 * @returns {{ cues: import('./cue.js').Cue[], rate: number, offset: number }}
 */
export function resync(cues, anchors, options = {}) {
  const { clamp = true } = options;
  const points = anchors.filter((a) => Number.isFinite(a.from) && Number.isFinite(a.to));

  if (points.length === 0) throw new Error('resync() needs at least one anchor');

  let rate = 1;
  let offset = 0;

  if (points.length === 1) {
    offset = points[0].to - points[0].from;
  } else {
    const n = points.length;
    const sumX = points.reduce((s, p) => s + p.from, 0);
    const sumY = points.reduce((s, p) => s + p.to, 0);
    const sumXY = points.reduce((s, p) => s + p.from * p.to, 0);
    const sumXX = points.reduce((s, p) => s + p.from * p.from, 0);
    const denominator = n * sumXX - sumX * sumX;

    if (Math.abs(denominator) < 1e-9) {
      offset = sumY / n - sumX / n;
    } else {
      rate = (n * sumXY - sumX * sumY) / denominator;
      offset = (sumY - rate * sumX) / n;
    }
  }

  const map = (t) => Math.round(t * rate + offset);
  const next = cloneCues(cues).map((cue) => ({
    ...cue,
    start: clamp ? Math.max(0, map(cue.start)) : map(cue.start),
    end: clamp ? Math.max(0, map(cue.end)) : map(cue.end),
  }));

  return { cues: next, rate, offset };
}

/**
 * Retime a track authored at one frame rate for playback at another.
 * @param {import('./cue.js').Cue[]} cues
 * @param {{ from: number, to: number }} rates
 * @returns {import('./cue.js').Cue[]}
 */
export function convertFrameRate(cues, { from, to }) {
  if (!(from > 0) || !(to > 0)) throw new Error('convertFrameRate() needs positive frame rates');
  return scale(cues, from / to);
}

/**
 * Trim overlaps so no cue starts before the previous one ends.
 * @param {import('./cue.js').Cue[]} cues
 * @param {{ minGap?: number }} [options]
 * @returns {import('./cue.js').Cue[]}
 */
export function fixOverlaps(cues, options = {}) {
  const { minGap = 0 } = options;
  const next = normalizeCues(cues);
  for (let i = 1; i < next.length; i += 1) {
    const prev = next[i - 1];
    if (next[i].start < prev.end + minGap) {
      prev.end = Math.max(prev.start + 1, next[i].start - minGap);
    }
  }
  return next;
}

/**
 * Drop cues with no visible text.
 * @param {import('./cue.js').Cue[]} cues
 * @returns {import('./cue.js').Cue[]}
 */
export function removeEmpty(cues) {
  return cloneCues(cues).filter((cue) => stripTags(cueText(cue, '')).trim() !== '');
}

/**
 * Collapse consecutive cues with identical text.
 * @param {import('./cue.js').Cue[]} cues
 * @param {{ maxGap?: number }} [options]
 * @returns {import('./cue.js').Cue[]}
 */
export function dedupe(cues, options = {}) {
  const { maxGap = 500 } = options;
  /** @type {import('./cue.js').Cue[]} */
  const out = [];
  for (const cue of cloneCues(cues)) {
    const prev = out[out.length - 1];
    const same =
      prev && normalizeKey(prev) === normalizeKey(cue) && cue.start - prev.end <= maxGap;
    if (same) {
      prev.end = Math.max(prev.end, cue.end);
      continue;
    }
    out.push(cue);
  }
  return out;
}

/**
 * Keep or drop cues by text pattern.
 * @param {import('./cue.js').Cue[]} cues
 * @param {RegExp} pattern
 * @param {{ invert?: boolean }} [options]
 * @returns {import('./cue.js').Cue[]}
 */
export function filterByText(cues, pattern, options = {}) {
  const { invert = false } = options;
  return cloneCues(cues).filter((cue) => {
    const hit = pattern.test(cueText(cue, ' '));
    return invert ? !hit : hit;
  });
}

/**
 * Extract a time window, optionally rebasing it to zero.
 * @param {import('./cue.js').Cue[]} cues
 * @param {{ start?: number, end?: number, rebase?: boolean }} [options]
 * @returns {import('./cue.js').Cue[]}
 */
export function slice(cues, options = {}) {
  const { start = 0, end = Infinity, rebase = false } = options;
  const inWindow = cloneCues(cues).filter((cue) => cue.end > start && cue.start < end);
  return rebase ? shift(inWindow, -start) : inWindow;
}

/**
 * Join tracks end to end. Each track may carry its own offset.
 * @param {{ cues: import('./cue.js').Cue[], offset?: number }[]} parts
 * @returns {import('./cue.js').Cue[]}
 */
export function concat(parts) {
  /** @type {import('./cue.js').Cue[]} */
  const out = [];
  for (const part of parts) {
    out.push(...shift(part.cues, part.offset ?? 0));
  }
  return normalizeCues(out);
}

/**
 * Re-wrap every cue to a target width.
 * @param {import('./cue.js').Cue[]} cues
 * @param {{ width?: number, maxLines?: number, balance?: boolean }} [options]
 * @returns {import('./cue.js').Cue[]}
 */
export function rewrap(cues, options = {}) {
  return cloneCues(cues).map((cue) => {
    const visible = cue.lines.filter((l) => l.trim() !== '');
    if (visible.length === 0) return cue;
    const lines = rewrapLines(visible, options);
    return { ...cue, lines: lines.length ? lines : cue.lines };
  });
}

/**
 * Clamp every cue duration into a range, borrowing only from free time.
 * @param {import('./cue.js').Cue[]} cues
 * @param {{ min?: number, max?: number, gap?: number }} [options]
 * @returns {import('./cue.js').Cue[]}
 */
export function clampDurations(cues, options = {}) {
  const { min = 0, max = Infinity, gap = 84 } = options;
  const next = normalizeCues(cues);
  for (let i = 0; i < next.length; i += 1) {
    const cue = next[i];
    const duration = cueDuration(cue);
    if (duration > max) {
      cue.end = cue.start + max;
    } else if (duration < min) {
      const ceiling = next[i + 1] ? next[i + 1].start - gap : cue.start + min;
      cue.end = Math.min(cue.start + min, Math.max(cue.end, ceiling));
    }
  }
  return next;
}

/** @param {import('./cue.js').Cue} cue @returns {string} */
function normalizeKey(cue) {
  return stripTags(cueText(cue, ' ')).replace(/\s+/g, ' ').trim();
}
