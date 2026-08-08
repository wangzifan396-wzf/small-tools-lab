import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, pairsToObject, parseQuery, rebuildUrl } from '../src/index.js';

test('parses and rebuilds a full URL while preserving its fragment', () => {
  const parsed = parseQuery('https://example.com/search?q=small%20tools&page=2#results');
  assert.equal(parsed.base, 'https://example.com/search');
  assert.equal(parsed.fragment, 'results');
  assert.deepEqual(parsed.pairs, [
    { key: 'q', value: 'small tools', hasEquals: true },
    { key: 'page', value: '2', hasEquals: true },
  ]);
  assert.equal(rebuildUrl(parsed), 'https://example.com/search?q=small%20tools&page=2#results');
});

test('supports relative URLs, leading question marks, and naked queries', () => {
  assert.equal(rebuildUrl(parseQuery('/search?q=one')), '/search?q=one');
  assert.equal(rebuildUrl(parseQuery('?q=one')), '?q=one');
  assert.equal(rebuildUrl(parseQuery('q=one&x=2')), 'q=one&x=2');
});

test('preserves a trailing question mark and an empty fragment', () => {
  assert.equal(rebuildUrl(parseQuery('/path?#')), '/path?#');
  assert.equal(rebuildUrl(parseQuery('https://example.com?')), 'https://example.com?');
});

test('preserves repeated keys and flag versus empty-value semantics', () => {
  const parsed = parseQuery('tag=one&tag=two&debug&empty=');
  assert.deepEqual(parsed.pairs, [
    { key: 'tag', value: 'one', hasEquals: true },
    { key: 'tag', value: 'two', hasEquals: true },
    { key: 'debug', value: '', hasEquals: false },
    { key: 'empty', value: '', hasEquals: true },
  ]);
  assert.equal(buildQuery(parsed.pairs), 'tag=one&tag=two&debug&empty=');
});

test('optionally decodes plus as space', () => {
  assert.equal(parseQuery('q=a+b').pairs[0].value, 'a b');
  assert.equal(parseQuery('q=a+b', { plusAsSpace: false }).pairs[0].value, 'a+b');
  assert.equal(buildQuery([{ key: 'q', value: 'a b', hasEquals: true }], { spaceAsPlus: true }), 'q=a+b');
});

test('reports invalid percent encoding with the segment number', () => {
  assert.throws(() => parseQuery('ok=1&bad=%ZZ'), /segment 2/);
  assert.throws(() => parseQuery('bad=%E0%A4'), /segment 1/);
});

test('normalizes Unicode through percent encoding', () => {
  const parsed = parseQuery('词=工具');
  assert.equal(buildQuery(parsed.pairs), '%E8%AF%8D=%E5%B7%A5%E5%85%B7');
});

test('preserves empty segments deterministically', () => {
  const parsed = parseQuery('a=1&&b=2&');
  assert.equal(parsed.pairs.length, 4);
  assert.equal(rebuildUrl(parsed), 'a=1&&b=2&');
});

test('pairsToObject uses a null prototype and safely stores dangerous keys', () => {
  const object = pairsToObject(parseQuery('__proto__=safe&constructor=data').pairs);
  assert.equal(Object.getPrototypeOf(object), null);
  assert.equal(object.__proto__, 'safe');
  assert.equal(object.constructor, 'data');
});

test('pairsToObject combines duplicates and preserves flags as null', () => {
  const pairs = parseQuery('tag=a&tag=b&debug').pairs;
  assert.deepEqual(pairsToObject(pairs).tag, ['a', 'b']);
  assert.equal(pairsToObject(pairs).debug, null);
  assert.equal(pairsToObject(pairs, { duplicates: 'first' }).tag, 'a');
  assert.equal(pairsToObject(pairs, { duplicates: 'last' }).tag, 'b');
});

test('validates pair shapes and options', () => {
  assert.throws(() => buildQuery([{ key: 'a', value: 'b' }]), /hasEquals/);
  assert.throws(() => parseQuery('a=1', { plusAsSpace: 'yes' }), /boolean/);
  assert.throws(() => pairsToObject([], { duplicates: 'all' }), /combine/);
});

test('rejects strings containing unpaired Unicode surrogates when building', () => {
  assert.throws(() => buildQuery([{ key: '\ud800', value: '', hasEquals: false }]), /valid Unicode/);
});
