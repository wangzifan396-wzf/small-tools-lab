/**
 * Theme handling (light/dark) for Sketchly, persisted to localStorage.
 * @module theme
 */

const THEME_KEY = 'sketchly:theme';

export function getInitialTheme() {
  const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY)) || '';
  if (saved === 'light' || saved === 'dark') return saved;
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function applyTheme(theme) {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', theme);
  if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, theme);
}

export function toggleTheme() {
  const current =
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
