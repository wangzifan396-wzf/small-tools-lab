/**
 * WebVTT (`.vtt`) — the browser-native caption format.
 *
 * Cue identifiers, cue settings (`align:start position:10%`), `NOTE` and
 * `STYLE` blocks are preserved so a `vtt → srt → vtt` round trip does not
 * silently destroy positioning.
 *
 * @module formats/vtt
 */

import { createCue, normalizeLines } from '../core/cue.js';
import { parseTimecode, formatVttTime } from '../core/timecode.js';

export const id = 'vtt';
export const extensions = ['.vtt', '.webvtt'];

const TIMING_RE = /^(.*?)\s*-->\s*(\S+)(?:\s+(.*))?$/;

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
  /** @type {string[]} */
  const headerBlocks = [];

  let i = 0;
  let header = '';

  if (/^WEBVTT/.test(lines[0] ?? '')) {
    header = lines[0];
    i = 1;
  } else {
    warnings.push('missing "WEBVTT" signature on the first line');
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // NOTE / STYLE / REGION blocks run until the next blank line.
    if (/^(NOTE|STYLE|REGION)\b/.test(line)) {
      const block = [];
      while (i < lines.length && lines[i].trim() !== '') {
        block.push(lines[i]);
        i += 1;
      }
      headerBlocks.push(block.join('\n'));
      continue;
    }

    let cueId;
    if (!line.includes('-->')) {
      if (i + 1 < lines.length && lines[i + 1].includes('-->')) {
        cueId = line.trim();
        i += 1;
      } else {
        warnings.push(`line ${i + 1}: skipped unrecognised block`);
        while (i < lines.length && lines[i].trim() !== '') i += 1;
        continue;
      }
    }

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
      warnings.push(`line ${timingLineNo}: unreadable timecode`);
      continue;
    }

    /** @type {string[]} */
    const body = [];
    while (i < lines.length && lines[i].trim() !== '') {
      body.push(lines[i]);
      i += 1;
    }

    const cue = createCue({
      index: cues.length + 1,
      start,
      end,
      lines: normalizeLines(body),
    });
    if (cueId) cue.id = cueId;
    if (match[3]) cue.settings = match[3].trim();
    cues.push(cue);
  }

  return {
    format: id,
    cues,
    meta: { vttHeader: header || 'WEBVTT', vttBlocks: headerBlocks },
    warnings,
  };
}

/**
 * @param {import('../core/cue.js').Cue[]} cues
 * @param {{ eol?: string, header?: string, blocks?: string[], keepIds?: boolean, keepSettings?: boolean }} [options]
 * @returns {string}
 */
export function serialize(cues, options = {}) {
  const {
    eol = '\n',
    header = 'WEBVTT',
    blocks = [],
    keepIds = true,
    keepSettings = true,
  } = options;

  const parts = [header];
  for (const block of blocks) parts.push(block);

  for (const cue of cues) {
    const chunk = [];
    if (keepIds && cue.id) chunk.push(cue.id);
    chunk.push(
      `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}` +
        (keepSettings && cue.settings ? ` ${cue.settings}` : ''),
    );
    chunk.push(...(cue.lines.length ? cue.lines : ['']));
    parts.push(chunk.join(eol));
  }

  return parts.join(eol + eol) + eol;
}

/** @param {string} text @returns {number} */
export function sniff(text) {
  return /^\s*WEBVTT/.test(text.slice(0, 200)) ? 1 : 0;
}
