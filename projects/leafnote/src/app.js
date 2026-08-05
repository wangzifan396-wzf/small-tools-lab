/**
 * Leafnote browser controller. Wires the pure core modules (Store,
 * markdown, search, theme) to the DOM declared in index.html.
 *
 * Loaded as an ES module in dev (index.html). The single-file build
 * (npm run build) inlines this with the other src/*.js modules and
 * strips the import/export lines, so it must contain no top-level await
 * and no syntax that only a bundler could resolve.
 *
 * @module app
 */

import { Store } from './store.js';
import { renderMarkdown, extractTags } from './markdown.js';
import { rankNotes, backlinks } from './search.js';
import { titleFromBody, normalizeTitle, debounce, escapeHtml } from './util.js';
import { getInitialTheme, applyTheme, toggleTheme } from './theme.js';

const store = new Store();
let currentId = null;
let activeTag = null;
let query = '';

// ---- DOM refs ---------------------------------------------------------
const $ = (id) => document.getElementById(id);
const noteListEl = $('note-list');
const tagsEl = $('tags');
const searchEl = $('search');
const titleEl = $('title');
const bodyEl = $('body');
const previewEl = $('preview');
const backlinksEl = $('backlinks');
const noteTagsEl = $('note-tags');
const metaInfoEl = $('meta-info');
const newBtn = $('new-note');
const deleteBtn = $('delete-note');
const themeBtn = $('theme-toggle');
const exportMdBtn = $('export-md');
const exportJsonBtn = $('export-json');
const importInput = $('import');

// ---- helpers ----------------------------------------------------------
function fmt(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(ts);
  }
}

function slug(s) {
  return String(s || 'note')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'note';
}

function snippetOf(body) {
  const text = String(body || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*`_~]/g, '')
    .replace(/\[\[|\]\]/g, '')
    .replace(/^>\s?/gm, '')
    .trim();
  const first = text.split(/\n/).find((l) => l.trim()) || '';
  return first.slice(0, 90);
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

// ---- filtering --------------------------------------------------------
function visibleNotes() {
  let notes = store.all();
  if (activeTag) notes = notes.filter((n) => extractTags(n.body).includes(activeTag));
  notes = rankNotes(notes, query);
  notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return notes;
}

// ---- rendering --------------------------------------------------------
function renderList() {
  const notes = visibleNotes();
  if (!notes.length) {
    noteListEl.innerHTML = '<li class="empty">No notes</li>';
    return;
  }
  noteListEl.innerHTML = notes
    .map((n) => {
      const title = n.title && n.title.trim() ? n.title : titleFromBody(n.body);
      return (
        `<li class="${n.id === currentId ? 'active' : ''}" data-id="${n.id}">` +
        `<div class="nl-title">${escapeHtml(title || 'Untitled')}</div>` +
        `<div class="nl-snippet">${escapeHtml(snippetOf(n.body))}</div>` +
        `<div class="nl-date">${escapeHtml(fmt(n.updatedAt))}</div>` +
        `</li>`
      );
    })
    .join('');
}

function renderTags() {
  const counts = new Map();
  for (const n of store.all()) {
    for (const t of extractTags(n.body)) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const tags = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  if (!tags.length) {
    tagsEl.innerHTML = '<span class="empty">no tags</span>';
    return;
  }
  tagsEl.innerHTML = tags
    .map(
      (t) =>
        `<button class="tag-chip${activeTag === t ? ' active' : ''}" data-tag="${escapeHtml(t)}">` +
        `#${escapeHtml(t)} <span class="count">${counts.get(t)}</span></button>`
    )
    .join(' ');
}

function renderPreview() {
  previewEl.innerHTML = renderMarkdown(bodyEl.value);
}

function renderMeta(id) {
  const note = store.get(id);
  if (!note) {
    backlinksEl.innerHTML = '';
    noteTagsEl.innerHTML = '';
    metaInfoEl.textContent = '';
    return;
  }
  const tags = extractTags(note.body + '\n' + (note.title || ''));
  noteTagsEl.innerHTML = tags.length
    ? tags.map((t) => `<span class="tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join(' ')
    : '<span class="empty">none</span>';

  const bl = backlinks(store.all(), note.title);
  backlinksEl.innerHTML = bl.length
    ? bl
        .map(
          (n) =>
            `<li><a class="wikilink" data-note="${escapeHtml(n.title)}" href="#note:${encodeURIComponent(
              n.title
            )}">${escapeHtml(n.title || 'Untitled')}</a></li>`
        )
        .join('')
    : '<li class="empty">none yet</li>';

  metaInfoEl.innerHTML = `Created ${escapeHtml(fmt(note.createdAt))}<br>Updated ${escapeHtml(fmt(note.updatedAt))}`;
}

function clearEditor() {
  currentId = null;
  titleEl.value = '';
  bodyEl.value = '';
  titleEl.disabled = true;
  bodyEl.disabled = true;
  previewEl.innerHTML = '<p class="placeholder">Create a note to get started.</p>';
  renderMeta(null);
}

