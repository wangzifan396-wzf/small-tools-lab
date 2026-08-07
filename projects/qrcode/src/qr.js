// Standalone QR Code (byte mode) encoder — to be inlined into projects/qrcode/index.html.
// Supports versions 1-10, EC levels L/M/Q/H, UTF-8 byte mode. Pure JS, no deps.
(function (root) {
  // ---- Galois Field GF(256), primitive polynomial 0x11d ----
  const EXP = new Array(256), LOG = new Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    EXP[255] = EXP[0];
  })();
  function gexp(n) { while (n < 0) n += 255; while (n >= 255) n -= 255; return EXP[n]; }
  function glog(n) { if (n < 1) throw new Error('glog(' + n + ')'); return LOG[n]; }
  function gmul(a, b) { if (a === 0 || b === 0) return 0; return EXP[(LOG[a] + LOG[b]) % 255]; }

  // ---- Reed-Solomon generator + remainder ----
  function rsPoly(ecLen) {
    let poly = [1];
    for (let i = 0; i < ecLen; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) { next[j] ^= gmul(poly[j], 1); next[j + 1] ^= gmul(poly[j], gexp(i)); }
      poly = next;
    }
    return poly;
  }
  // Reed-Solomon ECC: remainder of (data * x^ecLen) mod gen  -> ecLen EC codewords.
  // Standard synthetic division: append ecLen zero coefficients, eliminate each
  // message coefficient from high degree down, remainder = last ecLen symbols.
  function rsEncode(data, ecLen) {
    const gen = rsPoly(ecLen);
    const res = data.concat(new Array(ecLen).fill(0)); // length = data.length + ecLen
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) { for (let j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], coef); }
    }
    return res.slice(data.length); // last ecLen symbols are the remainder
  }
  // true iff (data || ec) is a valid codeword: dividing whole codeword by gen
  // leaves a zero remainder (all syndromes zero). Independent cross-check of rsEncode.
  function rsIsValid(data, ec, ecLen) {
    const gen = rsPoly(ecLen);
    const n = data.concat(ec);
    for (let i = 0; i < data.length; i++) {
      const coef = n[i];
      if (coef !== 0) { for (let j = 0; j < gen.length; j++) n[i + j] ^= gmul(gen[j], coef); }
    }
    return n.slice(-ecLen).every((v) => v === 0);
  }

  // ---- RS block table: RS_BLOCKS[version][ecIdx] = flat groups (count,total,data) ----
  const RS_BLOCKS = {
    1: [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9]],
    2: [[1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16]],
    3: [[1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13]],
    4: [[1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9]],
    5: [[1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12]],
    6: [[2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15]],
    7: [[2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14]],
    8: [[2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15]],
    9: [[2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13]],
    10: [[2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]],
  };
  const ALIGN = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  const REMAIN = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };
  const EC_IDX = { L: 0, M: 1, Q: 2, H: 3 };
  const EC_BITS = { 0: 1, 1: 0, 2: 3, 3: 2 }; // 2-bit EC indicator

  function parseGroups(flat) {
    const groups = [];
    for (let i = 0; i < flat.length; i += 3) groups.push({ count: flat[i], total: flat[i + 1], data: flat[i + 2] });
    return groups;
  }
  function capacity(ver, ecIdx) {
    const groups = parseGroups(RS_BLOCKS[ver][ecIdx]);
    let total = 0; for (const g of groups) total += g.count * g.data; return total;
  }
  function utf8(s) { return Array.from(new TextEncoder().encode(s)); }
  function bitsToBytes(bits) {
    const out = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; out.push(b); }
    return out;
  }
  function interleave(blocks) {
    const max = Math.max(...blocks.map((b) => b.length)); const out = [];
    for (let i = 0; i < max; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
    return out;
  }
  function maskFunc(m, r, c) {
    switch (m) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  }
  function bch15_5(data5) {
    let d = data5 << 10; const g = 0b10100110111;
    for (let i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= g << (i - 10);
    return (data5 << 10) | (d & 0x3ff);
  }
  function formatInfo(ecIdx, mask) { return bch15_5((EC_BITS[ecIdx] << 3) | mask) ^ 0b101010000010010; }
  function bch18_6(v) {
    let d = v << 12; const g = 0b1111100100101;
    for (let i = 17; i >= 12; i--) if ((d >> i) & 1) d ^= g << (i - 12);
    return (v << 12) | (d & 0xfff);
  }

  function buildMatrix(ver, ecIdx, codewordBits, maskPattern) {
    const size = 17 + 4 * ver;
    const mod = Array.from({ length: size }, () => new Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (r, c, v) => { if (r < 0 || c < 0 || r >= size || c >= size) return; mod[r][c] = v; reserved[r][c] = true; };
    function finder(r, c) {
      for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
        const rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        let dark = false;
        if (i >= 0 && i <= 6 && j >= 0 && j <= 6) { const dy = i, dx = j; dark = dy === 0 || dy === 6 || dx === 0 || dx === 6 || (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4); }
        set(rr, cc, dark);
      }
    }
    finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
    for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    set(4 * ver + 9, 8, true); // dark module
    if (ALIGN[ver]) {
      const pts = []; for (const r of ALIGN[ver]) for (const c of ALIGN[ver]) pts.push([r, c]);
      const corners = [[6, 6], [6, size - 7], [size - 7, 6]];
      for (const [r, c] of pts) {
        if (corners.some(([cr, cc]) => cr === r && cc === c)) continue;
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(r + i, c + j, Math.max(Math.abs(i), Math.abs(j)) !== 1);
      }
    }
    // reserve format areas
    for (let i = 0; i < 9; i++) { reserved[8][i] = true; reserved[i][8] = true; }
    reserved[8][size - 8] = true; reserved[size - 8][8] = true;
    for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }
    if (ver >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { reserved[size - 11 + j][i] = true; reserved[i][size - 11 + j] = true; }
    // place data bits (zigzag)
    let bitPos = 0; let col = size - 1; let up = true;
    while (col > 0) {
      if (col === 6) col--;
      for (let i = 0; i < size; i++) {
        const row = up ? size - 1 - i : i;
        for (let k = 0; k < 2; k++) {
          const cc = col - k;
          if (!reserved[row][cc]) { mod[row][cc] = bitPos < codewordBits.length ? codewordBits[bitPos] === 1 : false; bitPos++; }
        }
      }
      col -= 2; up = !up;
    }
    // apply mask
    const mask = maskPattern || 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!reserved[r][c] && mod[r][c] !== null && maskFunc(mask, r, c)) mod[r][c] = !mod[r][c];
    // format info — placement follows the QR spec (and node-qrcode reference).
    const fmt = formatInfo(ecIdx, mask);
    const fm = (i) => ((fmt >> i) & 1) === 1;
    for (let i = 0; i < 15; i++) {
      const b = fm(i);
      // vertical arm on column 8
      if (i < 6) set(i, 8, b);
      else if (i < 8) set(i + 1, 8, b);
      else set(size - 15 + i, 8, b);
      // horizontal arm on row 8
      if (i < 8) set(8, size - 1 - i, b);
      else if (i < 9) set(8, 7, b);
      else set(8, 15 - i - 1, b);
    }
    if (ver >= 7) {
      const vinfo = bch18_6(ver);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
        const bit = ((vinfo >> (i * 3 + j)) & 1) === 1;
        set(i, size - 11 + j, bit);
        set(size - 11 + j, i, bit);
      }
    }
    return { size, mod };
  }

  // ---- main encode: returns {size, mod:boolean[][]} ----
  function genQR(text, ecLevel, maskPattern) {
    const ecIdx = EC_IDX[ecLevel] != null ? EC_IDX[ecLevel] : 1;
    const bytes = utf8(text);
    let ver = -1;
    for (let v = 1; v <= 10; v++) {
      const cap = capacity(v, ecIdx) * 8;
      const need = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
      if (need <= cap) { ver = v; break; }
    }
    if (ver < 0) throw new Error('内容过长，已超出版本 1-10 容量');
    const bits = [];
    const pb = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    pb(0b0100, 4);
    if (ver <= 9) pb(bytes.length, 8); else pb(bytes.length, 16);
    for (const b of bytes) pb(b, 8);
    const capBits = capacity(ver, ecIdx) * 8;
    for (let i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    let dataCW = bitsToBytes(bits);
    const totalData = capacity(ver, ecIdx);
    let pad = 0xec;
    while (dataCW.length < totalData) { dataCW.push(pad); pad = pad === 0xec ? 0x11 : 0xec; }
    const groups = parseGroups(RS_BLOCKS[ver][ecIdx]);
    const dataBlocks = [], ecBlocks = [];
    let pos = 0;
    for (const g of groups) for (let i = 0; i < g.count; i++) { const blk = dataCW.slice(pos, pos + g.data); pos += g.data; dataBlocks.push(blk); ecBlocks.push(rsEncode(blk, g.total - g.data)); }
    const finalCW = interleave(dataBlocks).concat(interleave(ecBlocks));
    const allBits = [];
    for (const b of finalCW) for (let i = 7; i >= 0; i--) allBits.push((b >> i) & 1);
    for (let i = 0; i < REMAIN[ver]; i++) allBits.push(0);
    return buildMatrix(ver, ecIdx, allBits, maskPattern || 0);
  }

  // ---- inverse (for round-trip self-test) ----
  function readBack(matrix) {
    const { size, mod } = matrix; const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (r, c) => { if (r < 0 || c < 0 || r >= size || c >= size) return; reserved[r][c] = true; };
    function finder(r, c) { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) set(r + i, c + j); }
    finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
    for (let i = 0; i < size; i++) { set(6, i); set(i, 6); }
    const ver = (size - 17) / 4;
    set(4 * ver + 9, 8);
    if (ALIGN[ver]) {
      const pts = []; for (const r of ALIGN[ver]) for (const c of ALIGN[ver]) pts.push([r, c]);
      const corners = [[6, 6], [6, size - 7], [size - 7, 6]];
      for (const [r, c] of pts) { if (corners.some(([cr, cc]) => cr === r && cc === c)) continue; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(r + i, c + j); }
    }
    // reserve format areas
    for (let i = 0; i < 9; i++) { reserved[8][i] = true; reserved[i][8] = true; }
    reserved[8][size - 8] = true; reserved[size - 8][8] = true;
    for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }
    if (ver >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { reserved[size - 11 + j][i] = true; reserved[i][size - 11 + j] = true; }
    const bits = [];
    let col = size - 1; let up = true;
    while (col > 0) { if (col === 6) col--; for (let i = 0; i < size; i++) { const row = up ? size - 1 - i : i; for (let k = 0; k < 2; k++) { const cc = col - k; if (!reserved[row][cc]) bits.push(((mod[row][cc] ? 1 : 0) ^ (maskFunc(0, row, cc) ? 1 : 0))); } } col -= 2; up = !up; }
    return bits;
  }

  root.QRCode = { genQR, rsEncode, rsIsValid, readBack, capacity, RS_BLOCKS, _gf: { EXP, LOG, gmul } };
})(typeof module !== 'undefined' && module.exports ? module.exports : (window = window || {}));
