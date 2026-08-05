# Sketchly — feature & design notes

## Element model

Every object on the canvas is an *element* with a normalized bounding box in
**world** coordinates:

| type      | fields                                            |
| --------- | ------------------------------------------------- |
| `pen`     | `points: [[x,y], …]` (absolute world coords)     |
| `rect`    | `x, y, w, h`                                       |
| `ellipse` | `x, y, w, h`                                       |
| `diamond` | `x, y, w, h`                                       |
| `line`    | `x, y, w, h` (end = `x+w, y+h`)                    |
| `arrow`   | `x, y, w, h` + arrowhead at the end               |
| `text`    | `x, y, w, h, text, fontSize`                      |

Shared style fields: `stroke` (color), `fill` (`transparent` or color),
`strokeWidth`, `roughness` (0 = clean, up to 2 = very sketchy), `opacity`,
`seed` (drives the hand-drawn jitter so it is stable across frames).

## Coordinate systems

- **World**: where elements live; resolution-independent.
- **Screen (CSS px)**: `screen = world * zoom + offset` (see `geometry.js`
  `worldToScreen` / `screenToWorld`). The canvas also scales by
  `devicePixelRatio` for crisp rendering on HiDPI displays.

## Hand-drawn rendering

`render.js` seeds a tiny PRNG (`mulberry32`) from each element's `seed`. Lines
are drawn in 1–2 slightly curved passes with amplitude scaled by length and
`roughness`; ellipses are overdrawn with small random scale/offset. Because the
seed is fixed per element, the same shape renders identically every frame —
no jitter while panning or zooming. Setting `roughness = 0` disables the effect
for crisp, clean shapes.

## Selection, move, resize

- Hit testing (`geometry.hitTest`) uses a world-space threshold so it feels
  consistent at any zoom.
- Move translates every selected element (pen points included).
- Resize (`scene.resizeElement`) edits the bounding box for box-like shapes and
  lines; for `pen` it scales the point cloud, for `text` it scales the font
  size. Resize handles are only shown for a single selection.
- Marquee selection uses `elementsInBox`.

## Persistence

`store.js` saves the whole scene (`{ elements, view }`) to `localStorage` under
`sketchly:v1`, debounced ~500 ms. Serialization lives in `scene.js`
(`serializeScene` / `deserializeScene`) with validation, so a corrupt or
 partial file falls back to an empty scene instead of crashing.

## Undo / redo

A snapshot ring (`history`, capped at 100) records `serializeScene(scene)` after
each committed mutation (create / move / resize / delete / style change / import
/ clear). View-only changes (pan/zoom) update the live scene but do **not**
create history entries, so undo stays focused on your content.

## Export

- **PNG**: an offscreen canvas is sized to the content bounding box (+ padding),
  rendered at 2× for sharpness, filled with the theme background, and downloaded.
- **JSON**: the raw scene, re-importable later.

## Security

- No network requests, no external scripts, no dependencies.
- The single-file build inlines everything; it runs from `file://`.
