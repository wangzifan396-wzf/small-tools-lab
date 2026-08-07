const test = require('node:test');
const assert = require('node:assert');
const { calc, parse, isValidIp } = require('../src/cidr.js');

test('calc /24', () => {
  var r = calc('192.168.1.10/24');
  assert.equal(r.network, '192.168.1.0');
  assert.equal(r.broadcast, '192.168.1.255');
  assert.equal(r.netmask, '255.255.255.0');
  assert.equal(r.wildcard, '0.0.0.255');
  assert.equal(r.firstHost, '192.168.1.1');
  assert.equal(r.lastHost, '192.168.1.254');
  assert.equal(r.totalAddresses, 256);
  assert.equal(r.hostCount, 254);
});

test('calc /30', () => {
  var r = calc('10.0.0.0/30');
  assert.equal(r.totalAddresses, 4);
  assert.equal(r.hostCount, 2);
  assert.equal(r.firstHost, '10.0.0.1');
  assert.equal(r.lastHost, '10.0.0.2');
  assert.equal(r.broadcast, '10.0.0.3');
});

test('calc /32 single host', () => {
  var r = calc('192.168.1.1/32');
  assert.equal(r.totalAddresses, 1);
  assert.equal(r.hostCount, 1);
  assert.equal(r.network, '192.168.1.1');
  assert.equal(r.firstHost, '192.168.1.1');
  assert.equal(r.lastHost, '192.168.1.1');
});

test('calc aligns to network boundary', () => {
  var r = calc('10.0.0.4/30');
  assert.equal(r.network, '10.0.0.4');
  assert.equal(r.broadcast, '10.0.0.7');
});

test('invalid input throws / returns null', () => {
  assert.throws(() => calc('not-an-ip/24'));
  assert.throws(() => calc('10.0.0.1/33'));
  assert.equal(parse('10.0.0.1'), null);
  assert.equal(isValidIp('999.1.1.1'), false);
  assert.equal(isValidIp('1.2.3.4'), true);
});
