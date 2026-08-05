import test from 'node:test';
import assert from 'node:assert/strict';
import { rankNotes, backlinks } from '../src/search.js';

const NOTES = [
  { id: '1', title: 'Apple Pie', body: 'a recipe with apples' },
  { id: '2', title: 'Banana Bread', body: 'uses bananas and sugar' },
  { id: '3', title: 'Cherry Tart', body: 'link to [[Apple Pie]] here' },
];

test('rankNotes: empty query returns all', () => {
  assert.equal(rankNotes(NOTES, '').length, 3);
});

test('rankNotes: title match ranks above body match', () => {
  const r = rankNotes(NOTES, 'apple');
  assert.equal(r[0].id, '1');
});

test('rankNotes: body term still matches', () => {
  const r = rankNotes(NOTES, 'bananas');
  assert.deepEqual(r.map((n) => n.id), ['2']);
});

test('rankNotes: all terms must match (AND)', () => {
  const r = rankNotes(NOTES, 'apple banana');
  assert.equal(r.length, 0);
});

test('backlinks: finds notes linking to a title', () => {
  const r = backlinks(NOTES, 'Apple Pie');
  assert.deepEqual(r.map((n) => n.id), ['3']);
});

test('backlinks: case-insensitive', () => {
  const r = backlinks(NOTES, 'apple pie');
  assert.deepEqual(r.map((n) => n.id), ['3']);
});
