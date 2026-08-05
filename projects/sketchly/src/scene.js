/**
 * Scene model: element creation, (de)serialization, and mutations that
 * stay pure (no DOM). Boxes are in world coordinates.
 *
 * @module scene
 */

import { getBounds, resizeBox } from './geometry.js';

const SCHEMA_VERSION = 1;
const TYPES = ['pen', 'rect', 'ellipse', 'diamond', 'arrow', 'line', 'text'];

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'e_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function now() {
  return Date.now();
}

/** Rough text-size estimate so scene logic stays canvas-free. */
export function measureTextBounds(text, fontSize) {
  const font = fontSize || 20;
  const lines = String(text || '').split('\n');
  let maxW = 0;
  for (const line of lines) maxW = Math.max(maxW, line.length * font * 0.6);
  return {
    w: Math.max(maxW, 10),
    h: Math.max(lines.length * font * 1.25, font * 1.25),
  };
}

export function createElement(type, props = {}) {
  const el = {
    id: props.id || uid(),
    type,
    x: Number(props.x) || 0,
    y: Number(props.y) || 0,
    w: Number(props.w) || 0,
    h: Number(props.h) || 0,
    stroke: typeof props.stroke === 'string' ? props.stroke : '#1e1e1e',
    fill: typeof props.fill === 'string' ? props.fill : 'transparent',
    strokeWidth: Number(props.strokeWidth) > 0 ? Number(props.strokeWidth) : 2,
    roughness: Number(props.roughness) >= 0 ? Number(props.roughness) : 1,
    opacity: Number(props.opacity) >= 0 && Number(props.opacity) <= 1 ? Number(props.opacity) : 1,
    seed: Number(props.seed) || Math.floor(Math.random() * 2 ** 31),
    updatedAt: now(),
  };
  if (type === 'pen') {
    el.points = props.points ? props.points.map((p) => [Number(p[0]) || 0, Number(p[1]) || 0]) : [];
    const b = getBounds(el);
    el.x = b.x;
    el.y = b.y;
    el.w = b.w;
    el.h = b.h;
  }
  if (type === 'text') {
    el.text = typeof props.text === 'string' ? props.text : '';
    el.fontSize = Number(props.fontSize) > 0 ? Number(props.fontSize) : 20;
    const m = measureTextBounds(el.text, el.fontSize);
    el.w = m.w;
    el.h = m.h;
  }
  return el;
}

function normalizeElement(raw) {
  const e = raw && typeof raw === 'object' ? raw : {};
  const type = TYPES.includes(e.type) ? e.type : 'rect';
  const out = {
    id: typeof e.id === 'string' && e.id ? e.id : uid(),
    type,
    x: Number(e.x) || 0,
    y: Number(e.y) || 0,
    w: Number(e.w) || 0,
    h: Number(e.h) || 0,
    stroke: typeof e.stroke === 'string' ? e.stroke : '#1e1e1e',
    fill: typeof e.fill === 'string' ? e.fill : 'transparent',
    strokeWidth: Number(e.strokeWidth) > 0 ? Number(e.strokeWidth) : 2,
    roughness: Number(e.roughness) >= 0 ? Number(e.roughness) : 1,
    opacity: Number(e.opacity) >= 0 && Number(e.opacity) <= 1 ? Number(e.opacity) : 1,
    seed: Number(e.seed) || 1,
    updatedAt: Number(e.updatedAt) || now(),
  };
  if (type === 'pen') {
    out.points = Array.isArray(e.points)
      ? e.points.map((p) => [Number(p && p[0]) || 0, Number(p && p[1]) || 0])
      : [];
  }
  if (type === 'text') {
    out.text = typeof e.text === 'string' ? e.text : '';
    out.fontSize = Number(e.fontSize) > 0 ? Number(e.fontSize) : 20;
  }
  return out;
}

export function serializeScene(scene) {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    elements: scene.elements || [],
    view: scene.view || { x: 0, y: 0, zoom: 1 },
  });
}

export function deserializeScene(str) {
  let data;
  try {
    data = JSON.parse(str);
  } catch {
    throw new Error('Invalid Sketchly scene: not valid JSON');
  }
  if (!data || !Array.isArray(data.elements)) {
    throw new Error('Invalid Sketchly scene: missing elements array');
  }
  const elements = data.elements.map(normalizeElement);
  const view =
    data.view && typeof data.view === 'object'
      ? {
          x: Number(data.view.x) || 0,
          y: Number(data.view.y) || 0,
          zoom: Number(data.view.zoom) > 0 ? Number(data.view.zoom) : 1,
        }
      : { x: 0, y: 0, zoom: 1 };
  return { elements, view };
}

/**
 * Resize an element by dragging `handle` (n/s/e/w/ne/nw/se/sw) with world
 * deltas dx,dy. Mutates and returns the element.
 */
export function resizeElement(el, handle, dx, dy) {
  if (el.type === 'pen') {
    const b = getBounds(el);
    const nb = resizeBox(b.x, b.y, b.w, b.h, handle, dx, dy);
    const sx = b.w === 0 ? 1 : nb.w / b.w;
    const sy = b.h === 0 ? 1 : nb.h / b.h;
    el.points = el.points.map(([px, py]) => [nb.x + (px - b.x) * sx, nb.y + (py - b.y) * sy]);
    const nb2 = getBounds(el);
    el.x = nb2.x;
    el.y = nb2.y;
    el.w = nb2.w;
    el.h = nb2.h;
    el.updatedAt = now();
    return el;
  }
  if (el.type === 'text') {
    const b = getBounds(el);
    const nb = resizeBox(b.x, b.y, b.w, b.h, handle, dx, dy);
    const scale = Math.max(
      Math.abs(nb.w) / Math.max(b.w, 1),
      Math.abs(nb.h) / Math.max(b.h, 1)
    );
    el.fontSize = Math.max(6, el.fontSize * scale);
    const m = measureTextBounds(el.text, el.fontSize);
    el.w = m.w;
    el.h = m.h;
    el.updatedAt = now();
    return el;
  }
  const b = getBounds(el);
  const nb = resizeBox(b.x, b.y, b.w, b.h, handle, dx, dy);
  el.x = nb.x;
  el.y = nb.y;
  el.w = nb.w;
  el.h = nb.h;
  el.updatedAt = now();
  return el;
}

/** Translate an element by a world delta. */
export function translateElement(el, dx, dy) {
  el.x += dx;
  el.y += dy;
  if (el.type === 'pen') el.points = el.points.map(([px, py]) => [px + dx, py + dy]);
  el.updatedAt = now();
  return el;
}
