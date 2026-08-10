import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCidr, contains, formatAddress, isValidAddress, overlaps, parseAddress, parseCidr, splitCidr } from '../src/index.js';

test('strictly parses and normalizes IPv4 addresses', () => {
  assert.equal(parseAddress('192.168.1.10').normalized, '192.168.1.10');
  for (const value of ['192.168.01.1', '256.0.0.1', '1.2.3', ' 1.2.3.4']) assert.equal(isValidAddress(value), false, value);
});

test('parses compressed IPv6 and applies RFC 5952-style formatting', () => {
  assert.equal(parseAddress('2001:0DB8:0000:0000:0000:FF00:0042:8329').normalized, '2001:db8::ff00:42:8329');
  assert.equal(parseAddress('0:0:0:0:0:0:0:0').normalized, '::');
  assert.equal(parseAddress('2001:db8:0:1:0:0:0:1').normalized, '2001:db8:0:1::1');
});

test('supports IPv4 tails inside IPv6 addresses', () => {
  assert.equal(parseAddress('::ffff:192.0.2.1').normalized, '::ffff:c000:201');
});

test('rejects malformed IPv6 and zone identifiers', () => {
  for (const value of ['1::2::3', '1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8:9', 'fe80::1%eth0']) assert.equal(isValidAddress(value), false, value);
});

test('formatAddress validates byte length against the version', () => {
  assert.throws(() => formatAddress({ version: 4, bytes: new Uint8Array(16) }), /byte length/);
});

test('calculates an IPv4 /24 network and host range', () => {
  const info = calculateCidr('192.168.1.10/24');
  assert.equal(info.cidr, '192.168.1.0/24');
  assert.equal(info.netmask, '255.255.255.0');
  assert.equal(info.wildcard, '0.0.0.255');
  assert.equal(info.broadcast, '192.168.1.255');
  assert.equal(info.firstHost, '192.168.1.1');
  assert.equal(info.lastHost, '192.168.1.254');
  assert.equal(info.totalAddresses, 256n);
  assert.equal(info.usableAddresses, 254n);
});

test('handles IPv4 /31 point-to-point and /32 host routes', () => {
  const point = calculateCidr('10.0.0.4/31');
  assert.equal(point.firstHost, '10.0.0.4');
  assert.equal(point.lastHost, '10.0.0.5');
  assert.equal(point.usableAddresses, 2n);
  const host = calculateCidr('10.0.0.4/32');
  assert.equal(host.network, '10.0.0.4');
  assert.equal(host.usableAddresses, 1n);
});

test('calculates IPv4 /0 without signed integer overflow', () => {
  const info = calculateCidr('203.0.113.10/0');
  assert.equal(info.network, '0.0.0.0');
  assert.equal(info.broadcast, '255.255.255.255');
  assert.equal(info.totalAddresses, 4_294_967_296n);
});

test('calculates IPv6 /64 exactly with BigInt counts', () => {
  const info = calculateCidr('2001:db8:abcd:12::1/64');
  assert.equal(info.cidr, '2001:db8:abcd:12::/64');
  assert.equal(info.lastAddress, '2001:db8:abcd:12:ffff:ffff:ffff:ffff');
  assert.equal(info.broadcast, null);
  assert.equal(info.wildcard, null);
  assert.equal(info.totalAddresses, 1n << 64n);
});

test('validates CIDR syntax and version-specific prefix bounds', () => {
  assert.throws(() => parseCidr('10.0.0.1'), /address\/prefix/);
  assert.throws(() => parseCidr('10.0.0.1/33'), /between 0 and 32/);
  assert.throws(() => parseCidr('::1/129'), /between 0 and 128/);
  assert.throws(() => parseCidr('10.0.0.1/01'), /unsigned decimal/);
});

test('tests address and subnet containment across both versions', () => {
  assert.equal(contains('10.0.0.0/8', '10.9.8.7'), true);
  assert.equal(contains('10.0.0.0/8', '11.0.0.1'), false);
  assert.equal(contains('10.0.0.0/8', '10.1.0.0/16'), true);
  assert.equal(contains('10.0.0.0/8', '10.0.0.0/7'), false);
  assert.equal(contains('2001:db8::/32', '2001:db8:1::1'), true);
  assert.equal(contains('2001:db8::/32', '10.0.0.1'), false);
});

test('detects overlap and keeps address families separate', () => {
  assert.equal(overlaps('192.168.1.0/24', '192.168.1.128/25'), true);
  assert.equal(overlaps('192.168.1.0/25', '192.168.1.128/25'), false);
  assert.equal(overlaps('0.0.0.0/0', '::/0'), false);
});

test('splits IPv4 and IPv6 networks deterministically', () => {
  assert.deepEqual(splitCidr('192.168.0.0/24', 26), ['192.168.0.0/26', '192.168.0.64/26', '192.168.0.128/26', '192.168.0.192/26']);
  assert.deepEqual(splitCidr('2001:db8::/126', 127), ['2001:db8::/127', '2001:db8::2/127']);
});

test('splitCidr validates direction and caps memory growth', () => {
  assert.throws(() => splitCidr('10.0.0.0/8', 7), /between 8 and 32/);
  assert.throws(() => splitCidr('10.0.0.0/8', 25), /65536/);
});
