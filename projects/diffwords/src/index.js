/**
 * diffwords — word-level, CJK-aware text differ.
 *
 * @module diffwords
 */

export { tokenize, untokenize, isCjk, Token } from './core/tokenize.js';
export { diffArrays } from './core/lcs.js';
export { diff, computeStats, reconstructLines } from './core/diff.js';
export {
  formatInline,
  formatUnified,
  formatHtml,
  formatJson,
  stripAnsi,
} from './core/format.js';
