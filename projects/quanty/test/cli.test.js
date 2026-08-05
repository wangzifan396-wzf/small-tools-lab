import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/cli.js';

function capture(fn) {
  const out = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => out.push(a.join(' '));
  console.error = (...a) => out.push(a.join(' '));
  try {
    const code = fn();
    return { code, out: out.join('\n') };
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

test('cli bytes', () => {
  const { code, out } = capture(() => run(['bytes', '1536']));
  assert.equal(code, 0);
  assert.equal(out, '1.5 KiB');
});

test('cli bytes --si', () => {
  const { code, out } = capture(() => run(['bytes', '1500000', '--si']));
  assert.equal(code, 0);
  assert.equal(out, '1.5 MB');
});

test('cli parse', () => {
  const { out } = capture(() => run(['parse', '1.5 KiB']));
  assert.equal(out, '1536');
});

test('cli compact zh', () => {
  const { out } = capture(() => run(['compact', '1500000', '--style', 'zh']));
  assert.equal(out, '150万');
});

test('cli ordinal zh', () => {
  const { out } = capture(() => run(['ordinal', '22', '--lang', 'zh']));
  assert.equal(out, '第22');
});

test('cli --version', () => {
  const { out } = capture(() => run(['--version']));
  assert.equal(out, '0.1.0');
});

test('cli: invalid input exits 1', () => {
  const { code, out } = capture(() => run(['bytes', 'bad']));
  assert.equal(code, 1);
  assert.match(out, /quanty:/);
});

test('cli: unknown command exits 2', () => {
  const { code } = capture(() => run(['bogus', '1']));
  assert.equal(code, 2);
});
