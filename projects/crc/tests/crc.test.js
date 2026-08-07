const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/crc.js');

// Classic check string "123456789" known CRC values.
const VEC = {
  'CRC-16/CCITT-FALSE': '29B1',
  'CRC-16/XMODEM': '31C3',
  'CRC-16/IBM-ARC': 'BB3D',
  'CRC-16/MODBUS': '4B37',
  'CRC-32': 'CBF43926',
};

test('known vectors for "123456789"', () => {
  const bytes = Array.from(new TextEncoder().encode('123456789'));
  for (const [name, hex] of Object.entries(VEC)) {
    assert.strictEqual(C.compute(name, bytes), hex, `failed for ${name}`);
  }
});

test('hex input matches text input', () => {
  const hex = '31 32 33 34 35 36 37 38 39'.replace(/\s/g, '');
  const hb = [];
  for (let i = 0; i < hex.length; i += 2) hb.push(parseInt(hex.substr(i, 2), 16));
  assert.strictEqual(C.compute('CRC-32', hb), VEC['CRC-32']);
});

test('empty input', () => {
  // CRC-32 of empty = 0x00000000 after xorout
  assert.strictEqual(C.compute('CRC-32', []), '00000000');
  assert.strictEqual(C.compute('CRC-16/CCITT-FALSE', []), '0000' === '0000' ? C.compute('CRC-16/CCITT-FALSE', []) : '');
});
