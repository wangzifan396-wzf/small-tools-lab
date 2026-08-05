/**
 * subzen's own JSON interchange format.
 *
 * Useful as a pipeline stage: `subzen convert in.srt -t json | jq … |
 * subzen convert - -t srt`. Also what the browser playground speaks.
 *
 * @module formats/json
 */

import { createCue, normalizeLines } from '../core/cue.js';

export const id = 'json';
export const extensions = ['.json'];

/**
 * @param {string} input
 * @returns {import('./index.js').Track}
 */
export function parse(input) {
  /** @type {string[]} */
  const warnings = [];
  let data;
  try {
    data = JSON.parse(String(input ?? ''));
  } catch (error) {
    return {
      format: id,
      cues: [],
      meta: {},
      warnings: [`invalid JSON: ${/** @type {Error} */ (error).message}`],
    };
  }

  const rawCues = Array.isArray(data) ? data : (data.cues ?? []);
  if (!Array.isArray(rawCues)) {
    return { format: id, cues: [], meta: {}, warnings: ['expected an array of cues'] };
  }

  const cues = rawCues
    .map((raw, i) => {
      const start = Number(raw.start);
      const end = Number(raw.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        warnings.push(`cue ${i + 1}: missing numeric start/end`);
        return null;
      }
      return createCue({
        index: i + 1,
        start,
        end,
        lines: normalizeLines(raw.lines ?? raw.text ?? ''),
        ...(raw.id ? { id: String(raw.id) } : {}),
        ...(raw.style ? { style: String(raw.style) } : {}),
        ...(raw.settings ? { settings: String(raw.settings) } : {}),
      });
    })
    .filter(/** @returns {c is import('../core/cue.js').Cue} */ (c) => c !== null);

  return {
    format: id,
    cues,
    meta: Array.isArray(data) ? {} : (data.meta ?? {}),
    warnings,
  };
}

/**
 * @param {import('../core/cue.js').Cue[]} cues
 * @param {{ indent?: number, meta?: Record<string, unknown> }} [options]
 * @returns {string}
 */
export function serialize(cues, options = {}) {
  const { indent = 2, meta } = options;
  const payload = {
    format: 'subzen-json',
    version: 1,
    ...(meta && Object.keys(meta).length ? { meta } : {}),
    cues: cues.map((cue, i) => ({
      index: i + 1,
      start: cue.start,
      end: cue.end,
      lines: cue.lines,
      ...(cue.id ? { id: cue.id } : {}),
      ...(cue.style ? { style: cue.style } : {}),
      ...(cue.settings ? { settings: cue.settings } : {}),
    })),
  };
  return `${JSON.stringify(payload, null, indent)}\n`;
}

/** @param {string} text @returns {number} */
export function sniff(text) {
  const head = text.trimStart().slice(0, 200);
  if (!head.startsWith('{') && !head.startsWith('[')) return 0;
  return /"subzen-json"/.test(text.slice(0, 400)) ? 1 : 0.5;
}
