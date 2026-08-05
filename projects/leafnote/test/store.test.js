import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, serialize, deserialize } from '../src/store.js';

// In-memory localStorage-compatible backend for tests.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('create / get / all', () => {
  const s = new Store(memoryStorage());
  const n = s.create({ title: 'T', body: 'B' });
  assert.equal(s.all().length, 1);
  assert.equal(s.get(n.id).title, 'T');
});

test('update persists and bumps updatedAt', () => {
  const s = new Store(memoryStorage());
  const n = s.create({ title: 'T', body: 'B' });
  const before = n.updatedAt;
  s.update(n.id, { title: 'T2' });
  assert.equal(s.get(n.id).title, 'T2');
  // allow clock granularity
  assert.ok(s.get(n.id).updatedAt >= before);
});

test('remove deletes a note', () => {
  const s = new Store(memoryStorage());
  const n = s.create({ title: 'T', body: 'B' });
  assert.equal(s.remove(n.id), true);
  assert.equal(s.get(n.id), null);
});

test('load reads back persisted data', () => {
  const storage = memoryStorage();
  const s1 = new Store(storage);
  s1.create({ title: 'Persisted', body: 'x' });
  const s2 = new Store(storage);
  s2.load();
  assert.equal(s2.all().length, 1);
  assert.equal(s2.all()[0].title, 'Persisted');
});

test('serialize / deserialize round-trips', () => {
  const s = new Store(memoryStorage());
  s.create({ title: 'A', body: 'a' });
  s.create({ title: 'B', body: 'b' });
  const json = s.exportJSON();
  const restored = deserialize(json);
  assert.equal(restored.length, 2);
  assert.deepEqual(restored.map((n) => n.title).sort(), ['A', 'B']);
});

test('deserialize rejects garbage', () => {
  assert.throws(() => deserialize('not json {'), /Invalid Leafnote backup/);
});

test('importJSON merges by id', () => {
  const s = new Store(memoryStorage());
  const n = s.create({ title: 'Orig', body: 'orig' });
  const backup = JSON.stringify({ version: 1, notes: [
    { id: n.id, title: 'Updated', body: 'new' },
    { id: 'fresh', title: 'Fresh', body: 'f' },
  ] });
  s.importJSON(backup);
  assert.equal(s.get(n.id).title, 'Updated');
  assert.equal(s.get('fresh').title, 'Fresh');
  assert.equal(s.all().length, 2);
});
