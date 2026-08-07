import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEndpoint, parseLsofFields, parsePosixProcesses, parseSs, parseWindowsNetstat, parseWindowsProcesses } from '../src/core/parse.js';
import { buildAncestry, inspectPid, inspectPort, inspectSnapshot, redactCommand } from '../src/core/inspect.js';
import { renderReport } from '../src/core/render.js';
import { parseArgs, run } from '../src/cli.js';

const processes = [
  { pid: 10, ppid: 1, name: 'node', command: 'node server.js --token=secret', user: 'me', elapsed: '01:00' },
  { pid: 1, ppid: 0, name: 'init', command: '/sbin/init', user: 'root', elapsed: '1-00:00' },
];
const connections = [{ protocol: 'tcp', local: { address: '0.0.0.0', port: 3000 }, remote: null, state: 'listen', pid: 10 }];
const snapshot = { platform: 'test', connections, processes };

test('parseEndpoint handles IPv4, IPv6, and wildcards', () => {
  assert.deepEqual(parseEndpoint('127.0.0.1:3000'), { address: '127.0.0.1', port: 3000 });
  assert.deepEqual(parseEndpoint('[::]:443'), { address: '::', port: 443 });
  assert.deepEqual(parseEndpoint('*:80'), { address: '*', port: 80 });
});

test('parseWindowsNetstat extracts listening owners', () => {
  const output = '  TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234\r\n  UDP 0.0.0.0:53 *:* 5';
  assert.deepEqual(parseWindowsNetstat(output), [{ protocol: 'tcp', local: { address: '0.0.0.0', port: 3000 }, remote: { address: '0.0.0.0', port: 0 }, state: 'listening', pid: 1234 }]);
});

test('parseLsofFields groups process and endpoint fields', () => {
  const output = 'p123\ncnode\nf20\nnTCP *:3000 (LISTEN)\np456\ncpython\nnTCP 127.0.0.1:8000 (LISTEN)\n';
  assert.deepEqual(parseLsofFields(output).map((item) => [item.pid, item.command, item.local.port]), [[123, 'node', 3000], [456, 'python', 8000]]);
});

test('parseSs extracts PID and command', () => {
  const output = 'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:(("node",pid=1234,fd=20))';
  assert.deepEqual(parseSs(output)[0], { protocol: 'tcp', local: { address: '0.0.0.0', port: 3000 }, remote: null, state: 'listen', pid: 1234, command: 'node' });
});

test('process parsers normalize Windows and POSIX snapshots', () => {
  const windows = parseWindowsProcesses('{"ProcessId":10,"ParentProcessId":1,"Name":"node.exe","CommandLine":"node app.js"}');
  assert.equal(windows[0].ppid, 1);
  const posix = parsePosixProcesses('  10  1 alice  00:10 node server.js\n   1  0 root 1-00:00 /sbin/init');
  assert.deepEqual(posix.map((item) => item.name), ['node', 'init']);
});

test('redactCommand masks flags, URL credentials, and query secrets', () => {
  const redacted = redactCommand('run --token=abc https://user:pass@example.test/a?token=xyz');
  assert.doesNotMatch(redacted, /abc|user:pass|xyz/u);
  assert.match(redacted, /REDACTED/);
});

test('buildAncestry follows parents and stops cycles', () => {
  assert.deepEqual(buildAncestry(10, processes).map((item) => item.pid), [10, 1]);
  const cyclic = [{ pid: 1, ppid: 2, name: 'a', command: 'a' }, { pid: 2, ppid: 1, name: 'b', command: 'b' }];
  assert.deepEqual(buildAncestry(1, cyclic).map((item) => item.pid), [1, 2]);
});

test('inspectSnapshot reports owners, ancestry, and runtime hints', () => {
  const report = inspectSnapshot({ ...snapshot, target: 3000 });
  assert.equal(report.status, 'found');
  assert.equal(report.owners[0].hints.includes('javascript-runtime'), true);
  assert.match(report.owners[0].process.command, /REDACTED/);
});

test('inspectPort and inspectPid validate targets and accept injected snapshots', async () => {
  assert.equal((await inspectPort(3000, { snapshot })).owners.length, 1);
  assert.equal((await inspectPort(3001, { snapshot })).status, 'free');
  assert.equal((await inspectPid(10, { snapshot })).status, 'found');
  await assert.rejects(() => inspectPort(70000, { snapshot }), /65535/);
});

test('renderReport supports pretty, Markdown, and JSON', () => {
  const report = inspectSnapshot({ ...snapshot, target: 3000 });
  assert.match(renderReport(report, 'pretty'), /Port Origin/);
  assert.match(renderReport(report, 'markdown'), /# Port Origin/);
  assert.equal(JSON.parse(renderReport(report, 'json')).owners[0].process.pid, 10);
});

test('parseArgs validates mutually exclusive targets and formats', () => {
  assert.equal(parseArgs(['3000', '--format', 'json']).port, '3000');
  assert.equal(parseArgs(['--pid', '10']).pid, '10');
  assert.throws(() => parseArgs(['3000', '--pid', '10']), /either/);
  assert.throws(() => parseArgs(['3000', '--format', 'xml']), /format/);
});

test('CLI returns a finding gate without touching the real process table', async () => {
  let output = '';
  assert.equal(await run(['3001', '--format', 'json', '--fail-if-free'], { snapshot, stdout: (value) => { output += value; }, stderr: () => {} }), 1);
  assert.equal(JSON.parse(output).status, 'free');
});
