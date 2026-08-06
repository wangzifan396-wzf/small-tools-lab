import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify, toCase, normalizeUnicode, removeDiacritics,
  width, toFullWidth, toHalfWidth, cleanWhitespace
} from '../src/core/forge.js';
import { run } from '../src/cli.js';

describe('slugify', () => {
  test('lowercases and separates words', () => {
    assert.equal(slugify('Hello World'), 'hello-world');
  });
  test('keeps CJK, replaces spaces', () => {
    assert.equal(slugify('你好 World 世界'), '你好-world-世界');
  });
  test('collapses repeats and trims separators', () => {
    assert.equal(slugify('  Hello ___ World!!  '), 'hello-world');
  });
  test('custom separator', () => {
    assert.equal(slugify('Hello World', { sep: '_' }), 'hello_world');
  });
  test('respects lower:false', () => {
    assert.equal(slugify('Hello World', { lower: false }), 'Hello-World');
  });
});

describe('toCase', () => {
  test('camel', () => {
    assert.equal(toCase('hello world', 'camel'), 'helloWorld');
    assert.equal(toCase('hello-world-test', 'camel'), 'helloWorldTest');
  });
  test('pascal', () => {
    assert.equal(toCase('hello world', 'pascal'), 'HelloWorld');
  });
  test('snake', () => {
    assert.equal(toCase('HelloWorld', 'snake'), 'hello_world');
  });
  test('kebab', () => {
    assert.equal(toCase('Hello World', 'kebab'), 'hello-world');
  });
  test('constant', () => {
    assert.equal(toCase('hello world', 'constant'), 'HELLO_WORLD');
  });
  test('title', () => {
    assert.equal(toCase('hello world', 'title'), 'Hello World');
  });
  test('lower / upper', () => {
    assert.equal(toCase('Hello', 'lower'), 'hello');
    assert.equal(toCase('Hello', 'upper'), 'HELLO');
  });
  test('sentence', () => {
    assert.equal(toCase('hello WORLD', 'sentence'), 'Hello world');
  });
  test('handles CJK in camel/pascal', () => {
    assert.equal(toCase('你好 world', 'camel'), '你好World');
  });
  test('throws on unknown mode', () => {
    assert.throws(() => toCase('x', 'bogus'), /未知大小写模式/);
  });
});

describe('unicode', () => {
  test('normalizeUnicode NFC/NFD differ but round-trip', () => {
    const s = 'é';
    const nfd = normalizeUnicode(s, 'NFD');
    assert.equal(normalizeUnicode(nfd, 'NFC'), s);
  });
  test('normalizeUnicode rejects bad form', () => {
    assert.throws(() => normalizeUnicode('x', 'NFZ'), /NFC/);
  });
  test('removeDiacritics strips accents', () => {
    assert.equal(removeDiacritics('café naïve résumé'), 'cafe naive resume');
  });
  test('removeDiacritics keeps CJK', () => {
    assert.equal(removeDiacritics('汉字'), '汉字');
  });
});

describe('width', () => {
  test('toFullWidth', () => {
    assert.equal(toFullWidth('ABC 123'), 'ＡＢＣ　１２３');
  });
  test('toHalfWidth', () => {
    assert.equal(toHalfWidth('ＡＢＣ　１２３'), 'ABC 123');
  });
  test('full/half round-trip', () => {
    assert.equal(toHalfWidth(toFullWidth('Hi! 42')), 'Hi! 42');
  });
  test('width throws on bad direction', () => {
    assert.throws(() => width('x', 'sideways'), /full.*half/);
  });
});

describe('cleanWhitespace', () => {
  test('collapses and trims', () => {
    assert.equal(cleanWhitespace('  a   b\n\tc  '), 'a b c');
  });
  test('collapse:false keeps runs', () => {
    assert.equal(cleanWhitespace('a   b', { collapse: false }), 'a   b');
  });
  test('trim:false keeps outer space (with collapse off)', () => {
    assert.equal(cleanWhitespace('  a   b  ', { collapse: false, trim: false }), '  a   b  ');
  });
});

describe('cli run', () => {
  test('slugify via cli', () => {
    const r = run(['slugify', 'Hello 世界 World!']);
    assert.equal(r.code, 0);
    assert.equal(r.out, 'hello-世界-world');
  });
  test('case:kebab via cli', () => {
    const r = run(['case:kebab', 'HelloWorld Test']);
    assert.equal(r.out, 'hello-world-test');
  });
  test('width:full via cli', () => {
    const r = run(['width:full', 'ABC']);
    assert.equal(r.out, 'ＡＢＣ');
  });
  test('unicode:NFD via cli', () => {
    const r = run(['unicode:NFD', 'é']);
    assert.notEqual(r.out, 'é'); // decomposed form differs
  });
  test('nodiacritics via cli', () => {
    const r = run(['nodiacritics', 'café']);
    assert.equal(r.out, 'cafe');
  });
  test('clean via cli', () => {
    const r = run(['clean', '  a   b  ']);
    assert.equal(r.out, 'a b');
  });
  test('missing args prints usage (exit 1)', () => {
    const r = run([]);
    assert.equal(r.code, 1);
    assert.ok(r.out.includes('用法'));
  });
  test('unknown mode prints usage (exit 1)', () => {
    const r = run(['bogus', 'x']);
    assert.equal(r.code, 1);
    assert.ok(r.out.includes('可用 mode'));
  });
});
