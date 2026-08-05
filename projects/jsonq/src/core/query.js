/**
 * jsonq core — tiny, dependency-free JSON query & transform helpers.
 *
 * @module jsonq/core/query
 */

/** Get a value by dot/bracket-free path ("a.b.0.c"). */
export function get(obj, path) {
  const parts = String(path).split(/[./]/).filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Return a new object with only the listed keys. */
export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

/** Return a new object without the listed keys. */
export function omit(obj, keys) {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

function compare(a, op, b) {
  switch (op) {
    case 'eq': case '=': case '==':
      return a === b || String(a) === String(b); // eslint-disable-line eqeqeq
    case 'neq': case '!=': case '!==':
      return !(a === b || String(a) === String(b)); // eslint-disable-line eqeqeq
    case 'gt': case '>': return Number(a) > Number(b);
    case 'gte': case '>=': return Number(a) >= Number(b);
    case 'lt': case '<': return Number(a) < Number(b);
    case 'lte': case '<=': return Number(a) <= Number(b);
    case 'contains': case '~': return String(a).includes(String(b));
    case 'exists': return a != null; // eslint-disable-line eqeqeq
    default: throw new Error('unsupported operator: ' + op);
  }
}

/** Filter an array by a comparison on a dot-path key. */
export function filter(arr, key, op, value) {
  if (!Array.isArray(arr)) throw new TypeError('filter expects an array');
  return arr.filter((item) => compare(get(item, key), op, value));
}

/** Sort an array by a dot-path key (stable copy). */
export function sortBy(arr, key, dir = 'asc') {
  if (!Array.isArray(arr)) throw new TypeError('sort expects an array');
  const sign = dir === 'desc' ? -1 : 1;
  return [...arr].sort((x, y) => {
    const a = get(x, key);
    const b = get(y, key);
    if (a < b) return -sign;
    if (a > b) return sign;
    return 0;
  });
}

/** Map each item to an object with only the listed keys. */
export function select(arr, keys) {
  if (!Array.isArray(arr)) throw new TypeError('select expects an array');
  return arr.map((item) => pick(item, keys));
}
