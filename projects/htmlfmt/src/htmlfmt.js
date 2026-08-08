/*
 * htmlfmt — zero-dependency HTML beautifier / minifier.
 * Tag-aware indentation for beautify; whitespace + comment stripping for
 * minify. Script/style blocks, attribute strings, and comments are protected.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HtmlFmt = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var PH = String.fromCharCode(0); /* NUL placeholder wrapper */

  function stash(store, m) { store.push(m); return PH + (store.length - 1) + PH; }
  function restore(s, store) {
    return s.replace(new RegExp(PH + "(\\d+)" + PH, "g"), function (_, i) { return store[Number(i)]; });
  }

  var VOID = {
    area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1,
    link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1
  };

  function protectBeautify(html) {
    var store = [];
    var s = html;
    s = s.replace(/<!--[\s\S]*?-->/g, function (m) { return stash(store, m); });
    s = s.replace(/<script[\s\S]*?<\/script>/gi, function (m) { return stash(store, m); });
    s = s.replace(/<style[\s\S]*?<\/style>/gi, function (m) { return stash(store, m); });
    s = s.replace(/"[^"]*"/g, function (m) { return stash(store, m); });
    s = s.replace(/'[^']*'/g, function (m) { return stash(store, m); });
    return { html: s, store: store };
  }

  function beautify(html) {
    if (!html || !html.trim()) return "";
    var p = protectBeautify(html);
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
          var nm = raw.slice(1).match(/^[a-zA-Z0-9-]+/);
          var name = nm ? nm[0].toLowerCase() : "";
          var isVoid = !!VOID[name];
          var isSelf = /\/>$/.test(raw);
          if (stack.length) stack[stack.length - 1].hasBlock = true;
          out = out.replace(/\s+$/, "") + "\n" + pad(indent) + raw;
          if (!isVoid && !isSelf) { indent++; stack.push({ hasBlock: false }); }
        }
      } else {
        var t = tk.replace(/\s+/g, " ").trim();
        if (t) out += t;
      }
    }
    out = out.replace(/^\n+/, "");
    return restore(out, p.store);
  }

  function minify(html) {
    if (!html || !html.trim()) return "";
    var store = [];
    var s = html;
    s = s.replace(/<!--[\s\S]*?-->/g, ""); /* drop HTML comments */
    s = s.replace(/<script[\s\S]*?<\/script>/gi, function (m) { return stash(store, m); });
    s = s.replace(/<style[\s\S]*?<\/style>/gi, function (m) { return stash(store, m); });
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
