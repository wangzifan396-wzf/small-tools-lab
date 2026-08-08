// rsa.js — zero-dependency RSA (UMD)
// Pure-JS RSA with Miller-Rabin prime generation, PKCS#1 v1.5 padding.
// Runs in the browser (file://) and in Node. No Web Crypto required.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RSA = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var hasRequire = typeof require !== "undefined";

  // ---- cross-environment secure RNG -> returns Uint8Array(n) ----
  function randBytes(n) {
    if (hasRequire) {
      return require("crypto").randomBytes(n);
    }
    if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.getRandomValues) {
      var u = new Uint8Array(n);
      globalThis.crypto.getRandomValues(u);
      return u;
    }
    // last-resort fallback (NOT cryptographically strong): only for non-key paths
    var a = new Uint8Array(n);
    for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return a;
  }

  // ---- bigint helpers ----
  function bytesToBigInt(bytes) {
    var v = 0n;
    for (var i = 0; i < bytes.length; i++) v = (v << 8n) | BigInt(bytes[i]);
    return v;
  }
  function bigIntToBytes(bi, len) {
    var neg = bi < 0n;
    bi = neg ? -bi : bi;
    var out = new Uint8Array(len);
    for (var i = len - 1; i >= 0; i--) {
      out[i] = Number(bi & 0xffn);
      bi >>= 8n;
    }
    if (neg) {
      // two's complement for display/testing edge cases
      var carry = 1;
      for (var j = len - 1; j >= 0; j--) {
        var x = (out[j] ^ 0xff) + carry;
        out[j] = x & 0xff;
        carry = x >> 8;
      }
    }
    return out;
  }
  function byteLen(bi) {
    if (bi === 0n) return 1;
    var bits = 0n;
    var t = bi < 0n ? -bi : bi;
    while (t > 0n) { t >>= 1n; bits++; }
    return Number((bits + 7n) / 8n);
  }

  // square-and-multiply modular exponentiation
  function modExp(base, exp, mod) {
    if (mod === 1n) return 0n;
    var result = 1n;
    base = base % mod;
    while (exp > 0n) {
      if (exp & 1n) result = (result * base) % mod;
      exp >>= 1n;
      base = (base * base) % mod;
    }
    return result;
  }

  // extended Euclidean algorithm -> modular inverse (a^-1 mod m)
  function modInverse(a, m) {
    var old_r = a, r = m;
    var old_s = 1n, s = 0n;
    while (r !== 0n) {
      var q = old_r / r;
      var tmp = old_r; old_r = r; r = tmp - q * r;
      var tmp2 = old_s; old_s = s; s = tmp2 - q * s;
    }
    if (old_r !== 1n) throw new Error("modular inverse does not exist");
    return ((old_s % m) + m) % m;
  }

  function gcd(a, b) {
    while (b !== 0n) { var t = b; b = a % b; a = t; }
    return a;
  }

  // random bigint in [0, max)
  function randBelow(max) {
    if (max <= 0n) return 0n;
    var len = byteLen(max);
    while (true) {
      var b = bytesToBigInt(randBytes(len));
      if (b < max) return b;
    }
  }

  // Miller-Rabin probabilistic primality test
  function isProbablePrime(n, k) {
    if (n < 2n) return false;
    var small = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
    for (var i = 0; i < small.length; i++) {
      if (n % small[i] === 0n) return n === small[i];
    }
    var d = n - 1n, r = 0n;
    while ((d & 1n) === 0n) { d >>= 1n; r++; }
    witness:
    for (var w = 0; w < k; w++) {
      var a = randBelow(n - 2n) + 2n; // [2, n-2]
      var x = modExp(a, d, n);
      if (x === 1n || x === n - 1n) continue;
      for (var j = 1n; j < r; j++) {
        x = modExp(x, 2n, n);
        if (x === n - 1n) continue witness;
      }
      return false;
    }
    return true;
  }

  // generate a `bits`-bit probable prime
  function genPrime(bits) {
    var top = 1n << BigInt(bits - 1);
    var guard = 0;
    while (true) {
      if (++guard > 200000) throw new Error("prime generation failed");
      var len = Math.ceil(bits / 8);
      var x = bytesToBigInt(randBytes(len));
      x |= 1n;                 // odd
      x |= top;               // ensure `bits` bits
      x &= (top << 1n) - 1n;  // mask to `bits` bits
      if (isProbablePrime(x, 16)) return x;
    }
  }

  // ---- key generation ----
  function keygen(bits) {
    bits = bits || 1024;
    var half = bits / 2;
    var p, q, n, phi, e = 65537n, d;
    while (true) {
      p = genPrime(half);
      q = genPrime(half);
      n = p * q;
      phi = (p - 1n) * (q - 1n);
      if (gcd(e, phi) === 1n) {
        d = modInverse(e, phi);
        break;
      }
    }
    return {
      bits: bits,
      n: n,
      e: e,
      d: d,
      p: p,
      q: q,
      // hex helpers for UI
      nHex: bytesToHex(bigIntToBytes(n, byteLen(n))),
      eHex: bytesToHex(bigIntToBytes(e, byteLen(e))),
      dHex: bytesToHex(bigIntToBytes(d, byteLen(n))),
      pHex: bytesToHex(bigIntToBytes(p, byteLen(p))),
      qHex: bytesToHex(bigIntToBytes(q, byteLen(q))),
    };
  }

  // ---- PKCS#1 v1.5 (type 2) padding / unpadding ----
  function pkcs1Pad(message, k) {
    var mLen = message.length;
    if (mLen > k - 11) throw new Error("message too long for key size");
    var psLen = k - 3 - mLen;
    var ps = [];
    while (ps.length < psLen) {
      var b = randBytes(1)[0];
      if (b !== 0x00) ps.push(b);
    }
    var eb = [0x00, 0x02].concat(ps, [0x00]);
    for (var i = 0; i < mLen; i++) eb.push(message[i]);
    return eb;
  }
  function pkcs1Unpad(eb, k) {
    if (eb.length !== k) return null;
    if (eb[0] !== 0x00 || eb[1] !== 0x02) return null;
    var i = 2;
    while (i < k && eb[i] !== 0x00) i++;
    if (i >= k) return null;
    return eb.slice(i + 1);
  }

  // ---- hex helpers ----
  function bytesToHex(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += ("0" + bytes[i].toString(16)).slice(-2);
    return s;
  }
  function hexToBytes(hex) {
    var h = String(hex).replace(/[^0-9a-fA-F]/g, "");
    if (h.length % 2) h = "0" + h;
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  function utf8ToBytes(str) {
    if (typeof TextEncoder !== "undefined") return new Uint8Array(new TextEncoder().encode(str));
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    return new Uint8Array(out);
  }
  function bytesToUtf8(bytes) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  // ---- public API ----
  // encrypt a UTF-8 string with public key (n, e). returns hex ciphertext.
  function encrypt(message, n, e) {
    n = typeof n === "bigint" ? n : bytesToBigInt(hexToBytes(n));
    e = typeof e === "bigint" ? e : bytesToBigInt(hexToBytes(e));
    var k = byteLen(n);
    var data = utf8ToBytes(String(message));
    var eb = pkcs1Pad(Array.from(data), k);
    var m = bytesToBigInt(Uint8Array.from(eb));
    var c = modExp(m, e, n);
    return bytesToHex(bigIntToBytes(c, k));
  }
  // decrypt hex ciphertext with private key (n, d). returns UTF-8 string.
  function decrypt(cipherHex, n, d) {
    n = typeof n === "bigint" ? n : bytesToBigInt(hexToBytes(n));
    d = typeof d === "bigint" ? d : bytesToBigInt(hexToBytes(d));
    var k = byteLen(n);
    var c = bytesToBigInt(hexToBytes(cipherHex));
    var m = modExp(c, d, n);
    var eb = Array.from(bigIntToBytes(m, k));
    var msg = pkcs1Unpad(eb, k);
    if (!msg) throw new Error("decryption failed (invalid padding)");
    return bytesToUtf8(Uint8Array.from(msg));
  }

  return {
    randBytes: randBytes,
    modExp: modExp,
    modInverse: modInverse,
    gcd: gcd,
    isProbablePrime: isProbablePrime,
    genPrime: genPrime,
    keygen: keygen,
    encrypt: encrypt,
    decrypt: decrypt,
    bytesToHex: bytesToHex,
    hexToBytes: hexToBytes,
    utf8ToBytes: utf8ToBytes,
    bytesToUtf8: bytesToUtf8,
    byteLen: byteLen,
  };
});
