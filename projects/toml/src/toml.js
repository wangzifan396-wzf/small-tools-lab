(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.TOML = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------------- Tokenizer ----------------
  var ESC_MAP = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\" };
  function readEscape(src, k) {
    var e = src[k + 1];
    if (ESC_MAP[e] !== undefined) return { s: ESC_MAP[e], next: k + 2 };
    if (e === "u") return { s: String.fromCharCode(parseInt(src.substr(k + 2, 4), 16)), next: k + 6 };
    if (e === "U") return { s: String.fromCodePoint(parseInt(src.substr(k + 2, 8), 16)), next: k + 10 };
    return { s: "\\" + e, next: k + 2 }; // lenient: keep unknown escape as-is
  }

  function tokenize(src) {
    var i = 0, n = src.length, toks = [];
    var WS = " \t\r";
    function isWS(c) { return WS.indexOf(c) >= 0; }
    var STOP = " \t\r\n=,#[]{}";
    while (i < n) {
      var c = src[i];
      if (c === "\n") { toks.push({ t: "NL" }); i++; continue; }
      if (isWS(c)) { i++; continue; }
      if (c === "#") { while (i < n && src[i] !== "\n") i++; continue; }
      if (c === "=") { toks.push({ t: "EQ" }); i++; continue; }
      if (c === ",") { toks.push({ t: "COMMA" }); i++; continue; }
      if (c === "[") { toks.push({ t: "LBR" }); i++; continue; }
      if (c === "]") { toks.push({ t: "RBR" }); i++; continue; }
      if (c === "{") { toks.push({ t: "LBC" }); i++; continue; }
      if (c === "}") { toks.push({ t: "RBC" }); i++; continue; }
      if (c === '"') { i = tokString(src, i, n, toks, false); continue; }
      if (c === "'") { i = tokString(src, i, n, toks, true); continue; }
      // bare token
      var j = i;
      while (j < n && STOP.indexOf(src[j]) < 0 && src[j] !== '"' && src[j] !== "'") j++;
      toks.push({ t: "BARE", v: src.slice(i, j) });
      i = j;
    }
    return toks;
  }

  function tokString(src, i, n, toks, literal) {
    if (!literal && src[i + 1] === '"' && src[i + 2] === '"') {
      // multiline basic
      var k = i + 3;
      if (src[k] === "\n") k++; else if (src[k] === "\r" && src[k + 1] === "\n") k += 2;
      var buf = "";
      while (k < n) {
        if (src[k] === '"' && src[k + 1] === '"' && src[k + 2] === '"') {
          if (buf.charAt(buf.length - 1) === "\n") buf = buf.slice(0, -1);
          toks.push({ t: "STR", v: buf }); return k + 3;
        }
        if (src[k] === "\\") {
          if (src[k + 1] === "\n") { k += 2; while (k < n && (src[k] === " " || src[k] === "\t")) k++; continue; }
          if (src[k + 1] === "\r" && src[k + 2] === "\n") { k += 3; while (k < n && (src[k] === " " || src[k] === "\t")) k++; continue; }
          var r = readEscape(src, k);
          buf += r.s; k = r.next; continue;
        }
        buf += src[k]; k++;
      }
      throw new Error("多行字符串未闭合");
    }
    if (literal && src[i + 1] === "'" && src[i + 2] === "'") {
      var m = i + 3;
      if (src[m] === "\n") m++; else if (src[m] === "\r" && src[m + 1] === "\n") m += 2;
      var lb = "";
      while (m < n) {
        if (src[m] === "'" && src[m + 1] === "'" && src[m + 2] === "'") {
          if (lb.charAt(lb.length - 1) === "\n") lb = lb.slice(0, -1);
          toks.push({ t: "STR", v: lb }); return m + 3;
        }
        lb += src[m]; m++;
      }
      throw new Error("多行字面量字符串未闭合");
    }
    if (!literal) {
      var p = i + 1, sb = "";
      while (p < n && src[p] !== '"') {
        if (src[p] === "\\") {
          var r2 = readEscape(src, p);
          sb += r2.s; p = r2.next;
        } else { sb += src[p]; p++; }
      }
      if (p >= n) throw new Error("字符串未闭合");
      toks.push({ t: "STR", v: sb });
      return p + 1;
    } else {
      var q = i + 1, lb2 = "";
      while (q < n && src[q] !== "'") { lb2 += src[q]; q++; }
      if (q >= n) throw new Error("字面量字符串未闭合");
      toks.push({ t: "STR", v: lb2 });
      return q + 1;
    }
  }

  // ---------------- Value parsing ----------------
  var INT_RE = /^([+-]?)(0x[0-9a-fA-F_]+|0o[0-7_]+|0b[01_]+|[0-9_]+)$/;
  var FLOAT_RE = /^([+-]?)((?:[0-9_]+\.[0-9_]*|[0-9_]*\.[0-9_]+)(?:[eE][+-]?[0-9_]+)?|[0-9_]+[eE][+-]?[0-9_]+)$/;
  var OFFSET_DT = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  var LOCAL_DT = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
  var LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
  var LOCAL_TIME = /^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

  function parseNumber(bare) {
    if (/^([+-]?)(inf|nan)$/i.test(bare)) {
      var low = bare.toLowerCase();
      if (low === "inf" || low === "+inf") return Infinity;
      if (low === "-inf") return -Infinity;
      return NaN;
    }
    if (FLOAT_RE.test(bare)) return parseFloat(bare.replace(/_/g, ""));
    if (INT_RE.test(bare)) {
      var s = bare.replace(/_/g, "");
      if (/^0x/i.test(s)) return parseInt(s.slice(2), 16);
      if (/^0o/i.test(s)) return parseInt(s.slice(2), 8);
      if (/^0b/i.test(s)) return parseInt(s.slice(2), 2);
      return parseInt(s, 10);
    }
    return undefined;
  }

  function parseBareValue(bare) {
    var low = bare.toLowerCase();
    if (low === "true") return true;
    if (low === "false") return false;
    if (low === "inf" || low === "+inf" || low === "-inf" || low === "nan") return parseNumber(bare);
    if (OFFSET_DT.test(bare) || LOCAL_DT.test(bare) || LOCAL_DATE.test(bare) || LOCAL_TIME.test(bare)) {
      return bare.replace(" ", "T");
    }
    var num = parseNumber(bare);
    if (num !== undefined) return num;
    return undefined;
  }

  // ---------------- Parser ----------------
  function Parser(toks) { this.toks = toks; this.pos = 0; }
  Parser.prototype.peek = function () { return this.toks[this.pos]; };
  Parser.prototype.next = function () { return this.toks[this.pos++]; };
  Parser.prototype.expect = function (type) {
    var tk = this.toks[this.pos];
    if (!tk || tk.t !== type) throw new Error("语法错误：期望 " + type);
    this.pos++; return tk;
  };

  // parse a single key token (STR or BARE); BARE may contain dots -> return array of parts
  Parser.prototype.parseKeyToken = function () {
    var tk = this.toks[this.pos];
    if (!tk) throw new Error("缺少键名");
    if (tk.t === "STR") { this.pos++; return [tk.v]; }
    if (tk.t === "BARE") { this.pos++; return tk.v.split("."); }
    throw new Error("无效的键名");
  };

  // parse dotted key path -> array of strings
  Parser.prototype.parseKeyPath = function () {
    return this.parseKeyToken();
  };

  // parse an array until RBR
  Parser.prototype.parseArray = function () {
    this.expect("LBR");
    var arr = [];
    if (this.peek() && this.peek().t === "RBR") { this.next(); return arr; }
    for (;;) {
      arr.push(this.parseValue());
      var tk = this.peek();
      if (!tk) throw new Error("数组未闭合");
      if (tk.t === "COMMA") { this.next(); continue; }
      if (tk.t === "RBR") { this.next(); break; }
      throw new Error("数组语法错误");
    }
    return arr;
  };

  // parse inline table until RBC
  Parser.prototype.parseInlineTable = function () {
    this.expect("LBC");
    var obj = {};
    if (this.peek() && this.peek().t === "RBC") { this.next(); return obj; }
    for (;;) {
      var keys = this.parseKeyPath();
      this.expect("EQ");
      var val = this.parseValue();
      setDotted(obj, keys, val);
      var tk = this.peek();
      if (!tk) throw new Error("内联表未闭合");
      if (tk.t === "COMMA") { this.next(); continue; }
      if (tk.t === "RBC") { this.next(); break; }
      throw new Error("内联表语法错误");
    }
    return obj;
  };

  Parser.prototype.parseValue = function () {
    var tk = this.peek();
    if (!tk) throw new Error("缺少值");
    if (tk.t === "STR") { this.next(); return tk.v; }
    if (tk.t === "LBR") return this.parseArray();
    if (tk.t === "LBC") return this.parseInlineTable();
    if (tk.t === "BARE") {
      this.next();
      var v = parseBareValue(tk.v);
      if (v === undefined) throw new Error("无法解析的值: " + tk.v);
      return v;
    }
    throw new Error("无法解析的值");
  };

  function setDotted(obj, keys, val) {
    var cur = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== "object" || Array.isArray(cur[k])) {
        cur[k] = {};
      }
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = val;
  }

  function getOrCreateTable(root, keys) {
    var cur = root;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== "object" || Array.isArray(cur[k])) {
        cur[k] = {};
      }
      cur = cur[k];
    }
    return cur;
  }

  function parse(src) {
    var toks = tokenize(src);
    var parser = new Parser(toks);
    var root = {};
    var current = root;
    while (parser.pos < toks.length) {
      // skip newlines
      if (parser.peek().t === "NL") { parser.next(); continue; }
      var tk = parser.peek();
      if (tk.t === "LBR") {
        if (parser.toks[parser.pos + 1] && parser.toks[parser.pos + 1].t === "LBR") {
          // array of tables
          parser.next(); parser.next();
          var aKeys = parser.parseKeyPath();
          parser.expect("RBR"); parser.expect("RBR");
          var parent = getOrCreateTable(root, aKeys.slice(0, -1));
          var lastKey = aKeys[aKeys.length - 1];
          var existing = parent[lastKey];
          var arr;
          if (Array.isArray(existing)) {
            arr = existing;
          } else if (existing && typeof existing === "object") {
            // a single [table] was defined earlier -> becomes the first array element
            arr = [existing];
            parent[lastKey] = arr;
          } else {
            arr = [];
            parent[lastKey] = arr;
          }
          var obj = {};
          arr.push(obj);
          current = obj;
        } else {
          parser.next();
          var tKeys = parser.parseKeyPath();
          parser.expect("RBR");
          current = getOrCreateTable(root, tKeys);
        }
      } else if (tk.t === "BARE" || tk.t === "STR") {
        var keys = parser.parseKeyPath();
        parser.expect("EQ");
        var val = parser.parseValue();
        setDotted(current, keys, val);
      } else {
        throw new Error("无法解析的顶层记号");
      }
      // consume trailing newline(s)
      while (parser.peek() && parser.peek().t === "NL") parser.next();
    }
    return root;
  }

  // ---------------- Serializer (JSON -> TOML) ----------------
  function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }

  function formatString(s) {
    // use basic string with escapes
    return '"' + String(s)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r") + '"';
  }

  function formatValue(v) {
    if (typeof v === "string") return formatString(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") {
      if (!isFinite(v)) return v > 0 ? "inf" : (v < 0 ? "-inf" : "nan");
      return String(v);
    }
    // datetime strings / others
    return String(v);
  }

  function formatArray(arr) {
    return "[" + arr.map(function (e) {
      if (isPlainObject(e) || (Array.isArray(e) && e.length && e.every(isPlainObject))) {
        throw new Error("数组元素不能是对象（请改用数组表）");
      }
      return formatValue(e);
    }).join(", ") + "]";
  }

  function isArrayOfTables(v) {
    return Array.isArray(v) && v.length > 0 && v.every(isPlainObject);
  }

  // emit key-value lines (scalars + scalar arrays) for a table body
  function emitScalars(obj, lines) {
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (isPlainObject(v) || isArrayOfTables(v)) return; // handled as tables
      if (Array.isArray(v)) lines.push(k + " = " + formatArray(v));
      else lines.push(k + " = " + formatValue(v));
    });
  }

  // recursively emit a table (header like "a.b") into lines
  function emitTable(header, obj, lines) {
    emitScalars(obj, lines);
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      var h = header === "" ? k : header + "." + k;
      if (isArrayOfTables(v)) {
        v.forEach(function (item) {
          lines.push("");
          lines.push("[[" + h + "]]");
          emitTable(h, item, lines);
        });
      } else if (isPlainObject(v)) {
        lines.push("");
        lines.push("[" + h + "]");
        emitTable(h, v, lines);
      }
    });
  }

  function stringify(obj) {
    if (!isPlainObject(obj)) throw new Error("顶层必须是对象");
    var lines = [];
    emitTable("", obj, lines);
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "") + "\n";
  }

  return {
    parse: parse,
    stringify: stringify,
    tokenize: tokenize,
  };
});
