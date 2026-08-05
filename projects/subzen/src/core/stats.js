/**
 * Track statistics — the numbers you want before deciding whether a subtitle
 * file is any good.
 *
 * @module core/stats
 */

import { cueDuration, cueText, trackSpan } from './cue.js';
import { analyzeScript, displayWidth, stripTags, readingPressure, charsPerSecond } from './text.js';

/**
 * @param {number[]} values
 * @returns {{ min: number, max: number, mean: number, median: number, p95: number }}
 */
export function summarize(values) {
  if (values.length === 0) return { min: 0, max: 0, mean: 0, median: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    median: at(0.5),
    p95: at(0.95),
  };
}

/**
 * @param {import('./cue.js').Cue[]} cues
 * @param {{ cjkCps?: number, latinCps?: number }} [options]
 */
export function computeStats(cues, options = {}) {
  const { cjkCps = 9, latinCps = 20 } = options;
  const span = trackSpan(cues);

  const durations = [];
  const widths = [];
  const pressures = [];
  const cpsValues = [];
  const gaps = [];
  /** @type {Record<string, number>} */
  const lineCounts = {};

  let cjk = 0;
  let latin = 0;
  let punct = 0;
  let onScreen = 0;
  let lineTotal = 0;

  cues.forEach((cue, i) => {
    const duration = cueDuration(cue);
    durations.push(duration);
    onScreen += Math.max(0, duration);

    const text = stripTags(cueText(cue, ' '));
    const profile = analyzeScript(text);
    cjk += profile.cjk;
    latin += profile.latin;
    punct += profile.punct;

    const visible = cue.lines.filter((l) => l.trim() !== '');
    lineTotal += visible.length;
    const bucket = visible.length >= 3 ? '3+' : String(visible.length);
    lineCounts[bucket] = (lineCounts[bucket] ?? 0) + 1;

    for (const line of visible) widths.push(displayWidth(stripTags(line)));

    if (duration > 0 && text.trim()) {
      pressures.push(readingPressure(text, duration, { cjkCps, latinCps }));
      cpsValues.push(charsPerSecond(text, duration));
    }

    if (i > 0) gaps.push(cue.start - cues[i - 1].end);
  });

  const letters = cjk + latin;

  return {
    cueCount: cues.length,
    lineCount: lineTotal,
    span,
    onScreen,
    coverage: span.duration > 0 ? onScreen / span.duration : 0,
    chars: { cjk, latin, punct, total: cjk + latin + punct },
    cjkRatio: letters > 0 ? cjk / letters : 0,
    dominant: letters === 0 ? 'unknown' : cjk / letters >= 0.7 ? 'cjk' : latin / letters >= 0.7 ? 'latin' : 'mixed',
    duration: summarize(durations),
    width: summarize(widths),
    pressure: summarize(pressures),
    cps: summarize(cpsValues),
    gap: summarize(gaps),
    lineCounts,
    tooFast: pressures.filter((p) => p > 1).length,
  };
}

/**
 * ASCII histogram, for terminal output.
 *
 * @param {number[]} values
 * @param {{ buckets?: number, width?: number, min?: number, max?: number, format?: (n: number) => string }} [options]
 * @returns {string[]}
 */
export function histogram(values, options = {}) {
  const { buckets = 8, width = 24, format = (n) => n.toFixed(1) } = options;
  if (values.length === 0) return [];

  const min = options.min ?? Math.min(...values);
  const max = options.max ?? Math.max(...values);
  const range = max - min || 1;
  const counts = new Array(buckets).fill(0);

  for (const value of values) {
    const slot = Math.min(buckets - 1, Math.floor(((value - min) / range) * buckets));
    counts[slot] += 1;
  }

  const peak = Math.max(...counts, 1);
  const labelWidth = Math.max(
    ...counts.map((_, i) => `${format(min + (range / buckets) * i)}`.length),
  );

  return counts.map((count, i) => {
    const lower = min + (range / buckets) * i;
    const bar = '█'.repeat(Math.round((count / peak) * width));
    return `${format(lower).padStart(labelWidth)} │${bar.padEnd(width)} ${count}`;
  });
}
