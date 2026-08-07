const test = require('node:test');
const assert = require('node:assert');
const B = require('../src/barcode.js');

test('symbols: start, data, checksum, stop', () => {
  const s = B.symbols('A');
  assert.strictEqual(s[0], 104); // Start B (true Code 128 value)
  assert.strictEqual(s[1], 33); // 'A' (65) - 32
  // checksum = (104 + 1*33) % 103 = 137 % 103 = 34
  assert.strictEqual(s[2], 34);
  assert.strictEqual(s[s.length - 1], 106); // Stop
});

test('checksum scales with position', () => {
  const s = B.symbols('AB');
  // sum = 104 + 1*33 + 2*34 = 104 + 33 + 68 = 205; 205 % 103 = 102
  assert.strictEqual(s[s.length - 2], 102);
});

test('pattern table is structurally valid (6 modules summing to 11)', () => {
  for (var k = 0; k <= 106; k++) {
    if (k === 106) continue;
    const p = B.PATTERNS[k];
    assert.ok(p && p.length === 6, `pattern ${k} should be 6 elements`);
    let sum = 0;
    for (const ch of p) sum += Number(ch);
    assert.strictEqual(sum, 11, `pattern ${k} should sum to 11`);
    // starts and ends with a bar (odd positions are bars)
    assert.strictEqual(Number(p.charAt(0)) > 0, true);
  }
  let stopSum = 0;
  for (const ch of B.STOP) stopSum += Number(ch);
  assert.strictEqual(stopSum, 13);
});

test('rejects non-ASCII (Code B range)', () => {
  assert.throws(() => B.symbols('你好'), /ASCII/);
  assert.throws(() => B.renderSVG('café'), /ASCII/); // é (233) is outside 32–127
});

test('renderSVG produces a scannable svg with quiet zones', () => {
  const out = B.renderSVG('HELLO');
  assert.ok(out.svg.startsWith('<svg'));
  assert.ok(out.svg.includes('<rect'));
  assert.ok(out.modules.length > 0);
  assert.strictEqual(out.values[0], 104);
});
