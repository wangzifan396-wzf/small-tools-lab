// Code 128 (Code B) barcode generator — zero dependency, UMD.
// Code B covers printable ASCII 32–127. Renders a scannable SVG with quiet zones.
(function (root) {
  // Standard Code 128 bar-width patterns (value -> 6 elements, bars & spaces, summing to 11 modules).
  var PATTERNS = {
    0: '212222', 1: '222122', 2: '222221', 3: '121223', 4: '121322', 5: '131222', 6: '122213', 7: '122312',
    8: '132212', 9: '221213', 10: '221312', 11: '231212', 12: '112232', 13: '122132', 14: '122231', 15: '113222',
    16: '123122', 17: '123221', 18: '223211', 19: '221132', 20: '221231', 21: '213212', 22: '223112', 23: '312131',
    24: '311222', 25: '321122', 26: '321221', 27: '312212', 28: '322112', 29: '322211', 30: '212123', 31: '212321',
    32: '232121', 33: '111323', 34: '131123', 35: '131321', 36: '112313', 37: '132113', 38: '132311', 39: '211313',
    40: '231113', 41: '231311', 42: '112133', 43: '112331', 44: '132131', 45: '113123', 46: '113321', 47: '133121',
    48: '313121', 49: '211331', 50: '231131', 51: '213113', 52: '213311', 53: '213131', 54: '311123', 55: '311321',
    56: '331121', 57: '312113', 58: '312311', 59: '332111', 60: '314111', 61: '221411', 62: '431111', 63: '111224',
    64: '111422', 65: '121124', 66: '121421', 67: '141122', 68: '141221', 69: '112214', 70: '112412', 71: '122114',
    72: '122411', 73: '142112', 74: '142211', 75: '241211', 76: '221114', 77: '413111', 78: '241112', 79: '134111',
    80: '111242', 81: '121142', 82: '121241', 83: '114212', 84: '124112', 85: '124211', 86: '411212', 87: '421112',
    88: '421211', 89: '212141', 90: '214121', 91: '412121', 92: '111143', 93: '111341', 94: '131141', 95: '114113',
    96: '114311', 97: '411113', 98: '411311', 99: '113141', 100: '114131', 101: '311141', 102: '411131', 103: '211412',
    104: '211214', 105: '211232'
  };
  var STOP = '2331112'; // 7 elements, 13 modules
  var START_B = 104, STOP_V = 106;

  function symbols(text) {
    var values = [START_B];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code < 32 || code > 127) throw new Error('Code B 仅支持 ASCII 32–127 字符: ' + text[i]);
      values.push(code - 32);
    }
    var sum = START_B;
    for (var j = 1; j < values.length; j++) sum += j * values[j];
    values.push(sum % 103);
    values.push(STOP_V);
    return values;
  }

  function modulesFor(values) {
    var m = '';
    for (var i = 0; i < values.length; i++) {
      m += (values[i] === STOP_V) ? STOP : PATTERNS[values[i]];
    }
    return m;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderSVG(text, opts) {
    opts = opts || {};
    var values = symbols(text);
    var mods = modulesFor(values);
    var quiet = (opts.quiet == null) ? 10 : opts.quiet;
    var x = quiet;
    var rects = [];
    var isBar = true;
    for (var i = 0; i < mods.length; i++) {
      var w = parseInt(mods.charAt(i), 10);
      if (isBar) rects.push({ x: x, w: w });
      x += w;
      isBar = !isBar;
    }
    var total = x + quiet;
    var height = opts.height || 80;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + height +
      '" width="' + total + '" height="' + height + '" role="img" aria-label="Code 128 barcode for ' + escapeAttr(text) + '">';
    svg += '<rect x="0" y="0" width="' + total + '" height="' + height + '" fill="#fff"/>';
    for (var r = 0; r < rects.length; r++) {
      svg += '<rect x="' + rects[r].x + '" y="0" width="' + rects[r].w + '" height="' + height + '" fill="#000"/>';
    }
    svg += '</svg>';
    return { svg: svg, values: values, modules: mods, width: total };
  }

  var api = { PATTERNS: PATTERNS, STOP: STOP, symbols: symbols, modulesFor: modulesFor, renderSVG: renderSVG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Barcode = api;
})(typeof window !== 'undefined' ? window : this);
