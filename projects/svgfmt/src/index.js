// svgfmt — SVG pretty-printer & minifier (UMD, zero dependencies).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SvgfmtTool = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function stripComments(svg) {
    return svg.replace(/<!--[\s\S]*?-->/g, "");
  }

  // Collapse whitespace between tags; leave attribute/value whitespace alone.
  function minify(svg) {
    if (typeof svg !== "string") throw new Error("svg must be a string");
    return stripComments(svg).replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
  }

  function isSvg(svg) {
    return typeof svg === "string" && /<svg[\s>]/.test(svg);
  }

  // Indent-aware pretty printer. Handles nested tags and interleaved text.
  function format(svg, indent) {
    const pad = indent === undefined || indent === null ? "  " : String(indent);
    if (typeof svg !== "string") throw new Error("svg must be a string");
    const clean = minify(svg);
    const tagRe = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
    let out = "";
    let depth = 0;
    let last = 0;
    let m;
    while ((m = tagRe.exec(clean))) {
      const text = clean.slice(last, m.index).replace(/\s+/g, " ").trim();
      last = tagRe.lastIndex;
      const [, closing, name, attrs, selfClose] = m;
      if (text) out += pad.repeat(depth) + text + "\n";
      if (closing) depth = Math.max(0, depth - 1);
      out += pad.repeat(depth) + `<${closing}${name}${attrs}${selfClose ? "/" : ""}>\n`;
      if (!closing && !selfClose) depth += 1;
    }
    const tail = clean.slice(last).trim();
    if (tail) out += tail + "\n";
    return out.replace(/\n+$/, "\n");
  }

  function summary(svg) {
    const clean = minify(svg);
    const bytes = Buffer.byteLength(clean, "utf8");
    const tags = (clean.match(/<[a-zA-Z/]/g) || []).length;
    return { bytes, tags, isSvg: isSvg(svg) };
  }

  return { minify, format, isSvg, summary };
});
