import test from 'node:test';
import assert from 'node:assert/strict';
import { get, pick, omit, filter, sortBy, select } from '../src/index.js';

const sample = [
  { name: 'bob', age: 30, city: 'NYC' },
  { name: 'amy', age: 25, city: 'LA' },
  { name: 'carl', age: 40, city: 'NYC' }
];

test('get nested path', () => {
  assert.deepEqual(get({ a: { b: [10, 20] } }, 'a.b.0'), 10);
  assert.deepEqual(get({ a: { b: [10, 20] } }, 'a/b/1'), 20);
  assert.equal(get({ a: 1 }, 'x.y'), undefined);
});

test('pick keeps only listed keys', () => {
  assert.deepEqual(pick({ a: 1, b: 2, c: 3 }, ['a', 'c']), { a: 1, c: 3 });
});

test('omit drops listed keys', () => {
  assert.deepEqual(omit({ a: 1, b: 2, c: 3 }, ['b']), { a: 1, c: 3 });
});

test('filter eq / gt / contains', () => {
  assert.equal(filter(sample, 'age', 'gt', '26').length, 2);
  assert.equal(filter(sample, 'city', 'eq', 'NYC').length, 2);
  assert.equal(filter(sample, 'name', 'contains', 'a').length, 2); // amy, carl
});

test('filter rejects non-array', () => {
  assert.throws(() => filter({ a: 1 }, 'a', 'eq', 1), TypeError);
});

test('sortBy asc / desc by key', () => {
  const asc = sortBy(sample, 'age').map((x) => x.name);
  assert.deepEqual(asc, ['amy', 'bob', 'carl']);
  const desc = sortBy(sample, 'age', 'desc').map((x) => x.name);
  assert.deepEqual(desc, ['carl', 'bob', 'amy']);
});

test('select maps to picked keys', () => {
  assert.deepEqual(select(sample, ['name']), [{ name: 'bob' }, { name: 'amy' }, { name: 'carl' }]);
});
