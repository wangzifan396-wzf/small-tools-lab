import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffArrays } from '../src/core/lcs.js';

test('equal arrays produce a single equal op', () => {
  const ops = diffArrays(['a', 'b', 'c'], ['a', 'b', 'c']);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].type, 'equal');
  assert.equal(ops[0].tokens.length, 3);
});

test('insertion produces a trailing insert op', () => {
  const ops = diffArrays(['a', 'b'], ['a', 'b', 'c']);
  assert.deepEqual(
    ops.map((o) => o.type),
    ['equal', 'insert'],
  );
  assert.equal(ops[1].tokens[0], 'c');
});

test('deletion produces a delete op', () => {
  const ops = diffArrays(['a', 'b', 'c'], ['a', 'c']);
  assert.deepEqual(
    ops.map((o) => o.type),
    ['equal', 'delete', 'equal'],
  );
  assert.equal(ops[1].tokens[0], 'b');
});

test('substitution is delete + insert', () => {
  const ops = diffArrays(['x', 'y'], ['x', 'z']);
  assert.deepEqual(
    ops.map((o) => o.type),
    ['equal', 'delete', 'insert'],
  );
});

test('adjacent ops of the same kind are merged', () => {
  const ops = diffArrays(['a', 'b', 'c'], ['a']);
  assert.equal(ops.length, 2); // equal + merged delete(2)
  assert.equal(ops[1].type, 'delete');
  assert.equal(ops[1].tokens.length, 2);
});

test('replacement in the middle is handled', () => {
  const ops = diffArrays(['the', 'cat', 'sat'], ['the', 'dog', 'sat']);
  const changed = ops.filter((o) => o.type !== 'equal');
  assert.equal(changed.length, 2);
  assert.equal(changed[0].tokens[0], 'cat');
  assert.equal(changed[1].tokens[0], 'dog');
});
