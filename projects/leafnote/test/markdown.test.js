import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, extractTags, extractWikilinks } from '../src/markdown.js';

test('headings', () => {
  assert.match(renderMarkdown('# Title'), /<h1>Title<\/h1>/);
  assert.match(renderMarkdown('### Sub'), /<h3>Sub<\/h3>/);
});

test('bold / italic / strike', () => {
  assert.match(renderMarkdown('**b**'), /<strong>b<\/strong>/);
  assert.match(renderMarkdown('*i*'), /<em>i<\/em>/);
  assert.match(renderMarkdown('~~x~~'), /<del>x<\/del>/);
});

test('inline code is escaped and protected', () => {
  const html = renderMarkdown('use `<b>` here');
  assert.match(html, /<code>&lt;b&gt;<\/code>/);
  assert.doesNotMatch(html, /<b>/);
});

test('fenced code block', () => {
  const html = renderMarkdown('```js\nconst a = 1;\n```');
  assert.match(html, /<pre class="code" data-lang="js"><code>const a = 1;<\/code><\/pre>/);
});

test('links: safe scheme kept, javascript: neutralized', () => {
  assert.match(renderMarkdown('[ok](https://x.com)'), /href="https:\/\/x.com"/);
  const bad = renderMarkdown('[x](javascript:alert(1))');
  assert.doesNotMatch(bad, /javascript:alert/);
  assert.match(bad, /href="#"/);
});

test('wiki-links render as anchors with data-note', () => {
  const html = renderMarkdown('see [[My Note]]');
  assert.match(html, /<a class="wikilink" data-note="My Note" href="#note:My%20Note">My Note<\/a>/);
});

test('wiki-links with alias', () => {
  const html = renderMarkdown('[[Real Title|displayed]]');
  assert.match(html, /data-note="Real Title"/);
  assert.match(html, />displayed<\/a>/);
});

test('tags: rendered, but hex colors and headings are not', () => {
  const html = renderMarkdown('a #project note with #fff color');
  assert.match(html, /<span class="tag" data-tag="project">#project<\/span>/);
  assert.doesNotMatch(html, /class="tag" data-tag="fff"/);
  const heading = renderMarkdown('# Heading');
  assert.doesNotMatch(heading, /class="tag"/);
});

test('lists: unordered, ordered, task', () => {
  assert.match(renderMarkdown('- a\n- b'), /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(renderMarkdown('1. a\n2. b'), /<ol><li>a<\/li><li>b<\/li><\/ol>/);
  const task = renderMarkdown('- [x] done\n- [ ] todo');
  assert.match(task, /type="checkbox" disabled checked/);
  assert.match(task, /type="checkbox" disabled>/); // unchecked has no "checked"
});

test('blockquote', () => {
  assert.match(renderMarkdown('> quoted'), /<blockquote><p>quoted<\/p><\/blockquote>/);
});

test('horizontal rule', () => {
  assert.match(renderMarkdown('---'), /<hr>/);
});

test('table', () => {
  const html = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |');
  assert.match(html, /<table><thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/);
});

test('paragraph + XSS escaping', () => {
  const html = renderMarkdown('hello <script>');
  assert.match(html, /<p>hello &lt;script&gt;<\/p>/);
});

test('extractTags', () => {
  const tags = extractTags('work on #project and #ideas not #fff');
  assert.deepEqual(tags.sort(), ['ideas', 'project']);
});

test('extractWikilinks', () => {
  const links = extractWikilinks('[[A]] and [[B|alias]]');
  assert.deepEqual(links, ['A', 'B']);
});
