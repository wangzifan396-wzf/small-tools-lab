# Leafnote

**Local-first Markdown notes & knowledge base.** Zero dependencies, works
offline, and your data never leaves your device.

[中文说明](./README.zh-CN.md)

---

Leafnote is a small, fast note-taking app you can actually *own*. There is no
account, no server, and no telemetry — your notes live in your browser's
`localStorage`. It is built as plain ES modules, so it is easy to read, fork,
and extend.

## ✨ Features

- **Markdown** with live preview — headings, bold/italic/strike, code, quotes,
  tables, task lists, and more.
- **Wiki-links** — write `[[Note Title]]` to link notes; click to jump, and
  missing notes are created on the fly.
- **Backlinks** — see every note that links to the one you're viewing.
- **#Tags** — tag notes and filter the sidebar by tag.
- **Full-text search** — title-weighted, multi-term ranking.
- **Light / dark theme** — follows your system preference, toggle any time.
- **Import / export** — import `.md` files; export single notes as `.md` or
  back up everything as JSON.
- **XSS-safe** — all Markdown is HTML-escaped and dangerous URLs
  (`javascript:`, `data:`) are neutralized.

## 🚀 Download & run (no build)

The whole app is a single HTML file. Grab
[`dist/leafnote.html`](./dist/leafnote.html) and **double-click it** — it opens
in your browser and just works, even offline.

> Your notes are stored per-browser/origin. Clearing site data or using a
> different browser/profile will not show them. Use **Backup JSON** to keep a
> portable copy.

## 🛠 Develop

```bash
# Run the app locally with a tiny zero-dependency static server
npm run serve          # → http://localhost:4173

# Run the unit tests (33 tests, no dependencies)
npm test

# Rebuild the single-file dist/leafnote.html
npm run build
```

No `npm install` is needed — Leafnote has zero runtime dependencies.

## 📁 Project layout

```
leafnote/
├── index.html          # 3-pane app shell
├── src/
│   ├── app.js          # DOM controller (wires everything together)
│   ├── styles.css      # light/dark theming + responsive layout
│   ├── store.js        # localStorage-backed note store + JSON backup
│   ├── markdown.js     # XSS-safe Markdown → HTML renderer
│   ├── search.js       # full-text ranking + backlinks
│   ├── theme.js        # light/dark theme handling
│   └── util.js         # small pure helpers
├── test/               # node:test suites (no DOM needed)
├── serve.js            # zero-dependency static server
├── build.js            # single-file bundler (inlines CSS + JS)
└── dist/leafnote.html  # the downloadable, self-contained build
```

## 🔒 Privacy

Leafnote sends **nothing** over the network. There is no analytics, no sync,
no remote server. What you write stays on your machine.

## 📜 License

[MIT](./LICENSE) © Leafnote contributors.
