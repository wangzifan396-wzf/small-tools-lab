// Base85 (Ascii85 / Z85) encode/decode — zero dependency, UMD.
// Uses '~' as a padding marker (outside both alphabets) for lossless round-trip,
// analogous to '=' padding in Base64.
(function (root) {
  // Adobe Ascii85: characters '!' (33) .. 'u' (117)
  var ASCII85 = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuv';
  // ZeroMQ Z85 (full, ordered alphabet)
  var Z85 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
  var PAD = '~';

  function buildMap(a) {
    var m = {};
    for (var i = 0; i < a.length; i++) m[a.charAt(i)] = i;
    return m;
  }
  var A85MAP = buildMap(ASCII85);
  var Z85MAP = buildMap(Z85);

  function encode(bytes, alphabet, zeroShortcut) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 4) {
      var n = Math.min(4, bytes.length - i);
      var v = 0;
      for (var j = 0; j < 4; j++) v = (((v << 8) | (bytes[i + j] || 0)) >>> 0);
      if (zeroShortcut && n === 4 && v === 0) { out += 'z'; continue; }
      var d = [0, 0, 0, 0, 0];
      for (var k = 4; k >= 0; k--) { d[k] = v % 85; v = Math.floor(v / 85); }
      for (var c = 0; c < 5; c++) out += alphabet.charAt(d[c]);
      for (var p = 0; p < 4 - n; p++) out += PAD;
    }
    return out;
  }

  function decode(str, alphabet, zeroShortcut, map) {
    var out = [];
    var i = 0;
    while (i < str.length) {
      if (zeroShortcut && str.charAt(i) === 'z') { out.push(0, 0, 0, 0); i++; continue; }
      var j = i, v = 0, cnt = 0, pad = 0;
      while (j < str.length) {
        var ch = str.charAt(j);
        if (ch === PAD) { pad++; j++; continue; }
        if (cnt === 5) break; // full content read; only trailing padding (handled above) or a new group
        if (zeroShortcut && ch === 'z') break;
        var dv = map[ch];
        if (dv === undefined) throw new Error('非法 Base85 字符: ' + ch);
        v = v * 85 + dv; cnt++; j++;
      }
      for (var b = 3; b >= 0; b--) out.push((v >>> (8 * b)) & 0xff);
      for (var q = 0; q < pad; q++) out.pop();
      i = j;
    }
    return out;
  }

  var api = {
    ascii85: {
      encode: function (bytes) { return encode(bytes, ASCII85, true); },
      decode: function (str) { return decode(str, ASCII85, true, A85MAP); }
    },
    z85: {
      encode: function (bytes) { return encode(bytes, Z85, false); },
      decode: function (str) { return decode(str, Z85, false, Z85MAP); }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Base85 = api;
})(typeof window !== 'undefined' ? window : this);
