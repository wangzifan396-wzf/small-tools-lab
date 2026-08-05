/**
 * Full-text search over notes (pure, no DOM).
 *
 * @module search
 */

import { normalizeTitle } from './util.js';

/**
 * Rank notes against a query string.
 * @param {Array<{id:string,title:string,body:string}>} notes
 * @param {string} query
 * @returns {Array<object>} notes that match, sorted by descending score
 */
export function rankNotes(notes, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [...notes];
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const note of notes) {
    const title = (note.title || '').toLowerCase();
    const body = (note.body || '').toLowerCase();
    let score = 0;
    let allMatch = true;
    for (const term of terms) {
      const inTitle = title.includes(term);
      const inBody = body.includes(term);
      if (!inTitle && !inBody) { allMatch = false; break; }
      if (inTitle) score += 10 + (title.startsWith(term) ? 5 : 0);
      if (inBody) score += 1;
    }
    if (allMatch) {
      scored.push({ note, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || (a.note.title || '').localeCompare(b.note.title || ''));
  return scored.map((s) => s.note);
}

/**
 * Find notes that contain a [[wiki-link]] to `title`.
 * @param {Array<{id:string,title:string,body:string}>} notes
 * @param {string} title
 * @returns {Array<object>}
 */
export function backlinks(notes, title) {
  const target = normalizeTitle(title);
  if (!target) return [];
  return notes.filter((n) => {
    const body = n.body || '';
    const re = /\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g;
    let m;
    while ((m = re.exec(body))) {
      if (normalizeTitle(m[1]) === target) return true;
    }
    return false;
  });
}
