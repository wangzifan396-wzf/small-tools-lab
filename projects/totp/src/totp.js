/*
 * totp — zero-dependency RFC 6238 TOTP generator.
 *
 * Implements SHA-1 / SHA-256 / SHA-512 and HMAC purely in JavaScript so the
 * tool runs unchanged from a file:// page (no Web Crypto, no modules). Secrets
 * may be RFC 4648 Base32 (authenticator apps), hex, or raw text.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Totp = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- low-level helpers ---------------- */

  function rotl32(x, n) { return ((x << n) | (x >>> (32 - n))) >>> 0; }
  function rotr32(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

  function utf8ToBytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else if (c < 0xd800 || c >= 0xe000) { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
      else {
        i++;
        var cp = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      }
    }
    return new Uint8Array(out);
  }

  function hexToBytes(hex) {
    var s = hex.replace(/[^0-9a-fA-F]/g, "");
    var out = new Uint8Array(s.length >> 1);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  function bytesToHex(bytes) {
    var h = "0123456789abcdef", out = "";
    for (var i = 0; i < bytes.length; i++) out += h[bytes[i] >> 4] + h[bytes[i] & 15];
    return out;
  }

  // RFC 4648 Base32 decode (authenticator secret alphabet A-Z, 2-7).
  function base32Decode(str) {
    var alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    var s = String(str).toUpperCase().replace(/[\s=]/g, "");
    var bits = 0, value = 0, out = [];
    for (var i = 0; i < s.length; i++) {
      var idx = alpha.indexOf(s.charAt(i));
      if (idx < 0) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        out.push((value >>> bits) & 0xff);
      }
    }
    return new Uint8Array(out);
  }

  // Resolve a user-supplied secret into raw key bytes.
  function decodeSecret(secret) {
    var s = String(secret).trim();
    if (!s) return new Uint8Array(0);
    // Treat as hex only when it actually contains hex letters (avoids misreading
    // pure-digit ASCII secrets such as the RFC 6238 test vectors as hex).
    if (/^[0-9a-fA-F]+$/.test(s) && /[a-fA-F]/.test(s) && s.length % 2 === 0) return hexToBytes(s);
    if (/^[A-Za-z2-7=]+$/.test(s)) return base32Decode(s);
    return utf8ToBytes(s);
  }

  function concatBytes(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  /* ---------------- SHA-1 ---------------- */

  function sha1(bytes) {
    var w = new Array(80);
    var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    var ml = bytes.length * 8;
    var msg = padBlocks(bytes, 64, ml, 8);
    for (var i = 0; i < msg.length; i += 64) {
      for (var t = 0; t < 16; t++) {
        w[t] = (msg[i + 4 * t] << 24) | (msg[i + 4 * t + 1] << 16) | (msg[i + 4 * t + 2] << 8) | msg[i + 4 * t + 3];
      }
      for (var t2 = 16; t2 < 80; t2++) w[t2] = rotl32(w[t2 - 3] ^ w[t2 - 8] ^ w[t2 - 14] ^ w[t2 - 16], 1);
      var a = h0, b = h1, c = h2, d = h3, e = h4;
      for (var k = 0; k < 80; k++) {
        var f, g;
        if (k < 20) { f = (b & c) | (~b & d); g = 0x5a827999; }
        else if (k < 40) { f = b ^ c ^ d; g = 0x6ed9eba1; }
        else if (k < 60) { f = (b & c) | (b & d) | (c & d); g = 0x8f1bbcdc; }
        else { f = b ^ c ^ d; g = 0xca62c1d6; }
        var tmp = (rotl32(a, 5) + f + e + g + w[k]) >>> 0;
        e = d; d = c; c = rotl32(b, 30); b = a; a = tmp;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    return wordsToBytes([h0, h1, h2, h3, h4]);
  }

  /* ---------------- SHA-256 ---------------- */

  var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function sha256(bytes) {
    var w = new Array(64);
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var ml = bytes.length * 8;
    var msg = padBlocks(bytes, 64, ml, 8);
    for (var i = 0; i < msg.length; i += 64) {
      for (var t = 0; t < 16; t++) {
        w[t] = (msg[i + 4 * t] << 24) | (msg[i + 4 * t + 1] << 16) | (msg[i + 4 * t + 2] << 8) | msg[i + 4 * t + 3];
      }
      for (var t2 = 16; t2 < 64; t2++) {
        var s0 = rotr32(w[t2 - 15], 7) ^ rotr32(w[t2 - 15], 18) ^ (w[t2 - 15] >>> 3);
        var s1 = rotr32(w[t2 - 2], 17) ^ rotr32(w[t2 - 2], 19) ^ (w[t2 - 2] >>> 10);
        w[t2] = (w[t2 - 16] + s0 + w[t2 - 7] + s1) >>> 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (var k = 0; k < 64; k++) {
        var S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + S1 + ch + K256[k] + w[k]) >>> 0;
        var S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return wordsToBytes(h);
  }

  /* ---------------- SHA-512 ---------------- */

  var K512 = [
    0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
    0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
    0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
    0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
    0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
    0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
    0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
    0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
    0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
    0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
    0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
    0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
    0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
    0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
    0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
    0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
    0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
    0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
    0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
    0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n
  ];
  var MASK64 = 0xffffffffffffffffn;

  function rotr64(x, n) { return ((x >> BigInt(n)) | (x << BigInt(64 - n))) & MASK64; }

  function sha512(bytes) {
    var h = [
      0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
      0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
    ];
    var msg = padBlocks(bytes, 128, bytes.length * 8, 16);
    var w = new Array(80);
    for (var i = 0; i < msg.length; i += 128) {
      for (var t = 0; t < 16; t++) {
        var v = 0n;
        for (var j = 0; j < 8; j++) v = (v << 8n) | BigInt(msg[i + 8 * t + j]);
        w[t] = v;
      }
      for (var t2 = 16; t2 < 80; t2++) {
        var s0 = rotr64(w[t2 - 15], 1) ^ rotr64(w[t2 - 15], 8) ^ (w[t2 - 15] >> 7n);
        var s1 = rotr64(w[t2 - 2], 19) ^ rotr64(w[t2 - 2], 61) ^ (w[t2 - 2] >> 6n);
        w[t2] = (w[t2 - 16] + s0 + w[t2 - 7] + s1) & MASK64;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], kk = h[7];
      for (var r = 0; r < 80; r++) {
        var S1 = rotr64(e, 14) ^ rotr64(e, 18) ^ rotr64(e, 41);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (kk + S1 + ch + K512[r] + w[r]) & MASK64;
        var S0 = rotr64(a, 28) ^ rotr64(a, 34) ^ rotr64(a, 39);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) & MASK64;
        kk = g; g = f; f = e; e = (d + temp1) & MASK64; d = c; c = b; b = a; a = (temp1 + temp2) & MASK64;
      }
      h[0] = (h[0] + a) & MASK64; h[1] = (h[1] + b) & MASK64; h[2] = (h[2] + c) & MASK64;
      h[3] = (h[3] + d) & MASK64; h[4] = (h[4] + e) & MASK64; h[5] = (h[5] + f) & MASK64;
      h[6] = (h[6] + g) & MASK64; h[7] = (h[7] + kk) & MASK64;
    }
    var out = new Uint8Array(64);
    for (var n = 0; n < 8; n++) {
      var val = h[n];
      for (var m = 7; m >= 0; m--) { out[n * 8 + m] = Number(val & 0xffn); val >>= 8n; }
    }
    return out;
  }

  /* ---------------- padding ---------------- */

  // Pad to a multiple of blockSize, appending 0x80, zero fill, then a big-endian
  // bit length of lenBytes width.
  function padBlocks(bytes, blockSize, bitLen, lenBytes) {
    var withOne = bytes.length + 1;
    var total = withOne + (blockSize - ((withOne + lenBytes - 1) % blockSize)) - 1 + lenBytes;
    var out = new Uint8Array(total);
    out.set(bytes, 0);
    out[bytes.length] = 0x80;
    // big-endian bit length
    var len = bitLen;
    for (var i = lenBytes - 1; i >= 0; i--) {
      out[out.length - lenBytes + i] = len & 0xff;
      len = Math.floor(len / 256);
    }
    return out;
  }

  function wordsToBytes(words) {
    var out = new Uint8Array(words.length * 4);
    for (var i = 0; i < words.length; i++) {
      out[4 * i] = (words[i] >>> 24) & 0xff;
      out[4 * i + 1] = (words[i] >>> 16) & 0xff;
      out[4 * i + 2] = (words[i] >>> 8) & 0xff;
      out[4 * i + 3] = words[i] & 0xff;
    }
    return out;
  }

  function shaOf(algo) {
    if (algo === "sha256") return sha256;
    if (algo === "sha512") return sha512;
    return sha1;
  }

  /* ---------------- HMAC ---------------- */

  function hmac(algo, keyBytes, msgBytes) {
    var block = algo === "sha512" ? 128 : 64;
    var key = keyBytes;
    if (key.length > block) key = shaOf(algo)(key);
    var k = new Uint8Array(block);
    k.set(key);
    var oKey = new Uint8Array(block), iKey = new Uint8Array(block);
    for (var i = 0; i < block; i++) { oKey[i] = k[i] ^ 0x5c; iKey[i] = k[i] ^ 0x36; }
    var inner = shaOf(algo)(concatBytes(iKey, msgBytes));
    return shaOf(algo)(concatBytes(oKey, inner));
  }

  /* ---------------- HOTP / TOTP ---------------- */

  function hotp(keyBytes, counter, algo, digits) {
    var buf = new Uint8Array(8);
    var c = counter;
    for (var i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
    var hs = hmac(algo, keyBytes, buf);
    var offset = hs[hs.length - 1] & 0x0f;
    var bin = ((hs[offset] & 0x7f) << 24) | ((hs[offset + 1] & 0xff) << 16) |
      ((hs[offset + 2] & 0xff) << 8) | (hs[offset + 3] & 0xff);
    var otp = bin % Math.pow(10, digits);
    var s = String(otp);
    while (s.length < digits) s = "0" + s;
    return s;
  }

  // Generate the TOTP code for a given time (seconds, default now).
  function totpToken(secret, opts) {
    opts = opts || {};
    var digits = opts.digits || 6;
    var period = opts.period || 30;
    var algo = (opts.algo || "sha1").toLowerCase();
    var t = opts.t;
    if (t == null) t = Math.floor(Date.now() / 1000);
    var key = decodeSecret(secret);
    var counter = Math.floor(t / period);
    return hotp(key, counter, algo, digits);
  }

  // Seconds remaining before the current code expires.
  function remaining(period) {
    period = period || 30;
    var t = Math.floor(Date.now() / 1000);
    return period - (t % period);
  }

  // Build an otpauth:// URI for importing into authenticator apps.
  function otpUri(opts) {
    opts = opts || {};
    var label = (opts.issuer ? opts.issuer + ":" : "") + (opts.account || "");
    var params = [
      "secret=" + encodeURIComponent(opts.secret || ""),
      "issuer=" + encodeURIComponent(opts.issuer || ""),
      "algorithm=" + (opts.algo || "SHA1").toUpperCase(),
      "digits=" + (opts.digits || 6),
      "period=" + (opts.period || 30)
    ];
    return "otpauth://totp/" + encodeURIComponent(label) + "?" + params.join("&");
  }

  return {
    sha1: sha1, sha256: sha256, sha512: sha512, hmac: hmac,
    base32Decode: base32Decode, hexToBytes: hexToBytes, utf8ToBytes: utf8ToBytes,
    decodeSecret: decodeSecret, hotp: hotp, totpToken: totpToken, remaining: remaining, otpUri: otpUri
  };
});
