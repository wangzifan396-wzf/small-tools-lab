import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { explain, findMatches, highlight, escapeHtml } from '../src/core/regex.js';
import { run } from '../src/cli.js';

describe('explain', () => {
  test('parses anchors, class, quantifier, group', () => {
    const r = explain('^(\\d{3})-[a-z]+$');
    assert.equal(r.error, undefined);
    const kinds = r.tokens.map((t) => t.kind);
    assert.ok(kinds.includes('anchor'));
    assert.ok(kinds.includes('group'));
    assert.ok(kinds.includes('class'));
    assert.ok(kinds.includes('quantifier'));
  });
  test('explains escapes and backreference', () => {
    const r = explain('(abc)\\1');
    const refs = r.tokens.filter((t) => t.kind === 'backreference');
    assert.equal(refs.length, 1);
    assert.equal(refs[0].raw, '\\1');
  });
  test('explains named group + lazy quantifier', () => {
    const r = explain('(?<year>\\d{4})a+?');
    assert.ok(r.tokens.some((t) => t.raw === '(?<year>' && t.kind === 'group'));
    // 'a' is a literal; '+?' is the lazy quantifier token
    assert.ok(r.tokens.some((t) => t.raw === '+?' && t.kind === 'quantifier'));
  });
  test('returns error for invalid regex', () => {
    const r = explain('(');
    assert.ok(r.error);
  });
  test('explains alternation and non-capturing group', () => {
    const r = explain('(?:cat|dog)s?');
    assert.ok(r.tokens.some((t) => t.raw === '|' && t.kind === 'alternation'));
    assert.ok(r.tokens.some((t) => t.raw === '(?:' && t.kind === 'group'));
  });
});

describe('findMatches', () => {
  test('finds all global matches', () => {
    const r = findMatches('a1 b2 c3', '\\w\\d', 'g');
    assert.equal(r.matches.length, 3);
    assert.equal(r.matches[0].value, 'a1');
    assert.equal(r.matches[0].index, 0);
    assert.equal(r.matches[0].end, 2);
  });
  test('forces global internally (non-g flag)', () => {
    const r = findMatches('aa aa', 'aa');
    assert.equal(r.matches.length, 2);
  });
  test('captures named groups', () => {
    const r = findMatches('2024', '(?<y>\\d{4})');
    assert.deepEqual(r.namedGroups, ['y']);
  });
  test('caps runaway matches', () => {
    const r = findMatches('a'.repeat(1500), 'a');
    assert.equal(r.capped, true);
  });
  test('returns error for bad pattern', () => {
    const r = findMatches('x', '(');
    assert.ok(r.error);
  });
});

describe('highlight', () => {
  test('wraps matches in <mark> and escapes html', () => {
    const out = highlight('a<b>c', 'b');
    // surrounding '<' '>' are escaped; only the matched 'b' is wrapped
    assert.equal(out, 'a&lt;<mark>b</mark>&gt;c');
  });
  test('escapes dangerous input', () => {
    const out = highlight('<script>', '<script>');
    assert.ok(!out.includes('<script>')); // original tag must be escaped
    assert.ok(out.includes('&lt;script&gt;'));
  });
  test('no match returns escaped text', () => {
    assert.equal(highlight('hi', 'z'), 'hi');
  });
});

describe('escapeHtml', () => {
  test('escapes amp and quotes', () => {
    assert.equal(escapeHtml('a&b"c'), 'a&amp;b&quot;c');
  });
});

describe('cli run', () => {
  test('--explain prints token list', () => {
    const r = run(['--explain', '\\d+']);
    assert.equal(r.code, 0);
    assert.ok(r.out.includes('\\d'));
  });
  test('match mode prints count and highlights', () => {
    const r = run(['\\w+', 'hello world', 'g']);
    assert.equal(r.code, 0);
    assert.ok(r.out.includes('匹配数: 2'));
    assert.ok(r.out.includes('<mark>'));
  });
  test('missing args prints usage (exit 1)', () => {
    const r = run([]);
    assert.equal(r.code, 1);
    assert.ok(r.out.includes('用法'));
  });
  test('invalid pattern explains error (exit 1)', () => {
    const r = run(['--explain', '(']);
    assert.equal(r.code, 1);
    assert.ok(r.out.includes('正则解析错误'));
  });
});
