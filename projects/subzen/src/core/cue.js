/**
 * The `Cue` — subzen's single in-memory representation of a subtitle event.
 *
 * Every parser produces `Cue[]`, every transform consumes and returns
 * `Cue[]`, and every serializer turns `Cue[]` back into text. Keeping one
 * shape means SRT → ASS → VTT round trips are free.
 *
 * @module core/cue
 */

/**
 * @typedef {Object} Cue
 * @property {number} index      1-based position in the track
 * @property {number} start      start time in milliseconds
 * @property {number} end        end time in milliseconds
 * @property {string[]} lines    display lines, already split
 * @property {string} [id]       optional cue identifier (WebVTT)
 * @property {string} [style]    optional style name (ASS)
 * @property {string} [settings] optional renderer settings (WebVTT cue settings)
 * @property {Record<string, unknown>} [meta] format specific extras
 */

/**
 * @param {Partial<Cue> & { start: number, end: number }} init
 * @returns {Cue}
 */
export function createCue(init) {
  const lines = normalizeLines(init.lines ?? []);
  /** @type {Cue} */
  const cue = {
    index: init.index ?? 0,
    start: Math.round(init.start),
    end: Math.round(init.end),
    lines,
  };
  if (init.id !== undefined) cue.id = init.id;
  if (init.style !== undefined) cue.style = init.style;
  if (init.settings !== undefined) cue.settings = init.settings;
  if (init.meta !== undefined) cue.meta = init.meta;
  return cue;
}

/**
 * Split anything line-ish into a clean array of lines.
 * Handles CRLF, lone CR, and the ASS `\N` / `\n` escapes.
 * @param {string|string[]} input
 * @returns {string[]}
 */
export function normalizeLines(input) {
  const raw = Array.isArray(input) ? input.join('\n') : String(input ?? '');
  // Trailing whitespace is deliberately preserved — `trailing-whitespace`
  // exists to report it, and it cannot report what the parser already ate.
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\\[Nn]/g, '\n')
    .split('\n');
}

/**
 * @param {Cue} cue
 * @param {string} [separator]
 * @returns {string}
 */
export function cueText(cue, separator = '\n') {
  return cue.lines.join(separator);
}

/** @param {Cue} cue @returns {number} duration in milliseconds */
export function cueDuration(cue) {
  return cue.end - cue.start;
}

/** @param {Cue} a @param {Cue} b @returns {number} overlapping milliseconds (>= 0) */
export function overlapMs(a, b) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/**
 * Overlap expressed as a fraction of the shorter cue. 1 means "same window".
 * @param {Cue} a @param {Cue} b @returns {number} 0..1
 */
export function overlapRatio(a, b) {
  const shortest = Math.min(cueDuration(a), cueDuration(b));
  if (shortest <= 0) return overlapMs(a, b) > 0 ? 1 : 0;
  return overlapMs(a, b) / shortest;
}

/** @param {Cue} cue @returns {Cue} */
export function cloneCue(cue) {
  return {
    ...cue,
    lines: [...cue.lines],
    ...(cue.meta ? { meta: { ...cue.meta } } : {}),
  };
}

/** @param {Cue[]} cues @returns {Cue[]} */
export function cloneCues(cues) {
  return cues.map(cloneCue);
}

/**
 * Sort by start time (then end time) and rewrite `index` to 1..n.
 * Sorting is stable so equal timings keep their authored order.
 *
 * @param {Cue[]} cues
 * @returns {Cue[]} a new array
 */
export function normalizeCues(cues) {
  return [...cues]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((cue, i) => ({ ...cue, index: i + 1, lines: [...cue.lines] }));
}

/** @param {Cue[]} cues @returns {Cue[]} */
export function reindex(cues) {
  return cues.map((cue, i) => ({ ...cue, index: i + 1 }));
}

/**
 * Total wall-clock span of a track (first start → last end).
 * @param {Cue[]} cues
 * @returns {{ start: number, end: number, duration: number }}
 */
export function trackSpan(cues) {
  if (cues.length === 0) return { start: 0, end: 0, duration: 0 };
  let start = Infinity;
  let end = -Infinity;
  for (const cue of cues) {
    if (cue.start < start) start = cue.start;
    if (cue.end > end) end = cue.end;
  }
  return { start, end, duration: end - start };
}
