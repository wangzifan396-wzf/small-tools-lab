/*
 * cssfmt — zero-dependency CSS beautifier / minifier.
 * Brace-aware indentation for beautify; whitespace + comment stripping for
 * minify. Strings and comments are protected so their contents are untouched.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CssFmt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function protect(css) {
    var store = [];
    css = css.replace(/\/\*[\s\S]*?\*\//g, function (m) { store.push(m); return '\u0000' + (store.length - 1) + '\u0000'; });
    css = css.replace(/"(?:[^"\\]|\\.)*"/g, function (m) { store.push(m); return '\u0000' + (store.length - 1) + '\u0000'; });
    css = css.replace(/'(?:[^'\\]|\\.)*'/g, function (m) { store.push(m); return '\u0000' + (store.length - 1) + '\u0000'; });
    return { css: css, store: store };
  }

  function restore(css, store) {
    return css.replace(/\u0000(\d+)\u0000/g, function (_, i) { return store[Number(i)]; });
  }

  function pad(n) { return new Array(n * 2 + 1).join(' '); }

  function beautify(css) {
    if (!css || !css.trim()) return '';
    var p = protect(css);
    var s = p.css.replace(/\s+/g, ' ').trim();
    var out = '';
    var indent = 0;
    var i = 0;
    while (i < s.length) {
      var ph = s.indexOf('\u0000', i);
      var seg = ph === -1 ? s.slice(i) : s.slice(i, ph);
      for (var j = 0; j < seg.length; j++) {
        var ch = seg[j];
        if (ch === '{') {
          out = out.replace(/\s+$/, '') + ' {\n' + pad(indent);
          indent++;
          out += pad(indent);
        } else if (ch === '}') {
          indent = Math.max(0, indent - 1);
          out = out.replace(/\s+$/, '') + '\n' + pad(indent) + '}\n' + pad(indent);
        } else if (ch === ';') {
          out += ';\n' + pad(indent);
        } else if (ch === ' ') {
          if (out === '' || /[\n ]$/.test(out)) continue;
          out += ' ';
        } else {
          out += ch;
        }
      }
      if (ph === -1) { i = s.length; break; }
      var end = s.indexOf('\u0000', ph + 1);
      out += p.store[Number(s.slice(ph + 1, end))];
      i = end + 1;
    }
    return restore(out.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, ''), p.store);
  }

  function minify(css) {
    if (!css || !css.trim()) return '';
    var p = protect(css);
    var s = p.css.replace(/\s+/g, ' ').trim();
    s = s.replace(/\s*([{}:;,])\s*/g, '$1');
    s = s.replace(/;}/g, '}');
    return restore(s, p.store);
  }

  return { beautify: beautify, minify: minify };
});
