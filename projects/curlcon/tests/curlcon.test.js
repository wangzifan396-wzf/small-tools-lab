const test = require('node:test');
const assert = require('node:assert');
const { parse, convert, toJs, toPython } = require('../src/curlcon.js');

test('parses method, url, headers, data', () => {
  const r = parse("curl -X POST https://api.test/v1/users -H 'Content-Type: application/json' -d '{\"name\":\"bob\"}'");
  assert.strictEqual(r.method, 'POST');
  assert.strictEqual(r.url, 'https://api.test/v1/users');
  assert.strictEqual(r.headers['Content-Type'], 'application/json');
  assert.strictEqual(r.data, '{"name":"bob"}');
});

test('parses basic auth and cookie', () => {
  const r = parse("curl -u alice:secret -b 'sid=abc' https://x.test/");
  assert.strictEqual(r.user, 'alice:secret');
  assert.strictEqual(r.cookie, 'sid=abc');
});

test('default method GET when no -X', () => {
  const r = parse("curl https://example.com/ping");
  assert.strictEqual(r.method, 'GET');
  assert.strictEqual(r.url, 'https://example.com/ping');
});

test('detects JSON body for JS output', () => {
  const c = convert("curl -X POST https://x.test/a -d '{\"a\":1}'");
  assert.ok(c.js.includes('JSON.stringify('));
  assert.ok(c.js.includes("'Content-Type': 'application/json'"));
});

test('python output uses requests.request', () => {
  const c = convert("curl -X POST https://x.test/a -H 'X-Token: t' -d 'hi'");
  assert.ok(c.python.includes('import requests'));
  assert.ok(c.python.includes('requests.request('));
  assert.ok(c.python.includes('"X-Token": "t"'));
});
