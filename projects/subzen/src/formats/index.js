/**
 * Format registry — detection, parsing and serialisation.
 *
 * @module formats
 */

import * as srt from './srt.js';
import * as vtt from './vtt.js';
import * as ass from './ass.js';
import * as lrc from './lrc.js';
import * as json from './json.js';
import { displayWidth } from '../core/text.js';

/**
 * @typedef {Object} Track
 * @property {string} format
 * @property {import('../core/cue.js').Cue[]} cues
 * @property {Record<string, any>} meta
 * @property {string[]} warnings
 */

export const formats = { srt, vtt, ass, lrc, json };

/** Formats that can be written but not read. */
export const writeOnlyFormats = ['txt', 'md'];

/** @type {string[]} */
export const readableFormats = Object.keys(formats);

/** @type {string[]} */
export const writableFormats = [...readableFormats, ...writeOnlyFormats];

/**
 * Guess a format id from a file name.
 * @param {string} filename
 * @returns {string|null}
 */
export function formatFromFilename(filename) {
  const lower = String(filename ?? '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = lower.slice(dot);
  if (ext === '.txt') return 'txt';
  if (ext === '.md') return 'md';
  for (const [key, mod] of Object.entries(formats)) {
    if (mod.extensions.includes(ext)) return key;
  }
  return null;
}

/**
 * Detect a format from content, using the filename only as a tie-breaker.
 * @param {string} text
 * @param {string} [filename]
 * @returns {string}
 */
export function detectFormat(text, filename) {
  const source = String(text ?? '');
  /** @type {{ id: string, score: number }[]} */
  const scores = Object.entries(formats).map(([key, mod]) => ({
    id: key,
    score: mod.sniff(source),
  }));

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  const hinted = filename ? formatFromFilename(filename) : null;
  if (hinted && formats[/** @type {keyof typeof formats} */ (hinted)]) {
    const hintedScore = scores.find((s) => s.id === hinted)?.score ?? 0;
    // Trust the extension unless the content clearly says otherwise.
    if (hintedScore > 0 || best.score < 0.6) return hinted;
  }

  return best && best.score > 0 ? best.id : 'srt';
}

/**
 * @param {string} text
 * @param {{ format?: string, filename?: string }} [options]
 * @returns {Track}
 */
export function parse(text, options = {}) {
  const format = options.format ?? detectFormat(text, options.filename);
  const mod = formats[/** @type {keyof typeof formats} */ (format)];
  if (!mod) throw new Error(`Cannot read format "${format}". Known: ${readableFormats.join(', ')}`);
  return mod.parse(text);
}

/**
 * @param {Track|import('../core/cue.js').Cue[]} input
 * @param {{ format?: string, eol?: string, [key: string]: any }} [options]
 * @returns {string}
 */
export function serialize(input, options = {}) {
  const isTrack = !Array.isArray(input);
  const cues = isTrack ? input.cues : input;
  const meta = isTrack ? (input.meta ?? {}) : {};
  const format = options.format ?? (isTrack ? input.format : 'srt');
  const { format: _ignored, ...rest } = options;

  switch (format) {
    case 'srt':
      return srt.serialize(cues, rest);
    case 'vtt':
      return vtt.serialize(cues, {
        header: meta.vttHeader,
        blocks: meta.vttBlocks,
        ...rest,
      });
    case 'ass':
      return ass.serialize(cues, { header: meta.assHeader, ...rest });
    case 'lrc':
      return lrc.serialize(cues, { tags: meta.lrcTags, ...rest });
    case 'json':
      return json.serialize(cues, { meta, ...rest });
    case 'txt':
      return serializeText(cues, rest);
    case 'md':
      return serializeMarkdown(cues, rest);
    default:
      throw new Error(`Cannot write format "${format}". Known: ${writableFormats.join(', ')}`);
  }
}

/**
 * Plain transcript — timings dropped, paragraphs preserved.
 * @param {import('../core/cue.js').Cue[]} cues
 * @param {{ eol?: string, joinLines?: string }} [options]
 * @returns {string}
 */
export function serializeText(cues, options = {}) {
  const { eol = '\n', joinLines = ' ' } = options;
  return cues.map((cue) => cue.lines.join(joinLines)).join(eol) + eol;
}

/**
 * Markdown table — handy for review in a PR.
 * @param {import('../core/cue.js').Cue[]} cues
 * @param {{ eol?: string }} [options]
 * @returns {string}
 */
export function serializeMarkdown(cues, options = {}) {
  const { eol = '\n' } = options;
  const rows = cues.map((cue, i) => {
    const text = cue.lines.join(' / ').replace(/\|/g, '\\|');
    return `| ${i + 1} | ${msToClock(cue.start)} → ${msToClock(cue.end)} | ${displayWidth(text)} | ${text} |`;
  });
  return ['| # | Time | Width | Text |', '| --: | --- | --: | --- |', ...rows].join(eol) + eol;
}

/** @param {number} ms @returns {string} */
function msToClock(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
