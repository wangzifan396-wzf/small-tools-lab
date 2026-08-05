/**
 * Timing rules — the ones that make subtitles physically readable.
 *
 * @module rules/timing
 */

import { cueDuration, cueText, cloneCues } from '../core/cue.js';
import { readingTime, readingPressure, stripTags } from '../core/text.js';
import { formatHuman } from '../core/timecode.js';

/** @typedef {import('../core/lint.js').Rule} Rule */

/** @type {Rule} */
export const timeOrder = {
  id: 'time-order',
  description: 'A cue must end after it starts.',
  severity: 'error',
  options: {},
  check(cues) {
    return cues
      .filter((cue) => cue.end <= cue.start)
      .map((cue) => ({
        cue,
        message:
          cue.end === cue.start
            ? 'zero-length cue (start equals end)'
            : `cue ends ${formatHuman(cue.start - cue.end)} before it starts`,
      }));
  },
};

/** @type {Rule} */
export const negativeTime = {
  id: 'negative-time',
  description: 'Timecodes must not be negative.',
  severity: 'error',
  options: {},
  check(cues) {
    return cues
      .filter((cue) => cue.start < 0 || cue.end < 0)
      .map((cue) => ({ cue, message: 'negative timecode' }));
  },
  fix(cues) {
    let changed = 0;
    const next = cloneCues(cues).map((cue) => {
      if (cue.start < 0 || cue.end < 0) {
        changed += 1;
        const shift = -Math.min(cue.start, cue.end);
        return { ...cue, start: cue.start + shift, end: cue.end + shift };
      }
      return cue;
    });
    return { cues: next, changed };
  },
};

/** @type {Rule} */
export const noOverlap = {
  id: 'no-overlap',
  description: 'Consecutive cues must not overlap in time.',
  severity: 'error',
  options: { minGap: 0 },
  check(cues, options) {
    const minGap = options.minGap ?? 0;
    const out = [];
    for (let i = 1; i < cues.length; i += 1) {
      const prev = cues[i - 1];
      const cur = cues[i];
      if (cur.start < prev.end + minGap) {
        out.push({
          cue: cur,
          message: `overlaps the previous cue by ${formatHuman(prev.end - cur.start)}`,
        });
      }
    }
    return out;
  },
  fix(cues, options) {
    const minGap = options.minGap ?? 0;
    const next = cloneCues(cues);
    let changed = 0;
    for (let i = 1; i < next.length; i += 1) {
      const prev = next[i - 1];
      const cur = next[i];
      if (cur.start < prev.end + minGap) {
        const target = Math.max(prev.start + 1, cur.start - minGap);
        if (target !== prev.end) {
          prev.end = target;
          changed += 1;
        }
      }
    }
    return { cues: next, changed };
  },
};

/** @type {Rule} */
export const minGap = {
  id: 'min-gap',
  description: 'Leave a small gap between cues so the render does not flicker.',
  severity: 'warn',
  options: { min: 84 }, // ~2 frames at 24fps
  check(cues, options) {
    const min = options.min ?? 84;
    const out = [];
    for (let i = 1; i < cues.length; i += 1) {
      const gap = cues[i].start - cues[i - 1].end;
      if (gap > 0 && gap < min) {
        out.push({
          cue: cues[i],
          message: `only ${gap}ms after the previous cue (minimum ${min}ms)`,
        });
      }
    }
    return out;
  },
  fix(cues, options) {
    const min = options.min ?? 84;
    const next = cloneCues(cues);
    let changed = 0;
    for (let i = 1; i < next.length; i += 1) {
      const gap = next[i].start - next[i - 1].end;
      if (gap > 0 && gap < min) {
        const target = next[i].start - min;
        if (target > next[i - 1].start) {
          next[i - 1].end = target;
          changed += 1;
        }
      }
    }
    return { cues: next, changed };
  },
};

/** @type {Rule} */
export const minDuration = {
  id: 'min-duration',
  description: 'A cue that flashes by is worse than no cue at all.',
  severity: 'warn',
  options: { min: 833 }, // 20 frames at 24fps, the common broadcast floor
  check(cues, options) {
    const min = options.min ?? 833;
    return cues
      .filter((cue) => {
        const d = cueDuration(cue);
        return d > 0 && d < min;
      })
      .map((cue) => ({
        cue,
        message: `on screen for only ${formatHuman(cueDuration(cue))} (minimum ${formatHuman(min)})`,
      }));
  },
  fix(cues, options) {
    const min = options.min ?? 833;
    const gap = options.gap ?? 84;
    const next = cloneCues(cues);
    let changed = 0;
    for (let i = 0; i < next.length; i += 1) {
      const cue = next[i];
      const duration = cue.end - cue.start;
      if (duration <= 0 || duration >= min) continue;
      // Only borrow time that the following cue is not using.
      const ceiling = next[i + 1] ? next[i + 1].start - gap : cue.start + min;
      const target = Math.min(cue.start + min, Math.max(cue.end, ceiling));
      if (target > cue.end) {
        cue.end = target;
        changed += 1;
      }
    }
    return { cues: next, changed };
  },
};

/** @type {Rule} */
export const maxDuration = {
  id: 'max-duration',
  description: 'A cue lingering too long usually means two cues were merged.',
  severity: 'warn',
  options: { max: 7000 },
  check(cues, options) {
    const max = options.max ?? 7000;
    return cues
      .filter((cue) => cueDuration(cue) > max)
      .map((cue) => ({
        cue,
        message: `on screen for ${formatHuman(cueDuration(cue))} (maximum ${formatHuman(max)})`,
      }));
  },
};

/** @type {Rule} */
export const maxCps = {
  id: 'max-cps',
  description:
    'Reading speed. CJK and Latin get separate budgets, so mixed-script lines are judged fairly.',
  severity: 'warn',
  options: { cjkCps: 9, latinCps: 20, tolerance: 1.0 },
  check(cues, options) {
    const { cjkCps = 9, latinCps = 20, tolerance = 1.0 } = options;
    const out = [];
    for (const cue of cues) {
      const duration = cueDuration(cue);
      if (duration <= 0) continue;
      const text = stripTags(cueText(cue, ' '));
      if (!text.trim()) continue;

      const pressure = readingPressure(text, duration, { cjkCps, latinCps });
      if (pressure > tolerance) {
        const needed = readingTime(text, { cjkCps, latinCps });
        out.push({
          cue,
          message:
            `too fast to read: needs ~${formatHuman(needed)} but shows for ` +
            `${formatHuman(duration)} (${pressure.toFixed(2)}x)`,
          data: { pressure, needed },
        });
      }
    }
    return out;
  },
};

export default [timeOrder, negativeTime, noOverlap, minGap, minDuration, maxDuration, maxCps];
