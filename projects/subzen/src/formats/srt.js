/**
 * SubRip (`.srt`) — the lingua franca of subtitles, and the format with the
 * widest variety of broken files in the wild. This parser is deliberately
 * forgiving: missing indices, absent blank lines, stray positioning data and
 * BOMs all survive a round trip.
 *
 * @module formats/srt
 */

import { createCue, normalizeLines } from '../core/cue.js';
import { parseTimecode, formatSrtTime } from '../core/timecode.js';

export const id = 'srt';
export const extensions = ['.srt'];

const TIMING_RE = /^(.*?)\s*-->\s*(\S+)(?:\s+(.*))?$/;

/** @param {string} line @returns {boolean} */
const isTiming = (line) => line.includes('-->');

/**
 * @param {string} input
 * @returns {import('./index.js').Track}
 */
export function parse(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  /** @type {import('../core/cue.js').Cue[]} */
  const cues = [];
  /** @type {string[]} */
  const warnings = [];

  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === '') {
      i += 1;
      continue;
    }

    // An optional numeric index (or arbitrary identifier) may precede timing.
    let declaredIndex = null;
    if (!isTiming(lines[i])) {
      const candidate = lines[i].trim();
      if (i + 1 < lines.length && isTiming(lines[i + 1])) {
        if (/^\d+$/.test(candidate)) declaredIndex = Number(candidate);
        i += 1;
      } else {
        warnings.push(`line ${i + 1}: expected a timing line, found "${truncate(candidate)}"`);
        i += 1;
        continue;
      }
    }

    if (i >= lines.length || !isTiming(lines[i])) continue;

    const match = TIMING_RE.exec(lines[i]);
    const timingLineNo = i + 1;
    i += 1;

    if (!match) {
      warnings.push(`line ${timingLineNo}: malformed timing line`);
      continue;
    }

    const start = parseTimecode(match[1]);
    const end = parseTimecode(match[2]);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      warnings.push(`line ${timingLineNo}: unreadable timecode "${truncate(lines[timingLineNo - 1])}"`);
      continue;
    }

    /** @type {string[]} */
    const body = [];
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') break;
      // Some files omit the blank separator entirely.
      if (/^\d+$/.test(line.trim()) && i + 1 < lines.length && isTiming(lines[i + 1])) break;
      if (isTiming(line)) break;
      body.push(line);
      i += 1;
    }

    const cue = createCue({
      index: declaredIndex ?? cues.length + 1,
      start,
      end,
      lines: normalizeLines(body),
    });
    if (match[3]) cue.settings = match[3].trim();
    cues.push(cue);
  }

  return { format: id, cues, meta: {}, warnings };
}

/**
 * @param {import('../core/cue.js').Cue[]} cues
 * @param {{ eol?: string, keepSettings?: boolean, bom?: boolean }} [options]
 * @returns {string}
 */
export function serialize(cues, options = {}) {
  const { eol = '\n', keepSettings = true, bom = false } = options;

  const blocks = cues.map((cue, i) => {
    const timing =
      `${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}` +
      (keepSettings && cue.settings ? ` ${cue.settings}` : '');
    return [String(i + 1), timing, ...(cue.lines.length ? cue.lines : [''])].join(eol);
  });

  return (bom ? '\uFEFF' : '') + blocks.join(eol + eol) + (blocks.length ? eol : '');
}

/** @param {string} text @returns {number} 0..1 confidence that this is SRT */
export function sniff(text) {
  const head = text.slice(0, 4000);
  if (/^\s*WEBVTT/.test(head)) return 0;
  if (/^\s*\[Script Info\]/i.test(head)) return 0;
  if (/^\s*\d+\s*\r?\n\d{1,2}:\d{2}:\d{2},\d{3}\s*-->/m.test(head)) return 0.95;
  if (/\d{1,2}:\d{2}:\d{2},\d{3}\s*-->/.test(head)) return 0.8;
  return 0;
}

/** @param {string} value @returns {string} */
function truncate(value) {
  return value.length > 40 ? `${value.slice(0, 40)}…` : value;
}
