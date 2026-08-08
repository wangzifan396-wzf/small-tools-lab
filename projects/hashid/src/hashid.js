/*
 * hashid — zero-dependency hash type identifier.
 * Guesses possible hash algorithms from a hash string's prefix, length,
 * character set and structure. Heuristic, not a decoder.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Hashid = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function identify(hash) {
    var s = String(hash == null ? "" : hash).trim();
    var results = [];
    if (!s) return results;
    function add(name, note) { results.push({ name: name, note: note || "" }); }

    // --- $ prefixed modular / KDF formats (unambiguous) ---
    if (/^\$2[abxy]\$/.test(s)) { add("bcrypt", "带 $2a$/$2b$/$2x$/$2y$ 前缀，自适应成本，约 60 字符"); return results; }
    if (/^\$argon2/i.test(s)) { add("Argon2", "内存硬化 KDF，$argon2i/$argon2d/$argon2id"); return results; }
    if (/^\$scrypt\$/i.test(s)) { add("scrypt", "带 $scrypt$ 前缀的内存硬化 KDF"); return results; }
    if (/^\$pbkdf2/i.test(s)) { add("PBKDF2", "带 $pbkdf2 前缀的口令哈希"); return results; }
    if (/^\$1\$/.test(s) || /^\$apr1\$/.test(s)) { add("MD5 (crypt/Apache)", "Unix crypt 或 Apache $apr1$ 变体"); return results; }
    if (/^\$5\$/.test(s)) { add("SHA-256 (crypt)", "Unix sha256crypt"); return results; }
    if (/^\$6\$/.test(s)) { add("SHA-512 (crypt)", "Unix sha512crypt"); return results; }
    if (/^\$P\$|\$H\$/.test(s)) { add("phpass (WordPress)", "基于 MD5 的便携式口令哈希"); return results; }
    if (/^\$md5\$/i.test(s)) { add("MD5", "带 $md5$ 前缀"); return results; }

    // --- hex / base64 by length ---
    var clean = s.replace(/[\s:\-]/g, "");
    var isHex = /^[0-9a-fA-F]+$/.test(clean);
    // base64 length is a multiple of 4 with padding; without padding it's % 4 === 2 or 3 (never 1)
    var cleanNoPad = clean.replace(/=+$/, "");
    var isB64 = /^[A-Za-z0-9+/=]+$/.test(clean) && cleanNoPad.length % 4 !== 1;

    if (isHex) {
      var L = clean.length;
      switch (L) {
        case 8: add("CRC32", "32 位校验和，也可能是 64 位哈希截断"); break;
        case 16: add("MySQL (旧 323)", "MySQL323 等 64 位哈希"); add("DES crypt", "传统 Unix DES 口令哈希约 13 字符"); break;
        case 32:
          add("MD5", "128 位摘要，最常见");
          add("NTLM", "Windows NT 口令哈希（同为 32 位 hex）");
          add("MD4", "128 位");
          add("LM", "LAN Manager，通常大写且含连字符");
          add("RIPEMD-128 / HAVAL-128 / Tiger-128", "");
          break;
        case 40: add("SHA-1", "160 位摘要，最常见"); add("RIPEMD-160 / HAVAL-160 / Tiger-160", ""); break;
        case 48: add("Tiger-192 / HAVAL-192", "192 位"); break;
        case 56: add("SHA-224 / HAVAL-224", "224 位"); break;
        case 64: add("SHA-256", "256 位，最常见"); add("SHA3-256 / Keccak-256 / BLAKE2s", ""); break;
        case 96: add("SHA-384 / SHA3-384 / BLAKE2b-384", "384 位"); break;
        case 128: add("SHA-512", "512 位，最常见"); add("SHA3-512 / Whirlpool / BLAKE2b", ""); break;
        default: add("未知长度（" + L + " 位 hex）", "无法仅从长度唯一确定算法");
      }
      return results;
    }

    if (isB64) {
      var n = clean.length;
      if (n >= 20 && n <= 24) add("MD5 (Base64)", "约 22 字符 Base64 编码");
      else if (n >= 26 && n <= 28) add("SHA-1 (Base64)", "约 28 字符 Base64 编码");
      else if (n >= 42 && n <= 44) add("SHA-256 (Base64)", "约 44 字符 Base64 编码");
      else if (n >= 84 && n <= 88) add("SHA-512 (Base64)", "约 88 字符 Base64 编码");
      else add("未知 Base64 长度（" + n + " 字符）", "无法唯一确定");
      return results;
    }

    add("无法识别", "既非标准 hex 也非标准 Base64，或含未知前缀");
    return results;
  }

  return { identify: identify };
});
