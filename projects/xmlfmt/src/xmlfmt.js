/*
 * xmlfmt — zero-dependency XML beautifier / minifier.
 * Element-aware indentation for beautify; whitespace + comment stripping for
 * minify. CDATA blocks, comments, processing instructions, and attribute
 * strings are protected.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.XmlFmt = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var PH = String.fromCharCode(0); /* NUL placeholder wrapper */

  function stash(store, m) { store.push(m); return PH + (store.length - 1) + PH; }
  function restore(s, store) {
    return s.replace(new RegExp(PH + "(\\d+)" + PH, "g"), function (_, i) { return store[Number(i)]; });
  }

  function protectBeautify(xml) {
    var store = [];
    var s = xml;
    s = s.replace(/<!--[\s\S]*?-->/g, function (m) { return stash(store, m); });
    s = s.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, function (m) { return stash(store, m); });
    s = s.replace(/<\?[\s\S]*?\?>/g, function (m) { return stash(store, m); });
    s = s.replace(/"[^"]*"/g, function (m) { return stash(store, m); });
    s = s.replace(/'[^']*'/g, function (m) { return stash(store, m); });
    return { html: s, store: store };
  }

  function beautify(xml) {
    if (!xml || !xml.trim()) return "";
    var p = protectBeautify(xml);
    var tokens = p.html.match(/<[^>]+>|[^<]+/g) || [];
    var out = "";
    var indent = 0;
    var stack = [];
    function pad(n) { return new Array(n * 2 + 1).join(" "); }
    for (var k = 0; k < tokens.length; k++) {
      var tk = tokens[k];
      if (tk.charAt(0) === "<") {
        var raw = tk.trim();
        if (raw.charAt(1) === "/") {
          var top = stack.pop();
          indent = Math.max(0, indent - 1);
          if (top && top.hasBlock) out = out.replace(/\s+$/, "") + "\n" + pad(indent) + raw;
          else out = out.replace(/\s+$/, "") + raw;
        } else {
          var isSelf = /\/>$/.test(raw);
          if (stack.length) stack[stack.length - 1].hasBlock = true;
          out = out.replace(/\s+$/, "") + "\n" + pad(indent) + raw;
          if (!isSelf) { indent++; stack.push({ hasBlock: false }); }
        }
      } else {
        var t = tk.replace(/\s+/g, " ").trim();
        if (t) out += t;
      }
    }
    out = out.replace(/^\n+/, "");
    return restore(out, p.store);
  }

  function minify(xml) {
    if (!xml || !xml.trim()) return "";
    var store = [];
    var s = xml;
    s = s.replace(/<!--[\s\S]*?-->/g, ""); /* drop XML comments */
    s = s.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, function (m) { return stash(store, m); });
    s = s.replace(/<\?[\s\S]*?\?>/g, function (m) { return stash(store, m); });
    s = s.replace(/"[^"]*"/g, function (m) { return stash(store, m); });
    s = s.replace(/'[^']*'/g, function (m) { return stash(store, m); });
    s = s.replace(/>\s*</g, "><");
    s = s.replace(/\s+>/g, ">");
    s = s.replace(/<\s+/g, "<");
    s = restore(s, store);
    return s.trim();
  }

  return { beautify: beautify, minify: minify };
});
