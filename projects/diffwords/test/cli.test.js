import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { run } from '../src/cli.js';

/** @param {string[]} args @param {{tty?: boolean}} [opts] */
function makeProc(args, opts = {}) {
  const out = [];
  const err = [];
  return {
    argv: ['node', 'diffwords', ...args],
    stdout: { write: (s) => (out.push(String(s)), true), isTTY: !!opts.tty },
    stderr: { write: (s) => (err.push(String(s)), true) },
    out: () => out.join(''),
    errOut: () => err.join(''),
  };
}

const A = 'examples/before.txt';
const B = 'examples/after.txt';

test('diff of two files reports changes and exits 1', () => {
  const proc = makeProc([A, B], { tty: false });
  const code = run(proc);
  assert.equal(code, 1);
  const out = proc.out();
  assert.ok(out.includes('jumps') || out.includes('leaps'));
});

test('identical files exit 0', () => {
  const proc = makeProc([A, A]);
  const code = run(proc);
  assert.equal(code, 0);
});

test('--unified emits a hunked diff', () => {
  const proc = makeProc([A, B, '--unified']);
  const code = run(proc);
  assert.equal(code, 1);
  const out = proc.out();
  assert.ok(out.includes('@@'));
  assert.ok(out.includes('-') || out.includes('+'));
});

test('--json is parseable', () => {
  const proc = makeProc([A, B, '--json']);
  const code = run(proc);
  assert.equal(code, 1);
  const data = JSON.parse(proc.out());
  assert.equal(data.tool, 'diffwords');
  assert.ok(data.stats.added > 0);
});

test('--html writes a standalone file', () => {
  const tmp = 'test/_cli_out.html';
  const proc = makeProc([A, B, '--html', tmp]);
  const code = run(proc);
  assert.equal(code, 1);
  assert.ok(existsSync(tmp));
  const html = readFileSync(tmp, 'utf8');
  assert.ok(html.includes('diffwords'));
  unlinkSync(tmp);
});

test('missing arguments prints usage and exits 2', () => {
  const proc = makeProc([A]);
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

test('--stats prints a summary line', () => {
  const proc = makeProc([A, B, '--stats']);
  run(proc);
  assert.ok(proc.out().includes('similar'));
});

test('--version prints the version', () => {
  const proc = makeProc(['--version']);
  const code = run(proc);
  assert.equal(code, 0);
  assert.ok(proc.out().includes('diffwords'));
});
