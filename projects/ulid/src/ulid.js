// ulid.js — zero-dependency ULID generator & decoder (Crockford Base32).
// ULID = 26 chars: 48-bit timestamp (10) + 80-bit randomness (16), lexicographically
// sortable. UMD so it works in the browser (<script src>) and under `require` in tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UlidTool = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford (no I L O U)

  function randomBytes(n) {
    try { return require('crypto').randomBytes(n); } catch (e) { /* fall through */ }
    if (typeof self !== 'undefined' && self.crypto && self.crypto.getRandomValues) {
      var a = new Uint8Array(n);
      self.crypto.getRandomValues(a);
      return a;
    }
    var b = new Uint8Array(n);
    for (var i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }

  function bytesToBigInt(bytes) {
    var b = 0n;
    for (var i = 0; i < bytes.length; i++) b = (b << 8n) | BigInt(bytes[i]);
    return b;
  }

  function encodeBase32(num, len) {
    var n = BigInt(num);
    var s = '';
    while (n > 0n) { s = ALPHABET[Number(n % 32n)] + s; n = n / 32n; }
    return s.padStart(len, '0');
  }

  function decodeBase32(str) {
    var n = 0n;
    for (var i = 0; i < str.length; i++) {
      var v = ALPHABET.indexOf(str[i]);
      if (v < 0) throw new Error('非法 ULID 字符: ' + str[i]);
      n = n * 32n + BigInt(v);
    }
    return n;
  }

  // Generate a ULID. `time` defaults to Date.now() (ms).
  function generate(time) {
    var t = BigInt(typeof time === 'number' ? time : Date.now());
    var timeStr = encodeBase32(t, 10);
    var rand = bytesToBigInt(randomBytes(10));
    var randStr = encodeBase32(rand, 16);
    return timeStr + randStr;
  }

  // Decode a ULID into its timestamp + randomness. Throws on malformed input.
  function decode(ulid) {
    if (typeof ulid !== 'string' || ulid.length !== 26) throw new Error('ULID 必须为 26 个字符');
    var up = ulid.toUpperCase();
    for (var i = 0; i < 26; i++) if (ALPHABET.indexOf(up[i]) < 0) throw new Error('非法 ULID 字符: ' + up[i]);
    var t = decodeBase32(up.slice(0, 10));
    var r = decodeBase32(up.slice(10, 26));
    return {
      timestamp: Number(t),
      time: new Date(Number(t)),
      randomness: r.toString(16).padStart(20, '0'),
      ulid: up
    };
  }

  function isValid(ulid) {
    try { decode(ulid); return true; } catch (e) { return false; }
  }

  return { generate: generate, decode: decode, isValid: isValid, ALPHABET: ALPHABET };
});
