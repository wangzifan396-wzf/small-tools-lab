// Punycode (RFC 3492) encode/decode + IDN domain conversion — zero dependency, UMD.
(function (root) {
  var base = 36, tmin = 1, tmax = 26, skew = 38, damp = 700, initial_bias = 72, initial_n = 128;

  function adapt(delta, numpoints, firstTime) {
    delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numpoints);
    var k = 0;
    while (delta > ((base - tmin) * tmax) >> 1) { delta = Math.floor(delta / (base - tmin)); k += base; }
    return k + Math.floor(((base - tmin + 1) * delta) / (delta + skew));
  }
  function digitToBasic(d) { return String.fromCharCode(d < 26 ? d + 97 : d - 26 + 48); }
  function basicToDigit(cp) {
    if (cp >= 48 && cp <= 57) return 26 + (cp - 48);   // '0'-'9' -> 26..35
    if (cp >= 65 && cp <= 90) return cp - 65;          // 'A'-'Z' -> 0..25
    if (cp >= 97 && cp <= 122) return cp - 97;         // 'a'-'z' -> 0..25
    return base;                                        // invalid (out of range)
  }
  function codePoints(str) { return Array.from(str).map(function (c) { return c.codePointAt(0); }); }

  function encode(str) {
    var cps = codePoints(str), n = initial_n, delta = 0, bias = initial_bias, h = 0, b = 0, out = [];
    for (var x = 0; x < cps.length; x++) if (cps[x] < 128) { out.push(String.fromCodePoint(cps[x])); h++; b++; }
    var basicCount = b;
    if (b > 0) out.push('-');
    var handled = b;
    while (handled < cps.length) {
      var m = Infinity;
      for (var y = 0; y < cps.length; y++) if (cps[y] >= n && cps[y] < m) m = cps[y];
      delta += (m - n) * (handled + 1); n = m;
      for (var z = 0; z < cps.length; z++) {
        if (cps[z] < n) delta++;
      else         if (cps[z] === n) {
        var q = delta;
        for (var k = base; ; k += base) {
            var t = (k <= bias + tmin) ? tmin : (k >= bias + tmax) ? tmax : k - bias;
            if (q < t) break;
            out.push(digitToBasic(t + ((q - t) % (base - t))));
            q = Math.floor((q - t) / (base - t));
          }
          out.push(digitToBasic(q));
          bias = adapt(delta, handled + 1, handled === basicCount);
          delta = 0; handled++;
        }
      }
      delta++; n++;
    }
    return out.join('');
  }

  function decode(input) {
    var output = [], len = input.length, i = 0, n = initial_n, bias = initial_bias;
    var basic = input.lastIndexOf('-');
    if (basic < 0) basic = 0;
    else {
      for (var j = 0; j < basic; j++) {
        var c = input.charCodeAt(j);
        if (c >= 128) throw new Error('非法 Punycode 字符');
        output.push(c);
      }
      basic++;
    }
    var pos = (basic > 0) ? basic : 0; // read pointer (after the basic part)
    while (pos < len) {
      var oldi = i;
      var w = 1;
      for (var k = base; ; k += base) {
        var digit = basicToDigit(input.charCodeAt(pos++));
        if (digit >= base) throw new Error('非法 Punycode 字符');
        i += digit * w;
        var t = (k <= bias) ? tmin : (k >= bias + tmax) ? tmax : k - bias;
        if (digit < t) break;
        w *= (base - t);
      }
      var outLen = output.length + 1;
      bias = adapt(i - oldi, outLen, oldi === 0);
      n += Math.floor(i / outLen);
      i %= outLen;
      output.splice(i++, 0, n);
    }
    return String.fromCodePoint.apply(null, output);
  }

  function toASCII(domain) {
    return domain.split('.').map(function (label) {
      if (/^[\x00-\x7F]*$/.test(label)) return label;
      return 'xn--' + encode(label);
    }).join('.');
  }
  function toUnicode(domain) {
    return domain.split('.').map(function (label) {
      if (label.toLowerCase().indexOf('xn--') === 0) return decode(label.slice(4));
      return label;
    }).join('.');
  }

  var api = { encode: encode, decode: decode, toASCII: toASCII, toUnicode: toUnicode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Punycode = api;
})(typeof window !== 'undefined' ? window : this);
