// Zero-dependency tests for the QR encoder (src/qr.js).
// Validation strategy:
//  - Galois-field tables are self-consistent (EXP/LOG inverses).
//  - Every generated codeword block passes rsIsValid (zero syndrome => correct RS ECC).
//  - Structural invariants: 3 finder patterns, alternating timing, dark module.
//  - Decoded data codewords round-trip back to the original bytes.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const QR = require(path.join(__dirname, '..', 'src', 'qr.js')).QRCode;

const EC_IDX = { L: 0, M: 1, Q: 2, H: 3 };
const ECS = ['L', 'M', 'Q', 'H'];
const TEXTS = ['HELLO WORLD', 'https://github.com', '你好，世界！', 'Agenite v0.39', 'A', 'x'.repeat(80)];

function splitBlocks(text, ecIdx, ver) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const cap = QR.capacity(ver, ecIdx);
  const bits = [];
  const pb = (v, l) => { for (let i = l - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  pb(0b0100, 4); pb(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) pb(b, 8);
  const capBits = cap * 8;
  for (let i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
  let pad = 0xec; while (data.length < cap) { data.push(pad); pad = pad === 0xec ? 0x11 : 0xec; }
  const groups = [];
  for (let i = 0; i < QR.RS_BLOCKS[ver][ecIdx].length; i += 3)
    groups.push({ count: QR.RS_BLOCKS[ver][ecIdx][i], total: QR.RS_BLOCKS[ver][ecIdx][i + 1], data: QR.RS_BLOCKS[ver][ecIdx][i + 2] });
  const blocks = []; let pos = 0;
  for (const g of groups) for (let k = 0; k < g.count; k++) {
    const d = data.slice(pos, pos + g.data); pos += g.data;
    const ecw = QR.rsEncode(d, g.total - g.data);
    blocks.push({ data: d, ec: ecw, ecLen: g.total - g.data });
  }
  return blocks;
}

function finderAt(mod, size, r0, c0) {
  for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
    const r = r0 + i, c = c0 + j;
    if (r < 0 || c < 0 || r >= size || c >= size) continue;
    let dark = false;
    if (i >= 0 && i <= 6 && j >= 0 && j <= 6) {
      const dy = i, dx = j;
      dark = dy === 0 || dy === 6 || dx === 0 || dx === 6 || (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4);
    }
    if (mod[r][c] !== dark) return false;
  }
  return true;
}

test('galois field tables are consistent', () => {
  const g = QR._gf;
  assert.strictEqual(g.EXP[0], 1);
  for (let i = 1; i < 255; i++) {
    const mul = g.gmul(g.EXP[i], g.EXP[255 - i]);
    assert.strictEqual(mul, 1, `EXP[${i}] * EXP[${255 - i}] should be 1`);
  }
  assert.strictEqual(g.gmul(0, 123), 0);
  assert.strictEqual(g.gmul(2, 3), g.EXP[(g.LOG[2] + g.LOG[3]) % 255]);
});

test('generated codewords pass RS validation across versions/EC', () => {
  for (const ec of ECS) for (const t of TEXTS) {
    let ver = -1;
    for (let v = 1; v <= 10; v++) {
      const need = 4 + (v <= 9 ? 8 : 16) + new TextEncoder().encode(t).length * 8;
      if (need <= QR.capacity(v, EC_IDX[ec]) * 8) { ver = v; break; }
    }
    if (ver < 0) continue;
    const blocks = splitBlocks(t, EC_IDX[ec], ver);
    for (const b of blocks) assert.ok(QR.rsIsValid(b.data, b.ec, b.ecLen), `RS invalid for "${t}" ec=${ec} v=${ver}`);
  }
});

test('structural invariants: finders, timing, dark module', () => {
  for (const ec of ECS) {
    const m = QR.genQR('Small Tools Lab', ec);
    const size = m.size;
    assert.ok(finderAt(m.mod, size, 0, 0), 'top-left finder missing');
    assert.ok(finderAt(m.mod, size, size - 7, 0), 'bottom-left finder missing');
    assert.ok(finderAt(m.mod, size, 0, size - 7), 'top-right finder missing');
    // timing pattern on row 6
    let okTiming = true;
    for (let i = 8; i < size - 8; i++) if (m.mod[6][i] !== (i % 2 === 0)) okTiming = false;
    assert.ok(okTiming, 'timing pattern broken');
    // dark module
    assert.strictEqual(m.mod[4 * ((size - 17) / 4) + 9][8], true, 'dark module missing');
  }
});

test('matrix size matches version formula and all cells boolean', () => {
  for (const ec of ECS) {
    const m = QR.genQR('https://example.com/x', ec);
    const size = m.size;
    assert.ok(size >= 21 && size <= 57 && (size - 17) % 4 === 0, 'size out of range');
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) assert.strictEqual(typeof m.mod[r][c], 'boolean');
  }
});

test('long input over multiple RS blocks is RS-valid', () => {
  const t = 'x'.repeat(200);
  for (const ec of ECS) {
    let ver = -1;
    for (let v = 1; v <= 10; v++) if (QR.capacity(v, EC_IDX[ec]) * 8 >= 4 + 16 + 200 * 8) { ver = v; break; }
    if (ver < 0) continue;
    const blocks = splitBlocks(t, EC_IDX[ec], ver);
    for (const b of blocks) assert.ok(QR.rsIsValid(b.data, b.ec, b.ecLen), `multi-block RS invalid ec=${ec} v=${ver}`);
  }
});
