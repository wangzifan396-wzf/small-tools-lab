// svgfmt — SVG pretty-printer & minifier (UMD, zero dependencies).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SvgfmtTool = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function findMarkupEnd(source, start) {
    let quote = "";
    let bracketDepth = 0;
    for (let i = start; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "[") bracketDepth += 1;
      else if (ch === "]" && bracketDepth > 0) bracketDepth -= 1;
      else if (ch === ">" && bracketDepth === 0) return i + 1;
    }
    throw new Error("标签未闭合");
  }

  function tokenize(svg) {
    const tokens = [];
    let i = 0;
    while (i < svg.length) {
      const lt = svg.indexOf("<", i);
      if (lt < 0) {
        if (i < svg.length) tokens.push({ type: "text", value: svg.slice(i) });
        break;
      }
      if (lt > i) tokens.push({ type: "text", value: svg.slice(i, lt) });
      if (svg.startsWith("<!--", lt)) {
        const end = svg.indexOf("-->", lt + 4);
        if (end < 0) throw new Error("注释未闭合");
        tokens.push({ type: "comment", value: svg.slice(lt, end + 3) });
        i = end + 3;
        continue;
      }
      if (svg.startsWith("<![CDATA[", lt)) {
        const end = svg.indexOf("]]>", lt + 9);
        if (end < 0) throw new Error("CDATA 未闭合");
        tokens.push({ type: "cdata", value: svg.slice(lt, end + 3) });
        i = end + 3;
        continue;
      }
      const end = findMarkupEnd(svg, lt + 1);
      const value = svg.slice(lt, end);
      const match = /^<\s*(\/?)\s*([A-Za-z][\w:.-]*)/.exec(value);
      tokens.push({
        type: match ? "tag" : "declaration",
        value,
        closing: !!(match && match[1]),
        name: match ? match[2].toLowerCase() : "",
        selfClosing: !!(match && /\/\s*>$/.test(value)),
      });
      i = end;
    }
    return tokens;
  }

  function compactTag(tag) {
    let out = "";
    let quote = "";
    let pendingSpace = false;
    for (let i = 0; i < tag.length; i++) {
      const ch = tag[i];
      if (quote) {
        out += ch;
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'") {
        if (pendingSpace && out && !/[<\s=]/.test(out[out.length - 1])) out += " ";
        pendingSpace = false;
        quote = ch;
        out += ch;
      } else if (/\s/.test(ch)) {
        pendingSpace = true;
      } else {
        if (pendingSpace && out && !/[<\s=]/.test(out[out.length - 1]) && !/[=>/]/.test(ch)) out += " ";
        pendingSpace = false;
        if (ch === "=" && out.endsWith(" ")) out = out.slice(0, -1);
        out += ch;
      }
    }
    return out;
  }

  function minify(svg) {
    if (typeof svg !== "string") throw new Error("svg must be a string");
    return tokenize(svg).filter((token) => token.type !== "comment").map((token) => {
      return token.type === "tag" ? compactTag(token.value) : token.value;
    }).join("").trim();
  }

  function isSvg(svg) {
    return typeof svg === "string" && /<svg[\s>]/i.test(svg);
  }

  function validateStructure(tokens) {
    const stack = [];
    for (const token of tokens) {
      if (token.type !== "tag" || token.selfClosing) continue;
      if (!token.closing) {
        stack.push(token.name);
        continue;
      }
      const expected = stack.pop();
      if (expected !== token.name) {
        throw new Error("标签不匹配: 期望 </" + (expected || "空") + ">，收到 </" + token.name + ">");
      }
    }
    if (stack.length) throw new Error("标签未闭合: " + stack[stack.length - 1]);
  }

  function format(svg, indent) {
    const pad = indent === undefined || indent === null ? "  " : String(indent);
    if (typeof svg !== "string") throw new Error("svg must be a string");
    const clean = minify(svg);
    const tokens = tokenize(clean).filter((token) => token.type !== "comment");
    validateStructure(tokens);
    const textContainers = new Set(["text", "tspan", "textpath", "title", "desc", "style", "script"]);
    const lines = [];
    let depth = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === "text" && !token.value.trim()) continue;
      if (token.type !== "tag") {
        lines.push(pad.repeat(depth) + token.value);
        continue;
      }
      if (!token.closing && !token.selfClosing && textContainers.has(token.name)) {
        let nested = 1;
        let end = i;
        while (++end < tokens.length && nested > 0) {
          const candidate = tokens[end];
          if (candidate.type === "tag" && candidate.name === token.name) {
            if (candidate.closing) nested -= 1;
            else if (!candidate.selfClosing) nested += 1;
          }
        }
        if (nested !== 0) throw new Error("标签未闭合: " + token.name);
        lines.push(pad.repeat(depth) + tokens.slice(i, end + 1).map((part) => part.value).join(""));
        i = end;
        continue;
      }
      if (token.closing) depth = Math.max(0, depth - 1);
      lines.push(pad.repeat(depth) + token.value);
      if (!token.closing && !token.selfClosing) depth += 1;
    }
    return lines.join("\n").replace(/\n+$/, "") + "\n";
  }

  function byteLength(value) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
    return unescape(encodeURIComponent(value)).length;
  }

  function summary(svg) {
    const clean = minify(svg);
    const bytes = byteLength(clean);
    const tags = (clean.match(/<[a-zA-Z/]/g) || []).length;
    return { bytes, tags, isSvg: isSvg(svg) };
  }

  return { minify, format, isSvg, summary };
});
