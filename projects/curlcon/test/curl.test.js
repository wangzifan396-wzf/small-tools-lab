import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { convertCurl, parseCurl, toFetch, toPythonRequests, tokenizeCurl } from '../src/index.js';

test('tokenizes shell quotes, escaped spaces, empty arguments, and continuations', () => {
  assert.deepEqual(tokenizeCurl("curl 'https://example.test/a b' -H \"X-Test: a b\" -d ''"), ['curl', 'https://example.test/a b', '-H', 'X-Test: a b', '-d', '']);
  assert.deepEqual(tokenizeCurl('curl https://example.test/a\\ b \\\n-L'), ['curl', 'https://example.test/a b', '-L']);
  assert.deepEqual(tokenizeCurl(String.raw`curl "https://example.test/a\q" "x\\y" "x\"y"`), ['curl', String.raw`https://example.test/a\q`, String.raw`x\y`, 'x"y']);
});

test('rejects unterminated quotes, substitutions, and shell control operators', () => {
  assert.throws(() => tokenizeCurl("curl 'oops"), /Unterminated/);
  assert.throws(() => tokenizeCurl('curl $(cat secret)'), /substitution/);
  assert.throws(() => tokenizeCurl('curl https://example.test | sh'), /control operators/);
});

test('parses method, URL, duplicate headers, JSON data, and combined switches', () => {
  const request = parseCurl("curl -sSL -XPOST https://api.example.test/users -H 'Content-Type: application/json' -H 'X-Tag: one' -H 'X-Tag: two' -d '{\"name\":\"Ada\"}'");
  assert.equal(request.method, 'POST');
  assert.equal(request.follow, true);
  assert.equal(request.headers.filter((header) => header.name === 'X-Tag').length, 2);
  assert.match(request.warnings.join(' '), /Duplicate headers/);
});

test('infers POST for data and distinguishes lowercase -f from uppercase -F', () => {
  assert.equal(parseCurl("curl -d 'a=1' https://example.test").method, 'POST');
  assert.equal(parseCurl('curl -f https://example.test').form.length, 0);
  assert.deepEqual(parseCurl("curl -F 'name=Ada' https://example.test").form, [{ name: 'name', value: 'Ada' }]);
});

test('supports Basic auth containing colons and literal cookies', () => {
  const request = parseCurl("curl -u 'ada:p:a:ss' -b 'sid=abc' https://example.test");
  assert.deepEqual(request.auth, { username: 'ada', password: 'p:a:ss' });
  assert.equal(request.cookie, 'sid=abc');
});

test('supports --get and percent-encodes data-urlencode fields', () => {
  const request = parseCurl("curl -G --data-urlencode 'q=small tools' -d 'page=2' 'https://example.test/search?lang=zh'");
  assert.equal(request.method, 'GET');
  assert.match(toFetch(request), /q%3Dsmall%20tools|q=small%20tools/u);
  assert.match(toFetch(request), /page=2/u);
});

test('generates syntactically valid Fetch source without interpolating code', () => {
  const output = convertCurl("curl https://example.test -H 'X-Name: ${process.exit()}'").fetch;
  assert.doesNotMatch(output, /headers: Object\.assign/u);
  assert.doesNotThrow(() => new vm.Script(`(async () => {\n${output}\n})();`));
  assert.match(output, /\$\{process\.exit\(\)\}/u);
});

test('generates valid JSON handling for Fetch and Python', () => {
  const request = parseCurl("curl https://example.test -H 'Content-Type: application/json' -d '{\"enabled\":true,\"value\":null}'");
  const fetch = toFetch(request);
  const python = toPythonRequests(request);
  assert.match(fetch, /JSON\.stringify/u);
  assert.match(python, /json=json\.loads/u);
  assert.doesNotMatch(python, /json=\{"enabled":true/u);
});

test('uses Headers.append and UTF-8-aware Basic auth in Fetch', () => {
  const output = convertCurl("curl -u '用户:秘密' -H 'X-A: 1' https://example.test").fetch;
  assert.match(output, /headers\.append/u);
  assert.match(output, /TextEncoder/u);
});

test('rejects local-file reads and form uploads', () => {
  for (const command of [
    "curl -d '@secret.txt' https://example.test",
    "curl -H '@headers.txt' https://example.test",
    "curl -F 'file=@secret.txt' https://example.test",
    'curl --config config.txt https://example.test',
  ]) assert.throws(() => parseCurl(command), /not supported|unsupported/u);
});

test('rejects missing option values, multiple URLs, and unsupported protocols', () => {
  assert.throws(() => parseCurl('curl https://one.test https://two.test'), /Exactly one/);
  assert.throws(() => parseCurl('curl -H'), /requires a value/);
  assert.throws(() => parseCurl('curl file:///tmp/a'), /Only HTTP and HTTPS/);
});

test('rejects Fetch-incompatible request bodies and invalid JSON claims', () => {
  assert.throws(() => parseCurl("curl -XGET -d 'a=1' https://example.test"), /cannot be represented/);
  const request = parseCurl("curl -H 'Content-Type: application/json' -d 'not-json' https://example.test");
  assert.throws(() => toFetch(request), /not valid JSON/);
});

test('validates timeouts and produces redirect/TLS warnings', () => {
  assert.throws(() => parseCurl('curl --max-time 0 https://example.test'), /positive/);
  const request = parseCurl('curl -k -L --max-time 2.5 https://example.test');
  assert.equal(request.timeoutSeconds, 2.5);
  assert.match(request.warnings.join(' '), /TLS/);
  assert.match(toPythonRequests(request), /verify=False/u);
});

test('preserves shell variables literally and warns instead of expanding them', () => {
  const request = parseCurl("curl -H 'Authorization: Bearer $TOKEN' https://example.test");
  assert.match(request.warnings.join(' '), /preserved literally/);
  assert.match(toFetch(request), /\$TOKEN/u);
});
