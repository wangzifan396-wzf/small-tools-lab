// CRC16 (CCITT-FALSE / IBM-ARC / MODBUS / XMODEM) + CRC32 — zero dependency, UMD.
(function (root) {
  function reflect8(x) { var r = 0; for (var i = 0; i < 8; i++) { r = (r << 1) | (x & 1); x >>= 1; } return r; }

  function crc16_noref(poly, init, xorout, bytes) {
    var crc = init;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= (bytes[i] << 8);
      for (var b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ poly) & 0xffff : (crc << 1) & 0xffff;
    }
    return (crc ^ xorout) & 0xffff;
  }
  function crc16_ref(poly, init, xorout, bytes) {
    var crc = init;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (var b = 0; b < 8; b++) crc = (crc & 1) ? ((crc >> 1) ^ poly) & 0xffff : (crc >> 1) & 0xffff;
    }
    return (crc ^ xorout) & 0xffff;
  }
  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (var b = 0; b < 8; b++) crc = (crc & 1) ? ((crc >>> 1) ^ 0xedb88320) >>> 0 : (crc >>> 1) >>> 0;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  var ALGOS = {
    'CRC-16/CCITT-FALSE': function (b) { return crc16_noref(0x1021, 0xffff, 0x0000, b); },
    'CRC-16/XMODEM': function (b) { return crc16_noref(0x1021, 0x0000, 0x0000, b); },
    'CRC-16/IBM-ARC': function (b) { return crc16_ref(0xA001, 0x0000, 0x0000, b); },
    'CRC-16/MODBUS': function (b) { return crc16_ref(0xA001, 0xffff, 0x0000, b); },
    'CRC-32': function (b) { return crc32(b); },
  };

  function compute(name, bytes) {
    var fn = ALGOS[name];
    if (!fn) throw new Error('未知算法: ' + name);
    var v = fn(bytes);
    var width = name.indexOf('32') >= 0 ? 8 : 4;
    return ('00000000' + v.toString(16).toUpperCase()).slice(-width);
  }

  var api = { compute: compute, ALGOS: ALGOS, reflect8: reflect8 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CRC = api;
})(typeof window !== 'undefined' ? window : this);
