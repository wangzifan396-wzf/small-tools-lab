// Base32 (RFC 4648 + Crockford) encode/decode — zero dependency, UMD.
(function (root) {
  var RFC_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  var CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  function buildMap(alphabet) {
    var m = {};
    for (var i = 0; i < alphabet.length; i++) m[alphabet.charAt(i)] = i;
    return m;
  }
  var RFC_MAP = buildMap(RFC_ALPHABET);
  var CROCKFORD_MAP = buildMap(CROCKFORD_ALPHABET);

  function encodeBytes(bytes, alphabet, pad) {
    var out = '', bits = 0, value = 0;
    for (var i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        out += alphabet.charAt((value >>> (bits - 5)) & 31);
        bits -= 5;
      }
    }
    if (bits > 0) out += alphabet.charAt((value << (5 - bits)) & 31);
    if (pad) while (out.length % 8) out += '=';
    return out;
  }

  function decodeStr(str, alphabet, map, normalize) {
    if (normalize) str = normalize(str);
    var bits = 0, value = 0, out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (c === '=') continue;
      var v = map[c];
      if (v === undefined) throw new Error('非法 Base32 字符: ' + c);
      value = (value << 5) | v;
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return out;
  }

  function normalizeCrockford(s) {
    return s.toUpperCase().replace(/[-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  }

  var api = {
    RFC_ALPHABET: RFC_ALPHABET,
    CROCKFORD_ALPHABET: CROCKFORD_ALPHABET,
    encode: function (bytes, variant) {
      variant = variant || 'rfc4648';
      return variant === 'crockford'
        ? encodeBytes(bytes, CROCKFORD_ALPHABET, false)
        : encodeBytes(bytes, RFC_ALPHABET, true);
    },
    decode: function (str, variant) {
      variant = variant || 'rfc4648';
      return variant === 'crockford'
        ? decodeStr(str, CROCKFORD_ALPHABET, CROCKFORD_MAP, normalizeCrockford)
        : decodeStr(str, RFC_ALPHABET, RFC_MAP, null);
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Base32 = api;
})(typeof window !== 'undefined' ? window : this);
