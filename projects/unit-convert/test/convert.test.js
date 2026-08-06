import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  convert, convertWithUnit, formatNumber, categoryOf, findUnit,
  listCategories, unitsInCategory
} from '../src/core/convert.js';
import { run } from '../src/cli.js';

describe('convert core', () => {
  test('length: km -> mi', () => {
    assert.ok(Math.abs(convert(100, 'km', 'mi') - 62.1371192237334) < 1e-9);
  });
  test('length: in -> cm', () => {
    assert.ok(Math.abs(convert(10, 'in', 'cm') - 25.4) < 1e-9);
  });
  test('mass: lb -> kg', () => {
    assert.ok(Math.abs(convert(1, 'lb', 'kg') - 0.45359237) < 1e-9);
  });
  test('data: MB -> MiB (decimal vs binary)', () => {
    assert.ok(Math.abs(convert(1, 'MB', 'MiB') - 0.95367431640625) < 1e-9);
  });
  test('temperature: C -> F', () => {
    assert.ok(Math.abs(convert(0, 'C', 'F') - 32) < 1e-9);
    assert.ok(Math.abs(convert(100, 'C', 'F') - 212) < 1e-9);
  });
  test('temperature: F -> K', () => {
    assert.ok(Math.abs(convert(32, 'F', 'K') - 273.15) < 1e-9);
  });
  test('same-unit returns identity', () => {
    assert.equal(convert(5, 'm', 'm'), 5);
  });
  test('rejects mismatched categories', () => {
    assert.throws(() => convert(1, 'km', 'kg'), /不属于同一类别/);
  });
  test('rejects unknown unit', () => {
    assert.throws(() => convert(1, 'furlong', 'm'), /未知单位/);
  });
  test('categoryOf / findUnit', () => {
    assert.equal(categoryOf('km'), 'length');
    assert.equal(categoryOf('nope'), null);
    assert.deepEqual(findUnit('lb'), { category: 'mass', symbol: 'lb' });
    assert.deepEqual(findUnit('  km  '), { category: 'length', symbol: 'km' });
  });
  test('listCategories / unitsInCategory', () => {
    assert.ok(listCategories().includes('temperature'));
    assert.ok(unitsInCategory('length').includes('mi'));
  });
  test('formatNumber trims trailing zeros', () => {
    assert.equal(formatNumber(62.1371192237334), '62.13711922' || formatNumber(62.1371192237334));
    assert.equal(formatNumber(0), '0');
  });
  test('convertWithUnit returns formatted string', () => {
    const r = convertWithUnit(100, 'km', 'mi');
    assert.equal(r.unit, 'mi');
    assert.ok(r.formatted.startsWith(formatNumber(r.value)));
  });
  test('rejects non-finite numeric input', () => {
    assert.throws(() => convert('not-a-number', 'm', 'km'), /数值无效/);
  });
});

describe('cli run', () => {
  test('convert prints value + unit', () => {
    const r = run(['100', 'km', 'mi']);
    assert.equal(r.code, 0);
    assert.ok(r.out.endsWith('mi'));
    assert.ok(r.out.startsWith('62.13711922'));
  });
  test('--list lists categories', () => {
    const r = run(['--list']);
    assert.equal(r.code, 0);
    assert.ok(r.out.includes('length'));
    assert.ok(r.out.includes('temperature'));
  });
  test('--cat length lists units', () => {
    const r = run(['--cat', 'length']);
    assert.equal(r.code, 0);
    assert.ok(r.out.includes('km'));
  });
  test('missing args prints usage (exit 2)', () => {
    const r = run(['100', 'km']);
    assert.equal(r.code, 2);
    assert.ok(r.out.includes('用法'));
  });
  test('unknown unit prints hint (exit 1)', () => {
    const r = run(['1', 'furlong', 'm']);
    assert.equal(r.code, 1);
    assert.ok(r.out.includes('长度') || r.out.includes('length'));
  });
  test('--help and --version use successful exit codes', () => {
    assert.deepEqual(run(['--version']), { code: 0, out: '1.0.0' });
    const help = run(['--help']);
    assert.equal(help.code, 0);
    assert.ok(help.out.includes('unit-convert'));
  });
  test('extra positional arguments are usage errors', () => {
    assert.equal(run(['1', 'm', 'km', 'extra']).code, 2);
  });
});
