/**
 * Small pure utilities shared across Leafnote. No DOM, no side effects —
 * safe to import in Node tests.
 *
 * @module util
 */

/** Generate a unique id. Uses crypto.randomUUID when available. */
export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Escape a string for safe insertion into HTML text/attribute. */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Normalize a title for case-insensitive wiki-link matching.
 * Lowercases and collapses internal whitespace.
 */
export function normalizeTitle(title) {
  return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Debounce a function by `ms` milliseconds. */
export function debounce(fn, ms = 300) {
  let t;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** Current epoch milliseconds. */
export function now() {
  return Date.now();
}

/** Strip a leading markdown heading to derive a title from body, if needed. */
export function titleFromBody(body) {
  const first = String(body || '').split('\n').find((l) => l.trim() !== '');
  const m = first && first.match(/^#{1,6}\s+(.*)$/);
  const base = m ? m[1] : first || 'Untitled';
  return base.trim().slice(0, 80) || 'Untitled';
}
