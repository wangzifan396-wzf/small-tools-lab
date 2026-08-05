/**
 * High-level diff: turn two strings into token operations plus statistics.
 *
 * @module core/diff
 */

import { tokenize, Token } from './tokenize.js';
import { diffArrays } from './lcs.js';

/**
 * @typedef {import('./lcs.js').Op} Op
 * @typedef {import('./tokenize.js').Token} Token
 * @typedef {Object} DiffStats
 *   @property {number} unchanged  equal tokens
 *   @property {number} added      inserted tokens
 *   @property {number} removed    deleted tokens
 *   @property {number} total      unchanged + added + removed
 *   @property {number} changeRatio (added + removed) / total
 *   @property {number} similarity  unchanged / total (0..1)
 */

/**
 * @typedef {Object} DiffResult
 *   @property {Op[]} ops
 *   @property {DiffStats} stats
 */

const tokenEq = (x, y) => x.value === y.value;

/**
 * Compare two strings.
 * @param {string} a
 * @param {string} b
 * @param {{ granularity?: 'word' | 'line' }} [options]
 * @returns {DiffResult}
 */
export function diff(a, b, options = {}) {
  const ga = tokenize(a);
  const gb = tokenize(b);

  // Fast path: identical token streams.
  if (ga.length === gb.length && ga.every((t, i) => tokenEq(t, gb[i]))) {
    const stats = computeStats([{ type: 'equal', tokens: ga }]);
    return { ops: ga.length ? [{ type: 'equal', tokens: ga }] : [], stats };
  }

  const ops = diffArrays(ga, gb, tokenEq);
  return { ops, stats: computeStats(ops) };
}

/**
 * @param {Op[]} ops
 * @returns {DiffStats}
 */
export function computeStats(ops) {
  let unchanged = 0;
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === 'equal') unchanged += op.tokens.length;
    else if (op.type === 'insert') added += op.tokens.length;
    else removed += op.tokens.length;
  }
  const total = unchanged + added + removed;
  const changed = added + removed;
  return {
    unchanged,
    added,
    removed,
    total,
    changeRatio: total === 0 ? 0 : changed / total,
    similarity: total === 0 ? 1 : unchanged / total,
  };
}

/**
 * Reconstruct the original lines for one side of a token diff.
 * @param {Op[]} ops
 * @param {'a'|'b'} side  'a' keeps equal+delete, 'b' keeps equal+insert
 * @returns {string[]}
 */
export function reconstructLines(ops, side) {
  /** @type {string[]} */
  const lines = [''];
  for (const op of ops) {
    const keep =
      op.type === 'equal' ||
      (side === 'a' && op.type === 'delete') ||
      (side === 'b' && op.type === 'insert');
    if (!keep) continue;
    const text = /** @type {Token[]} */ (op.tokens).map((t) => t.value).join('');
    const parts = text.split('\n');
    lines[lines.length - 1] += parts[0];
    for (let k = 1; k < parts.length; k += 1) lines.push(parts[k]);
  }
  return lines;
}
