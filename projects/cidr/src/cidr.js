// cidr.js — zero-dependency IPv4 CIDR / subnet calculator.
// UMD so it works in the browser (<script src>) and under `require` in tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CidrTool = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function ipToLong(ip) {
    var p = String(ip).split('.');
    if (p.length !== 4) return null;
    var n = 0;
    for (var i = 0; i < 4; i++) {
      var o = parseInt(p[i], 10);
      if (isNaN(o) || o < 0 || o > 255) return null;
      n = (n << 8) | o;
    }
    return n >>> 0;
  }

  function longToIp(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  function isValidIp(ip) { return ipToLong(ip) !== null; }

  // Validate a CIDR string; returns { ip, prefix } or null.
  function parse(cidr) {
    if (typeof cidr !== 'string') return null;
    var m = cidr.trim().match(/^([0-9.]+)\/(\d{1,2})$/);
    if (!m) return null;
    var ip = m[1], pre = parseInt(m[2], 10);
    if (!isValidIp(ip)) return null;
    if (pre < 0 || pre > 32) return null;
    return { ip: ip, prefix: pre };
  }

  // Compute the full subnet info for a CIDR.
  // Throws on invalid input so the UI can surface a clear error.
  function calc(cidr) {
    var p = parse(cidr);
    if (!p) throw new Error('无效的 CIDR：期望形如 192.168.1.0/24');
    var ipLong = ipToLong(p.ip);
    var prefix = p.prefix;
    var maskLong = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
    var wildLong = (~maskLong) >>> 0;
    var netLong = (ipLong & maskLong) >>> 0;
    var bcastLong = (netLong | wildLong) >>> 0;
    var total = Math.pow(2, 32 - prefix);
    var hosts = prefix >= 31 ? total : total - 2; // /31 & /32 are special-cased
    var firstLong = prefix <= 30 ? netLong + 1 : netLong;
    var lastLong = prefix <= 30 ? bcastLong - 1 : bcastLong;
    return {
      input: cidr,
      ip: p.ip,
      prefix: prefix,
      netmask: longToIp(maskLong),
      wildcard: longToIp(wildLong),
      network: longToIp(netLong),
      broadcast: longToIp(bcastLong),
      firstHost: longToIp(firstLong),
      lastHost: longToIp(lastLong),
      totalAddresses: total,
      hostCount: hosts,
      range: longToIp(firstLong) + ' – ' + longToIp(lastLong)
    };
  }

  return {
    calc: calc,
    parse: parse,
    ipToLong: ipToLong,
    longToIp: longToIp,
    isValidIp: isValidIp
  };
});
