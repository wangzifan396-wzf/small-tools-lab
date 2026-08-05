/**
 * Longest-common-subsequence diff over two arrays.
 *
 * Produces a list of operations (`equal` / `insert` / `delete`) that transform
 * `a` into `b`. Adjacent operations of the same kind are merged into a single
 * op so the output stays compact. The algorithm is the classic O(n·m) dynamic
 * programming table — plenty fast for the document sizes diffwords targets
 * (tens of thousands of tokens).
 *
 * @module core/lcs
 */

/**
 * @typedef {('equal'|'insert'|'delete')} OpType
 * @typedef {{ type: OpType, tokens: any[] }} Op
 */

/**
 * @template T
 * @param {T[]} a
 * @param {T[]} b
 * @param {(x: T, y: T) => boolean} [eq]
 * @returns {Op[]}
 */
export function diffArrays(a, b, eq = (x, y) => x === y) {
  const n = a.length;
  const m = b.length;

  // dp[i][j] = LCS length of a[i..] and b[j..]
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    const row = dp[i];
    const next = dp[i + 1];
    for (let j = m - 1; j >= 0; j -= 1) {
      row[j] = eq(a[i], b[j]) ? next[j + 1] + 1 : Math.max(next[j], row[j + 1]);
    }
  }

  /** @type {Op[]} */
  const ops = [];
  let i = 0;
  let j = 0;

  const push = (type, token) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.tokens.push(token);
    else ops.push({ type, tokens: [token] });
  };

  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      push('equal', a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('delete', a[i]);
      i += 1;
    } else {
      push('insert', b[j]);
      j += 1;
    }
  }
  while (i < n) {
    push('delete', a[i]);
    i += 1;
  }
  while (j < m) {
    push('insert', b[j]);
    j += 1;
  }

  return ops;
}
