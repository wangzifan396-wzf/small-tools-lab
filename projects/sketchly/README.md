# Sketchly

> A local-first, hand-drawn whiteboard. Infinite canvas, zero dependencies,
> works offline — your drawings never leave your device.

Sketchly is a lightweight alternative to Excalidraw / tldraw that you can run
with **no build step and no server**. Everything is stored in your browser
(`localStorage`); there is no account, no backend, and no network traffic.

![local-first](https://img.shields.io/badge/local--first-✓-green)
![zero deps](https://img.shields.io/badge/dependencies-0-blue)
![offline](https://img.shields.io/badge/works-offline-brightgreen)

## ✨ Features

- **Infinite canvas** — pan (space-drag / middle-mouse / scroll) and zoom
  (Ctrl/⌘ + wheel, or buttons).
- **Hand-drawn style** — a seeded "rough" renderer gives the sketchy look
  Excalidraw is known for, while staying stable as you pan/zoom.
- **Shapes** — pen (freehand), rectangle, ellipse, diamond, arrow, line, text.
- **Editing** — select, move, resize (8 handles), multi-select, marquee
  selection, delete.
- **Styling** — stroke & fill color, stroke width, hand-drawn amount, opacity.
- **Undo / redo** — full history (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z).
- **Export** — PNG image (cropped to content) and a JSON scene file.
  **Import** brings a JSON scene back.
- **Light / dark theme** — follows your OS and is toggleable.
- **Keyboard shortcuts** for every tool.

## 🚀 Quick start (zero install)

1. Download `dist/sketchly.html` (single file).
2. Double-click it — it opens in your browser and just works, offline.

That's it. No `npm`, no server.

## 🛠️ For developers

```bash
git clone https://github.com/your-org/sketchly.git
cd sketchly
npm test          # 22 unit tests on the pure core
npm run serve     # local preview at http://localhost:4173
npm run build     # regenerate dist/sketchly.html
```

### Project layout

```
sketchly/
├── index.html           # app shell (dev)
├── src/
│   ├── geometry.js      # pure: coords, bounds, hit-testing, resize  (tested)
│   ├── scene.js         # pure: element model + (de)serialization    (tested)
│   ├── store.js         # pure: localStorage persistence            (tested)
│   ├── render.js        # canvas rendering (clean + hand-drawn)
│   ├── theme.js         # light/dark
│   └── app.js           # controller: pointer/keyboard/UI wiring
├── test/                # node:test unit tests
├── serve.js             # zero-dep static server
├── build.js             # single-file bundler
└── dist/sketchly.html   # the shipped single-file app
```

The **core** (`geometry`, `scene`, `store`) contains no DOM, so it runs under
`node --test` in plain Node — this is what the 22 unit tests cover.

## ⌨️ Shortcuts

| Key | Action | Key | Action |
| --- | ------ | --- | ------ |
| `V` | Select | `P` | Pen |
| `H` / `Space` | Pan | `R` | Rectangle |
| `O` | Ellipse | `D` | Diamond |
| `A` | Arrow | `L` | Line |
| `T` | Text (or double-click) | `Del` | Delete selection |
| `Ctrl/⌘+Z` | Undo | `Ctrl/⌘+Shift+Z` | Redo |
| `Ctrl/⌘+A` | Select all | `+/-` / `0` | Zoom / reset |

## 🔒 Privacy

Sketchly makes **no network requests**. Your data lives only in the browser's
`localStorage` under the key `sketchly:v1`. Use **Export → 场景 (JSON)** to
back up, and **Import** to restore.

## 📄 License

MIT © Sketchly contributors.
