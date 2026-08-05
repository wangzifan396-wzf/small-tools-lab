/**
 * LRC lyrics (`.lrc`).
 *
 * LRC only stores a start time, so an end time has to be inferred from the
 * next line. Multiple time tags on one line (a repeated chorus) expand into
 * separate cues.
 *
 * @module formats/lrc
 */

import { createCue } from '../core/cue.js';
import { formatLrcTime, parseTimecode } from '../core/timecode.js';

export const id = 'lrc';
export const extensions = ['.lrc'];

const TAG_RE = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const META_RE = /^\[([a-zA-Z#]+):(.*)\]$/;

/**
 * @param {string} input
 * @param {{ defaultDuration?: number, maxDuration?: number }} [options]
 * @returns {import('./index.js').Track}
 */
export function parse(input, options = {}) {
  const { defaultDuration = 4000, maxDuration = 10000 } = options;
  const text = String(input ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  /** @type {{ start: number, text: string }[]} */
  const entries = [];
  /** @type {Record<string,string>} */
  const meta = {};
  /** @type {string[]} */
  const warnings = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const metaMatch = META_RE.exec(line);
    if (metaMatch && !/^\d+$/.test(metaMatch[1])) {
      meta[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      continue;
    }

    TAG_RE.lastIndex = 0;
    /** @type {number[]} */
    const stamps = [];
    let match;
    let lastEnd = 0;
    while ((match = TAG_RE.exec(line)) !== null) {
      if (match.index !== lastEnd) break; // tags must be at the head of the line
      const ms = parseTimecode(`${match[1]}:${match[2].replace(':', '.')}`);
      if (!Number.isNaN(ms)) stamps.push(ms);
      lastEnd = match.index + match[0].length;
    }

    if (stamps.length === 0) {
      warnings.push(`skipped line without a time tag: "${line.slice(0, 30)}"`);
      continue;
    }

    const body = line.slice(lastEnd).trim();
    for (const start of stamps) entries.push({ start, text: body });
  }

  entries.sort((a, b) => a.start - b.start);

  const offset = Number(meta.offset ?? 0) || 0;
  const cues = entries.map((entry, i) => {
    const next = entries[i + 1];
    const naturalEnd = next ? next.start : entry.start + defaultDuration;
    const end = Math.min(naturalEnd, entry.start + maxDuration);
    return createCue({
      index: i + 1,
      start: entry.start - offset,
      end: Math.max(end - offset, entry.start - offset + 200),
      lines: entry.text ? [entry.text] : [''],
    });
  });

  return { format: id, cues, meta: { lrcTags: meta }, warnings };
}

/**
 * @param {import('../core/cue.js').Cue[]} cues
 * @param {{ eol?: string, tags?: Record<string,string>, blankLineBetween?: boolean }} [options]
 * @returns {string}
 */
export function serialize(cues, options = {}) {
  const { eol = '\n', tags = {} } = options;

  const head = Object.entries(tags)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `[${key}:${value}]`);

  const body = cues.map((cue) => `${formatLrcTime(cue.start)}${cue.lines.join(' ')}`);

  return [...head, ...body].join(eol) + eol;
}

/** @param {string} text @returns {number} */
export function sniff(text) {
  const head = text.slice(0, 2000);
  if (/^\s*\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/m.test(head)) return 0.9;
  return 0;
}
