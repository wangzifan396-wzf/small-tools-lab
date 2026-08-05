import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createElement,
  serializeScene,
  deserializeScene,
  resizeElement,
  translateElement,
} from '../src/scene.js';

test('createElement fills sensible defaults', () => {
  const r = createElement('rect', { x: 5, y: 5, w: 20, h: 20 });
  assert.equal(r.type, 'rect');
  assert.equal(r.stroke, '#1e1e1e');
  assert.equal(r.strokeWidth, 2);
  assert.equal(typeof r.id, 'string');
  assert.ok(r.seed >= 1);
});

test('createElement derives pen bounds from points', () => {
  const p = createElement('pen', { points: [[0, 0], [40, 30]] });
  assert.equal(p.x, 0);
  assert.equal(p.y, 0);
  assert.equal(p.w, 40);
  assert.equal(p.h, 30);
});

test('serialize/deserialize round-trips', () => {
  const scene = {
    elements: [createElement('rect', { x: 1, y: 2, w: 3, h: 4 })],
    view: { x: 10, y: 20, zoom: 2 },
  };
  const back = deserializeScene(serializeScene(scene));
  assert.equal(back.elements.length, 1);
  assert.equal(back.elements[0].w, 3);
  assert.equal(back.view.zoom, 2);
});

test('deserialize rejects invalid input', () => {
  assert.throws(() => deserializeScene('not json'), /Invalid Sketchly scene/);
  assert.throws(() => deserializeScene('{"foo":1}'), /Invalid Sketchly scene/);
});

test('resizeElement scales pen points', () => {
  const p = createElement('pen', { points: [[0, 0], [10, 10]] });
  resizeElement(p, 'e', 10, 0); // widen by 10
  // end x scaled from 10 to 20, start stays at 0
  const xs = p.points.map((pt) => pt[0]);
  assert.ok(Math.abs(xs[1] - 20) < 1e-6);
  assert.ok(Math.abs(xs[0] - 0) < 1e-6);
});

test('resizeElement grows a rectangle', () => {
  const r = createElement('rect', { x: 0, y: 0, w: 100, h: 100 });
  resizeElement(r, 'se', 50, 50);
  assert.equal(r.w, 150);
  assert.equal(r.h, 150);
});

test('translateElement moves pen points too', () => {
  const p = createElement('pen', { points: [[0, 0], [10, 10]] });
  translateElement(p, 5, 7);
  assert.deepEqual(p.points[0], [5, 7]);
  assert.deepEqual(p.points[1], [15, 17]);
  assert.equal(p.x, 5);
});
