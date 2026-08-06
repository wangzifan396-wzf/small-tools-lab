import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/core/strength.js';
import { run } from '../src/cli.js';

describe('analyze', () => {
  test('empty password is very weak', () => {
    const r = analyze('');
    assert.equal(r.score, 0);
    assert.equal(r.entropyBits, 0);
    assert.equal(r.flags.tooShort, true);
    assert.ok(r.suggestions.includes('请输入密码'));
  });

  test('common password flagged', () => {
    const r = analyze('password');
    assert.equal(r.flags.hasCommonPattern, true);
    assert.equal(r.score, 0);
    assert.equal(r.crackEstimate, '~instant');
  });

  test('reversed common password flagged', () => {
    const r = analyze('drowssap');
    assert.equal(r.flags.hasCommonPattern, true);
  });

  test('sequential run detected', () => {
    assert.equal(analyze('abcd1234').flags.hasSequential, true);
    assert.equal(analyze('aaa111').flags.hasSequential, true);
  });

  test('repeats detected', () => {
    assert.equal(analyze('aaa').flags.hasRepeats, true);
    assert.equal(analyze('ab').flags.hasRepeats, false);
  });

  test('strong mixed password scores high', () => {
    const r = analyze('Tr0ub4dour&9XY');
    assert.ok(r.score >= 3);
    assert.ok(r.entropyBits >= 60);
    assert.equal(r.flags.hasLower, true);
    assert.equal(r.flags.hasUpper, true);
    assert.equal(r.flags.hasDigit, true);
    assert.equal(r.flags.hasSymbol, true);
  });

  test('entropy uses combined pool', () => {
    // 4 lowercase letters => pool 26 => 4*log2(26) ≈ 18.8 (rounded to 1 decimal)
    const r = analyze('wxyz');
    assert.ok(Math.abs(r.entropyBits - 4 * Math.log2(26)) < 0.1);
  });

  test('score thresholds', () => {
    const low = analyze('aaaaaaa'); // 7 * log2(26) ≈ 32.9 => score 1
    assert.ok(low.score >= 0 && low.score <= 1);
  });

  test('crackEstimate is a string in known set', () => {
    const r = analyze('Tr0ub4dour&9XY');
    assert.ok(['~instant','~seconds','~minutes','~hours','~days','~years','~centuries'].includes(r.crackEstimate));
    assert.equal(r.crackEstimate, r.timeToCrack);
  });

  test('allSameClass for single class', () => {
    assert.equal(analyze('aaaaaaaa').flags.allSameClass, true);
    assert.equal(analyze('Aa1!aa').flags.allSameClass, false);
  });
});

describe('cli run', () => {
  test('prints score / entropy / suggestions', () => {
    const r = run(['Tr0ub4dour&9']);
    assert.equal(r.code, 0);
    assert.ok(r.out.includes('强度评分'));
    assert.ok(r.out.includes('熵'));
    assert.ok(r.out.includes('建议'));
  });
  test('missing args prints usage (exit 2)', () => {
    const r = run([]);
    assert.equal(r.code, 2);
    assert.ok(r.out.includes('用法'));
  });
  test('--help and --version use successful exit codes', () => {
    assert.equal(run(['--help']).code, 0);
    assert.deepEqual(run(['--version']), { code: 0, out: '1.0.0' });
  });
});
