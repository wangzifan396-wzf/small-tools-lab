import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { createElement, serializeScene } from '../src/scene.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test('load returns empty default when nothing stored', () => {
  const store = new Store(memoryStorage());
  const scene = store.load();
  assert.deepEqual(scene.elements, []);
  assert.equal(scene.view.zoom, 1);
});

test('save then load round-trips a scene', () => {
  const backend = memoryStorage();
  const store = new Store(backend);
  const scene = {
    elements: [createElement('rect', { x: 1, y: 1, w: 2, h: 2 })],
    view: { x: 5, y: 5, zoom: 1.5 },
  };
  store.save(scene);
  const back = store.load();
  assert.equal(back.elements.length, 1);
  assert.equal(back.view.zoom, 1.5);
  // storage actually holds serialized JSON
  assert.ok(backend.getItem('sketchly:v1').includes('elements'));
});

test('load tolerates corrupt data', () => {
  const backend = memoryStorage();
  backend.setItem('sketchly:v1', '{{{bad');
  const store = new Store(backend);
  const scene = store.load();
  assert.deepEqual(scene.elements, []);
});

test('clear removes stored data', () => {
  const backend = memoryStorage();
  const store = new Store(backend);
  store.save({ elements: [createElement('rect')], view: { x: 0, y: 0, zoom: 1 } });
  store.clear();
  assert.equal(backend.getItem('sketchly:v1'), null);
});

test('serializeScene output is valid JSON', () => {
  const json = serializeScene({ elements: [], view: { x: 0, y: 0, zoom: 1 } });
  assert.doesNotThrow(() => JSON.parse(json));
});
