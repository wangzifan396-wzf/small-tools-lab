import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBox,
  screenToWorld,
  worldToScreen,
  distanceToSegment,
  hitTest,
  getBounds,
  elementsInBox,
  resizeBox,
} from '../src/geometry.js';

test('normalizeBox flips negative width/height', () => {
  assert.deepEqual(normalizeBox(10, 10, -4, -2), { x: 6, y: 8, w: 4, h: 2 });
  assert.deepEqual(normalizeBox(0, 0, 5, 5), { x: 0, y: 0, w: 5, h: 5 });
});

test('world/screen transforms are inverses', () => {
  const view = { x: 30, y: -12, zoom: 1.5 };
  const w = screenToWorld(100, 60, view);
  const s = worldToScreen(w.x, w.y, view);
  assert.ok(Math.abs(s.x - 100) < 1e-9 && Math.abs(s.y - 60) < 1e-9);
});

test('distanceToSegment hits the closest point', () => {
  assert.equal(distanceToSegment(5, 0, 0, 0, 10, 0), 0); // on segment
  assert.ok(Math.abs(distanceToSegment(0, 3, 0, 0, 10, 0) - 3) < 1e-9); // above start
});

test('hitTest: rectangle contains point near center', () => {
  const r = { type: 'rect', x: 0, y: 0, w: 100, h: 50 };
  assert.equal(hitTest(r, 50, 25, 6), true);
  assert.equal(hitTest(r, 200, 200, 6), false);
});

test('hitTest: line near segment', () => {
  const l = { type: 'line', x: 0, y: 0, w: 100, h: 0 };
  assert.equal(hitTest(l, 50, 2, 6), true);
  assert.equal(hitTest(l, 50, 40, 6), false);
});

test('hitTest: ellipse inside', () => {
  const e = { type: 'ellipse', x: 0, y: 0, w: 100, h: 100 };
  assert.equal(hitTest(e, 50, 50, 6), true);
  assert.equal(hitTest(e, 2, 2, 6), false); // corner outside
});

test('hitTest: pen near a stroke point', () => {
  const p = { type: 'pen', points: [[0, 0], [100, 0], [100, 100]] };
  assert.equal(hitTest(p, 50, 1, 6), true);
  assert.equal(hitTest(p, 50, 80, 6), false);
});

test('elementsInBox selects intersecting elements', () => {
  const els = [
    { type: 'rect', x: 0, y: 0, w: 10, h: 10 },
    { type: 'rect', x: 500, y: 500, w: 10, h: 10 },
  ];
  const found = elementsInBox(els, { x: -5, y: -5, w: 30, h: 30 });
  assert.equal(found.length, 1);
});

test('resizeBox moves the right edges', () => {
  assert.deepEqual(resizeBox(0, 0, 100, 100, 'e', 20, 0), { x: 0, y: 0, w: 120, h: 100 });
  assert.deepEqual(resizeBox(0, 0, 100, 100, 'w', 20, 0), { x: 20, y: 0, w: 80, h: 100 });
  assert.deepEqual(resizeBox(0, 0, 100, 100, 'se', 10, 10), { x: 0, y: 0, w: 110, h: 110 });
});

test('getBounds for pen uses point extremes', () => {
  const b = getBounds({ type: 'pen', points: [[5, 5], [15, 25]] });
  assert.equal(b.x, 5);
  assert.equal(b.y, 5);
  assert.equal(b.w, 10);
  assert.equal(b.h, 20);
});
