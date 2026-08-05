/**
 * Pure geometry helpers for Sketchly. No DOM, no canvas — safe to unit
 * test in Node. All math is in *world* coordinates unless a function name
 * says otherwise.
 *
 * @module geometry
 */

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Shortest distance from point P to segment AB. */
export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return dist(px, py, cx, cy);
}

/** Convert a possibly-negative box to a normalized one. */
export function normalizeBox(x, y, w, h) {
  const minX = w < 0 ? x + w : x;
  const minY = h < 0 ? y + h : y;
  return { x: minX, y: minY, w: Math.abs(w), h: Math.abs(h) };
}

/** Axis-aligned bounding box of an element in world coordinates. */
export function getBounds(el) {
  if (el.type === 'pen') {
    const pts = el.points || [];
    if (!pts.length) return { x: el.x, y: el.y, w: 0, h: 0, minX: el.x, minY: el.y, maxX: el.x, maxY: el.y };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of pts) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
  }
  const b = normalizeBox(el.x, el.y, el.w || 0, el.h || 0);
  return { ...b, minX: b.x, minY: b.y, maxX: b.x + b.w, maxY: b.y + b.h };
}

/** World -> screen given view {x, y, zoom}. */
export function worldToScreen(wx, wy, view) {
  return { x: wx * view.zoom + view.x, y: wy * view.zoom + view.y };
}

/** Screen -> world given view {x, y, zoom}. */
export function screenToWorld(sx, sy, view) {
  return { x: (sx - view.x) / view.zoom, y: (sy - view.y) / view.zoom };
}

/** Do two axis-aligned boxes intersect? */
export function boxesIntersect(a, b) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/** Hit test an element at world point (wx, wy) with a world-space threshold. */
export function hitTest(el, wx, wy, threshold = 6) {
  const t = threshold;
  switch (el.type) {
    case 'pen': {
      const pts = el.points || [];
      for (let i = 0; i < pts.length - 1; i++) {
        if (distanceToSegment(wx, wy, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= t) return true;
      }
      if (pts.length === 1) return dist(wx, wy, pts[0][0], pts[0][1]) <= t;
      return false;
    }
    case 'line':
    case 'arrow':
      return distanceToSegment(wx, wy, el.x, el.y, el.x + (el.w || 0), el.y + (el.h || 0)) <= t;
    case 'ellipse': {
      const b = getBounds(el);
      const rx = Math.max(b.w / 2, 0.001);
      const ry = Math.max(b.h / 2, 0.001);
      const cx = b.x + rx;
      const cy = b.y + ry;
      const norm = ((wx - cx) / rx) ** 2 + ((wy - cy) / ry) ** 2;
      return norm <= 1 + t / Math.max(rx, ry);
    }
    case 'rect':
    case 'diamond':
    case 'text':
    default: {
      const b = getBounds(el);
      return wx >= b.minX - t && wx <= b.maxX + t && wy >= b.minY - t && wy <= b.maxY + t;
    }
  }
}

/** Elements whose bounding box intersects the marquee box. */
export function elementsInBox(elements, box) {
  const nb = normalizeBox(box.x, box.y, box.w, box.h);
  const query = { minX: nb.x, minY: nb.y, maxX: nb.x + nb.w, maxY: nb.y + nb.h };
  return elements.filter((el) => boxesIntersect(getBounds(el), query));
}

const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export function isHandle(name) {
  return HANDLES.includes(name);
}

/**
 * Compute new x/y/w/h when dragging a resize handle by world deltas dx,dy.
 * Handle names: n, s, e, w, ne, nw, se, sw.
 */
export function resizeBox(x, y, w, h, handle, dx, dy) {
  let nx = x, ny = y, nw = w, nh = h;
  if (handle.includes('e')) nw = w + dx;
  if (handle.includes('s')) nh = h + dy;
  if (handle.includes('w')) {
    nx = x + dx;
    nw = w - dx;
  }
  if (handle.includes('n')) {
    ny = y + dy;
    nh = h - dy;
  }
  return { x: nx, y: ny, w: nw, h: nh };
}
