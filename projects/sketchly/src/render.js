/**
 * Canvas rendering for Sketchly. Draws each element with either a clean or
 * a hand-drawn ("rough") style. The hand-drawn look is produced by a tiny
 * seeded PRNG so a given element renders identically on every frame (no
 * jitter while panning/zooming). Takes a CanvasRenderingContext2D.
 *
 * @module render
 */

import { getBounds } from './geometry.js';

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw a slightly wobbly line in `passes` strokes (hand-drawn feel). */
function roughLine(ctx, x1, y1, x2, y2, rng, roughness) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const amp = Math.min(roughness, 2) * Math.min(len, 60) / 12;
  if (amp < 0.4) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    return;
  }
  for (let p = 0; p < 2; p++) {
    const jx1 = (rng() * 2 - 1) * amp;
    const jy1 = (rng() * 2 - 1) * amp;
    const jx2 = (rng() * 2 - 1) * amp;
    const jy2 = (rng() * 2 - 1) * amp;
    const mx = (x1 + x2) / 2 + (rng() * 2 - 1) * amp * 1.2;
    const my = (y1 + y2) / 2 + (rng() * 2 - 1) * amp * 1.2;
    ctx.beginPath();
    ctx.moveTo(x1 + jx1, y1 + jy1);
    ctx.quadraticCurveTo(mx, my, x2 + jx2, y2 + jy2);
    ctx.stroke();
  }
}

function drawArrowHead(ctx, x, y, angle, size) {
  const a1 = angle + Math.PI - 0.45;
  const a2 = angle + Math.PI + 0.45;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a1) * size, y + Math.sin(a1) * size);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a2) * size, y + Math.sin(a2) * size);
  ctx.stroke();
}

function renderRect(ctx, el, rough, rng) {
  const b = getBounds(el);
  const { x, y, w, h } = b;
  if (rough) {
    roughLine(ctx, x, y, x + w, y, rng, rough);
    roughLine(ctx, x + w, y, x + w, y + h, rng, rough);
    roughLine(ctx, x + w, y + h, x, y + h, rng, rough);
    roughLine(ctx, x, y + h, x, y, rng, rough);
  } else {
    ctx.strokeRect(x, y, w, h);
  }
}

function renderEllipse(ctx, el, rough, rng) {
  const b = getBounds(el);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rx = b.w / 2;
  const ry = b.h / 2;
  if (rough && rx > 2 && ry > 2) {
    for (let p = 0; p < 2; p++) {
      const sx = 1 + (rng() * 2 - 1) * 0.02 * Math.min(rough, 2);
      const sy = 1 + (rng() * 2 - 1) * 0.02 * Math.min(rough, 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * sx, ry * sy, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function renderDiamond(ctx, el, rough, rng) {
  const b = getBounds(el);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const pts = [
    [cx, b.y],
    [b.x + b.w, cy],
    [cx, b.y + b.h],
    [b.x, cy],
  ];
  if (rough) {
    for (let i = 0; i < 4; i++) {
      const a = pts[i];
      const c = pts[(i + 1) % 4];
      roughLine(ctx, a[0], a[1], c[0], c[1], rng, rough);
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
  }
}

function renderLine(ctx, el, rough, rng) {
  const x2 = el.x + (el.w || 0);
  const y2 = el.y + (el.h || 0);
  roughLine(ctx, el.x, el.y, x2, y2, rng, rough);
  if (el.type === 'arrow') {
    const angle = Math.atan2(el.h || 0, el.w || 0);
    const size = Math.max(12, (el.strokeWidth || 2) * 4);
    drawArrowHead(ctx, x2, y2, angle, size);
  }
}

function renderPen(ctx, el) {
  const pts = el.points || [];
  if (!pts.length) return;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 1) {
    ctx.lineTo(pts[0][0] + 0.1, pts[0][1] + 0.1);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
  }
  ctx.stroke();
}

function renderText(ctx, el) {
  const fontFamily = el.roughness > 0 ? '"Segoe Print","Comic Sans MS",cursive' : 'system-ui, sans-serif';
  ctx.font = `${el.fontSize || 20}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = el.stroke;
  const lines = String(el.text || '').split('\n');
  const lh = (el.fontSize || 20) * 1.25;
  lines.forEach((line, i) => ctx.fillText(line, el.x, el.y + i * lh));
}

/** Render a single element at full opacity (caller manages transform). */
export function renderElement(ctx, el) {
  const rough = el.roughness > 0 ? el.roughness : 0;
  const rng = mulberry32(el.seed || 1);
  ctx.save();
  ctx.globalAlpha = el.opacity != null ? el.opacity : 1;
  ctx.strokeStyle = el.stroke;
  ctx.fillStyle = el.fill && el.fill !== 'transparent' ? el.fill : el.stroke;
  ctx.lineWidth = el.strokeWidth || 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const hasFill = el.fill && el.fill !== 'transparent';

  switch (el.type) {
    case 'rect':
      if (hasFill) {
        const b = getBounds(el);
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      renderRect(ctx, el, rough, rng);
      break;
    case 'ellipse':
      if (hasFill) {
        const b = getBounds(el);
        ctx.beginPath();
        ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      renderEllipse(ctx, el, rough, rng);
      break;
    case 'diamond':
      if (hasFill) {
        const b = getBounds(el);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        ctx.beginPath();
        ctx.moveTo(cx, b.y);
        ctx.lineTo(b.x + b.w, cy);
        ctx.lineTo(cx, b.y + b.h);
        ctx.lineTo(b.x, cy);
        ctx.closePath();
        ctx.fill();
      }
      renderDiamond(ctx, el, rough, rng);
      break;
    case 'line':
    case 'arrow':
      renderLine(ctx, el, rough, rng);
      break;
    case 'pen':
      renderPen(ctx, el);
      break;
    case 'text':
      renderText(ctx, el);
      break;
    default:
      break;
  }
  ctx.restore();
}

/**
 * Render every element. The caller is responsible for applying the
 * world->screen transform (translate + scale) before calling this, since
 * both the main canvas and PNG export need different setups.
 */
export function renderScene(ctx, elements) {
  for (const el of elements) renderElement(ctx, el);
}
