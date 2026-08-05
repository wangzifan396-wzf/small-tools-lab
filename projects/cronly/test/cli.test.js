import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.js';

/** @param {string[]} args */
function makeProc(args) {
  const out = [];
  const err = [];
  return {
    argv: ['node', 'cronly', ...args],
    stdout: { write: (s) => (out.push(String(s)), true) },
    stderr: { write: (s) => (err.push(String(s)), true) },
    out: () => out.join(''),
    errOut: () => err.join(''),
  };
}

test('parse prints valid JSON for a good expression', () => {
  const proc = makeProc(['parse', '0 9 * * 1-5']);
  const code = run(proc);
  assert.equal(code, 0);
  const data = JSON.parse(proc.out());
  assert.equal(data.valid, true);
  assert.ok(data.dow.includes(5));
});

test('parse reports an error for a bad expression', () => {
  const proc = makeProc(['parse', '70 0 0 * * *', '--seconds']);
  const code = run(proc);
  assert.equal(code, 2);
  assert.ok(proc.errOut().includes('cronly:'));
});

test('describe works in English and Chinese', () => {
  assert.ok(run(makeProc(['describe', '0 9 * * 1-5', '--lang', 'en'])) === 0);
  const zh = makeProc(['describe', '0 9 * * 1-5', '--lang', 'zh']);
  run(zh);
  assert.ok(zh.out().includes('运行'));
});

test('next lists the next run from a fixed reference', () => {
  const proc = makeProc(['next', '0 9 * * 1-5', '--from', '2026-08-03T08:30:00Z', '--tz', 'UTC']);
  const code = run(proc);
  assert.equal(code, 0);
  assert.ok(proc.out().includes('2026-08-03 09:00:00'));
});

test('next --count lists multiple runs', () => {
  const proc = makeProc(['next', '0 9 * * 1-5', '--from', '2026-08-03T08:30:00Z', '--tz', 'UTC', '--count', '3']);
  run(proc);
  const lines = proc.out().split('\n').filter((l) => l.includes('09:00:00'));
  assert.equal(lines.length, 3);
});

test('missing command prints usage and exits 2', () => {
  const proc = makeProc([]);
  const code = run(proc);
  assert.equal(code, 2);
  assert.ok(proc.errOut().includes('Usage'));
});

test('--help prints usage and exits 0', () => {
  const proc = makeProc(['--help']);
  const code = run(proc);
  assert.equal(code, 0);
  assert.ok(proc.out().includes('Usage'));
});
