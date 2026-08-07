// Base58 (Bitcoin alphabet) encode/decode — zero dependency, UMD.
(function (root) {
  var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function encode(bytes) {
    if (!bytes || !bytes.length) return '';
    var zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
    var digits = [];
    for (var i = zeros; i < bytes.length; i++) {
      var carry = bytes[i];
      for (var j = 0; j < digits.length; j++) {
        carry += digits[j] << 8;
        digits[j] = carry % 58;
        carry = (carry - digits[j]) / 58;
      }
      while (carry > 0) { digits.push(carry % 58); carry = (carry - (carry % 58)) / 58; }
    }
    var out = '';
    for (var z = 0; z < zeros; z++) out += ALPHABET[0];
    for (var k = digits.length - 1; k >= 0; k--) out += ALPHABET[digits[k]];
    return out;
  }
  function decode(str) {
    if (!str) return [];
    var zeros = 0;
    while (zeros < str.length && str[zeros] === ALPHABET[0]) zeros++;
    var bytes = [];
    for (var i = zeros; i < str.length; i++) {
      var v = ALPHABET.indexOf(str[i]);
      if (v < 0) throw new Error('非法 Base58 字符: ' + str[i]);
      var carry = v;
      for (var j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }
      while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    var out = [];
    for (var z = 0; z < zeros; z++) out.push(0);
    for (var k = bytes.length - 1; k >= 0; k--) out.push(bytes[k]);
    return out;
  }
  var api = { encode: encode, decode: decode, ALPHABET: ALPHABET };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Base58 = api;
})(typeof window !== 'undefined' ? window : this);