// ---- navigation -------------------------------------------------------
function selectNote(id) {
  const note = store.get(id);
  if (!note) return;
  currentId = id;
  titleEl.value = note.title || '';
  bodyEl.value = note.body || '';
  titleEl.disabled = false;
  bodyEl.disabled = false;
  renderPreview();
  renderMeta(id);
  renderList();
}

function navTo(title) {
  const target = normalizeTitle(title);
  let found = store.all().find((n) => normalizeTitle(n.title) === target);
  if (!found) found = store.all().find((n) => normalizeTitle(titleFromBody(n.body)) === target);
  if (found) {
    selectNote(found.id);
    return;
  }
  const clean = (title || '').trim() || 'Untitled';
  const note = store.create({ title: clean, body: `# ${clean}\n\n` });
  selectNote(note.id);
  renderTags();
  renderList();
}

// ---- persistence ------------------------------------------------------
const schedulePersist = debounce(() => {
  const note = store.get(currentId);
  if (!note) return;
  store.update(currentId, { title: titleEl.value.trim(), body: bodyEl.value });
  renderList();
  renderMeta(currentId);
}, 200);

// ---- events -----------------------------------------------------------
noteListEl.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]');
  if (li) selectNote(li.getAttribute('data-id'));
});

tagsEl.addEventListener('click', (e) => {
  const chip = e.target.closest('button[data-tag]');
  if (!chip) return;
  const tag = chip.getAttribute('data-tag');
  activeTag = activeTag === tag ? null : tag;
  renderTags();
  renderList();
});

searchEl.addEventListener('input', () => {
  query = searchEl.value.trim();
  renderList();
});

titleEl.addEventListener('input', () => {
  const note = store.get(currentId);
  if (note) store.update(currentId, { title: titleEl.value.trim() });
  renderList();
});

bodyEl.addEventListener('input', () => {
  renderPreview();
  schedulePersist();
});

function onWikilinkClick(e) {
  const a = e.target.closest('a.wikilink, a[data-note]');
  if (!a) return;
  e.preventDefault();
  navTo(a.getAttribute('data-note'));
}
previewEl.addEventListener('click', onWikilinkClick);
backlinksEl.addEventListener('click', onWikilinkClick);

newBtn.addEventListener('click', () => {
  const note = store.create({ title: '', body: '' });
  selectNote(note.id);
  renderTags();
  renderList();
  titleEl.focus();
});

deleteBtn.addEventListener('click', () => {
  const note = store.get(currentId);
  if (!note) return;
  const label = note.title && note.title.trim() ? note.title : 'Untitled';
  if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
  store.remove(currentId);
  const remaining = store.all();
  if (remaining.length) selectNote(remaining[0].id);
  else clearEditor();
  renderList();
  renderTags();
});

themeBtn.addEventListener('click', () => {
  const next = toggleTheme();
  themeBtn.textContent = next === 'dark' ? '☀' : '🌓';
});

exportMdBtn.addEventListener('click', () => {
  const note = store.get(currentId);
  if (!note) return;
  const name = note.title && note.title.trim() ? note.title : titleFromBody(note.body);
  download(`${slug(name)}.md`, note.body, 'text/markdown');
});

exportJsonBtn.addEventListener('click', () => {
  download(`leafnote-backup-${dateStamp()}.json`, store.exportJSON(), 'application/json');
});

importInput.addEventListener('change', async () => {
  const files = importInput.files;
  if (!files || !files.length) return;
  for (const f of files) {
    const text = await f.text();
    const title = f.name.replace(/\.(md|markdown|txt)$/i, '');
    store.create({ title, body: text });
  }
  importInput.value = '';
  renderList();
  renderTags();
});

// ---- seed + boot ------------------------------------------------------
function seedIfEmpty() {
  if (store.all().length) return;
  store.create({
    title: 'Welcome to Leafnote',
    body: [
      '# Welcome to Leafnote',
      '',
      'Leafnote is a **local-first** Markdown notes app. Everything you write',
      'stays in your browser — no account, no server, no tracking.',
      '',
      '## Try the basics',
      '',
      '- Write in **Markdown**: `**bold**`, `*italic*`, `~~strike~~`, `code`',
      '- Link notes with `[[Double brackets]]` (wiki-links)',
      '- Tag notes with `#topics` like #welcome or #how-to',
      '- Make a task list:',
      '  - [x] Open the app',
      '  - [ ] Write your first note',
      '',
      '> Tip: click a [[Getting Started]] link to jump (or create) a note.',
      '',
      '## Where is my data?',
      '',
      'Notes are saved in `localStorage`. Use **Backup JSON** to export everything',
      'and **Import .md** to bring files back in.',
      '',
    ].join('\n'),
  });
}

function init() {
  applyTheme(getInitialTheme());
  themeBtn.textContent = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark' ? '☀' : '🌓';
  store.load();
  seedIfEmpty();
  if (store.all().length) selectNote(store.all()[0].id);
  else clearEditor();
  renderList();
  renderTags();
}

init();
