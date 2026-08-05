/**
 * subzen — zero-dependency subtitle toolkit and quality linter with
 * first-class CJK support.
 *
 * The whole library is pure ES modules with no Node built-ins, so the same
 * code runs in the browser:
 *
 * ```js
 * import { parse, lint, fix, serialize } from 'subzen';
 *
 * const track = parse(srtText);
 * const report = lint(track.cues, { preset: 'cjk' });
 * const clean = fix(track.cues, { preset: 'cjk' });
 * console.log(serialize(clean.cues, { format: 'srt' }));
 * ```
 *
 * @module subzen
 */

export const VERSION = '0.1.0';

// Cue model
export {
  createCue,
  cloneCue,
  cloneCues,
  cueText,
  cueDuration,
  normalizeCues,
  normalizeLines,
  reindex,
  overlapMs,
  overlapRatio,
  trackSpan,
} from './core/cue.js';

// Timecodes
export {
  parseTimecode,
  parseDuration,
  formatTimecode,
  formatSrtTime,
  formatVttTime,
  formatAssTime,
  formatLrcTime,
  formatHuman,
  resolveFrameRate,
  FRAME_RATES,
} from './core/timecode.js';

// Text and typography
export {
  displayWidth,
  stripTags,
  hasMarkup,
  analyzeScript,
  readingTime,
  readingPressure,
  charsPerSecond,
  addCjkLatinSpacing,
  normalizeCjkPunctuation,
  normalizeFullwidthLatin,
  normalizeEllipsis,
  hasFullwidthLatin,
  isCjkChar,
  NO_LINE_START,
  NO_LINE_END,
} from './core/text.js';

// Line breaking
export { wrapText, rewrapLines, joinLines, greedyWrap, tokenize } from './core/wrap.js';

// Formats
export {
  parse,
  serialize,
  detectFormat,
  formatFromFilename,
  formats,
  readableFormats,
  writableFormats,
} from './formats/index.js';

// Linting
export {
  lint,
  fix,
  fixAndLint,
  resolveConfig,
  severityRank,
  allRules,
  ruleMap,
  presets,
} from './core/lint.js';

// Transforms
export {
  shift,
  scale,
  resync,
  convertFrameRate,
  fixOverlaps,
  removeEmpty,
  dedupe,
  filterByText,
  slice,
  concat,
  rewrap,
  clampDurations,
} from './core/transform.js';

// Bilingual
export { mergeBilingual, splitBilingual, analyzeAlignment } from './core/bilingual.js';

// Stats and reporting
export { computeStats, summarize, histogram } from './core/stats.js';
export {
  formatText,
  formatCompact,
  formatJson,
  formatGitHub,
  formatStats,
} from './core/report.js';
export { createColors, supportsColor, stripAnsi } from './core/colors.js';
