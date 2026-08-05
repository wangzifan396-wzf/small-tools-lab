/**
 * Minimal-but-capable Markdown -> HTML renderer (pure, no DOM).
 *
 * Covers the subset a notes app needs: headings, bold/italic/strike,
 * inline & fenced code, links, images, wiki-links ([[Title]]), #tags,
 * blockquotes, horizontal rules, ordered/unordered/task lists, tables,
 * and paragraphs. Output is HTML-escaped and `javascript:` URLs are
 * neutralized, so it is safe to inject into the DOM.
 *
 * @module markdown
 */

import { escapeHtml } from './util.js';

const INLINE_CODE = /`([^`]+)`/g;
const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
const TAG_RE = /(^|[\s(])#([\p{L}\p{N}_-]+)/gu;
const CODE_FENCE = /```(\w*)\n([\s\S]*?)```/g;

/** Reject `javascript:` and other dangerous URL schemes. */
function sanitizeUrl(url) {
  const u = String(url).trim();
  if (/^(javascript|data|vbscript):/i.test(u)) return '#';
  return u;
}

/** Extract #tags from raw text (skips headings `# x` and hex colors `#fff`). */
export function extractTags(text) {
  const tags = new Set();
  const re = new RegExp(TAG_RE.source, 'gu');
  let m;
  const str = String(text || '');
  while ((m = re.exec(str))) {
    const tag = m[2];
    if (/^[\da-fA-F]{3,8}$/.test(tag)) continue; // hex color
    if (!/[a-zA-Z]/.test(tag)) continue; // must contain a letter
    tags.add(tag);
  }
  return [...tags];
}

/** Extract [[wiki-link]] target titles from raw text. */
export function extractWikilinks(text) {
  const out = [];
  const re = new RegExp(WIKILINK_RE.source, 'gu');
  let m;
  const str = String(text || '');
  while ((m = re.exec(str))) out.push(m[1].trim());
  return out;
}

/** Apply inline Markdown formatting to a single line/segment of text. */
function inline(text) {
  const codes = [];
  let t = escapeHtml(text);

  // protect inline code first (content is already escaped)
  t = t.replace(INLINE_CODE, (_, c) => {
    const idx = codes.push(c) - 1;
    return `\u0001${idx}\u0001`;
  });

  // images
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt, url) => `<img src="${sanitizeUrl(url)}" alt="${alt}">`);
  // links
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, txt, url) => `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener">${txt}</a>`);
  // wiki-links
  t = t.replace(WIKILINK_RE, (_, title, alias) => {
    const target = title.trim();
    const label = (alias || title).trim();
    return `<a class="wikilink" data-note="${target}" href="#note:${encodeURIComponent(target)}">${label}</a>`;
  });
  // bold, then italic
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // strike
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // tags
  t = t.replace(/(^|[\s(])#([\p{L}\p{N}_-]+)/gu, (m, pre, tag) => {
    if (/^[\da-fA-F]{3,8}$/.test(tag) || !/[a-zA-Z]/.test(tag)) return m;
    return `${pre}<span class="tag" data-tag="${tag}">#${tag}</span>`;
  });
  // restore inline code
  t = t.replace(/\u0001(\d+)\u0001/g, (_, idx) => `<code>${codes[Number(idx)]}</code>`);
  return t;
}

/** Render Markdown source to an HTML string. */
export function renderMarkdown(src) {
  const text = String(src == null ? '' : src).replace(/\r\n?/g, '\n');
  const codeBlocks = [];
  const s = text.replace(CODE_FENCE, (_, lang, code) => {
    const idx = codeBlocks.push({ lang: lang || '', code }) - 1;
    return `\n\u0000CODE${idx}\u0000\n`;
  });
  const lines = s.split('\n');
  const out = [];
  let i = 0;

  const splitRow = (r) =>
    r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    const codeMatch = line.trim().match(/^\u0000CODE(\d+)\u0000$/);
    if (codeMatch) {
      const { lang, code } = codeBlocks[Number(codeMatch[1])];
      out.push(`<pre class="code" data-lang="${escapeHtml(lang)}"><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);
      i += 1;
      continue;
    }
    if (line.trim() === '') { i += 1; continue; }

    // horizontal rule: 3+ of the same divider char
    if (/^(\s*[-*_]){3,}$/.test(line) && new Set(line.replace(/\s/g, '')).size === 1) {
      out.push('<hr>'); i += 1; continue;
    }
    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${inline(h[2].trim())}</h${lvl}>`);
      i += 1; continue;
    }
    // blockquote
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`);
      continue;
    }
    // table
    if (line.includes('|') && i + 1 < lines.length &&
        /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i])); i += 1;
      }
      const thead = `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }
    // list (ul / ol / task)
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '');
        const task = item.match(/^\[([ xX])\]\s+(.*)$/);
        if (task) {
          const checked = task[1].toLowerCase() === 'x';
          items.push(`<li><input type="checkbox" disabled${checked ? ' checked' : ''}> ${inline(task[2])}</li>`);
        } else {
          items.push(`<li>${inline(item)}</li>`);
        }
        i += 1;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    // paragraph
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' &&
           !/^(#{1,6}\s|>\s*|\d+\.\s|[-*+]\s)/.test(lines[i]) &&
           !/^(\s*[-*_]){3,}$/.test(lines[i]) &&
           !/^\u0000CODE\d+\u0000$/.test(lines[i].trim())) {
      buf.push(lines[i]); i += 1;
    }
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}
