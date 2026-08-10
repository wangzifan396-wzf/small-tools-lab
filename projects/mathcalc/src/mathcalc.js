(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.MathCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Constants
  var CONSTANTS = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2,
    phi: (1 + Math.sqrt(5)) / 2,
  };

  // Single-arg math functions
  var FUNCS1 = {
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    ln: Math.log,
    log: Math.log10,
    log2: Math.log2,
    log10: Math.log10,
    exp: Math.exp,
    trunc: Math.trunc,
  };

  // Multi-arg math functions (variadic / 2-arg)
  var FUNCSN = {
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
    atan2: Math.atan2,
    hypot: Math.hypot,
  };

  // ---- Tokenizer ----
  // Tokens: number | ident | op | lparen | rparen | comma
  function tokenize(src) {
    var s = String(src);
    var tokens = [];
    var i = 0;
    var re = /\s*([0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?|[A-Za-z_][A-Za-z0-9_]*|[+\-*/%^(),])/g;
    var m;
    var end = 0;
    while ((m = re.exec(s)) !== null) {
      var t = m[1];
      if (/^[0-9.]/.test(t)) {
        tokens.push({ t: "num", v: parseFloat(t) });
      } else if (/^[A-Za-z_]/.test(t)) {
        tokens.push({ t: "ident", v: t });
      } else {
        if (t === "(") tokens.push({ t: "lparen" });
        else if (t === ")") tokens.push({ t: "rparen" });
        else if (t === ",") tokens.push({ t: "comma" });
        else tokens.push({ t: "op", v: t });
      }
      end = m.index + m[0].length;
    }
    // detect trailing junk (non-whitespace chars the regex did not consume)
    var rest = s.slice(end).trim();
    if (rest) throw new Error("无法识别的字符: " + rest[0]);
    return tokens;
  }

  // ---- Recursive-descent parser (Pratt for + - * / % ^) ----
  function Parser(tokens) {
    this.toks = tokens;
    this.pos = 0;
  }
  Parser.prototype.peek = function () {
    return this.toks[this.pos];
  };
  Parser.prototype.next = function () {
    return this.toks[this.pos++];
  };
  Parser.prototype.eat = function (type) {
    var tk = this.toks[this.pos];
    if (!tk || tk.t !== type) throw new Error("语法错误：期望 " + type);
    this.pos++;
    return tk;
  };

  // expression ::= term (('+'|'-') term)*
  Parser.prototype.parseExpr = function () {
    var left = this.parseTerm();
    var tk;
    while ((tk = this.peek()) && tk.t === "op" && (tk.v === "+" || tk.v === "-")) {
      this.next();
      var right = this.parseTerm();
      left = { op: tk.v, a: left, b: right };
    }
    return left;
  };

  // term ::= factor (('*'|'/'|'%') factor)*
  Parser.prototype.parseTerm = function () {
    var left = this.parseFactor();
    var tk;
    while ((tk = this.peek()) && tk.t === "op" && (tk.v === "*" || tk.v === "/" || tk.v === "%")) {
      this.next();
      var right = this.parseFactor();
      left = { op: tk.v, a: left, b: right };
    }
    return left;
  };

  // factor ::= unary ((^) unary)?   (right-associative)
  Parser.prototype.parseFactor = function () {
    var left = this.parseUnary();
    var tk = this.peek();
    if (tk && tk.t === "op" && tk.v === "^") {
      this.next();
      var right = this.parseFactor(); // right assoc
      left = { op: "^", a: left, b: right };
    }
    return left;
  };

  // unary ::= ('+'|'-') unary | primary
  Parser.prototype.parseUnary = function () {
    var tk = this.peek();
    if (tk && tk.t === "op" && (tk.v === "-" || tk.v === "+")) {
      this.next();
      var node = this.parseUnary();
      return tk.v === "-" ? { op: "neg", a: node } : node;
    }
    return this.parsePrimary();
  };

  // primary ::= num | ident ( '(' args ')' )? | '(' expr ')'
  Parser.prototype.parsePrimary = function () {
    var tk = this.peek();
    if (!tk) throw new Error("表达式不完整");
    if (tk.t === "num") {
      this.next();
      return { num: tk.v };
    }
    if (tk.t === "lparen") {
      this.next();
      var e = this.parseExpr();
      this.eat("rparen");
      return e;
    }
    if (tk.t === "ident") {
      this.next();
      var name = tk.v;
      var nxt = this.peek();
      if (nxt && nxt.t === "lparen") {
        this.next();
        var args = [];
        if (this.peek() && this.peek().t !== "rparen") {
          args.push(this.parseExpr());
          while (this.peek() && this.peek().t === "comma") {
            this.next();
            args.push(this.parseExpr());
          }
        }
        this.eat("rparen");
        return { call: name.toLowerCase(), args: args };
      }
      return { var: name.toLowerCase() };
    }
    throw new Error("无法解析的记号: " + tk.v);
  };

  function evalNode(node) {
    if (node.num !== undefined) return node.num;
    if (node.op) {
      if (node.op === "neg") return -evalNode(node.a);
      var a = evalNode(node.a);
      var b = evalNode(node.b);
      switch (node.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "%": return a % b;
        case "^": return Math.pow(a, b);
      }
    }
    if (node.var) {
      if (CONSTANTS.hasOwnProperty(node.var)) return CONSTANTS[node.var];
      throw new Error("未知变量或函数: " + node.var);
    }
    if (node.call) {
      var fn = node.call;
      var args = node.args.map(evalNode);
      if (FUNCS1[fn]) {
        if (args.length !== 1) throw new Error("函数 " + fn + " 需要 1 个参数");
        return FUNCS1[fn](args[0]);
      }
      if (FUNCSN[fn]) {
        if (args.length < 1) throw new Error("函数 " + fn + " 参数不足");
        return FUNCSN[fn].apply(null, args);
      }
      throw new Error("未知函数: " + fn);
    }
    throw new Error("无法求值的节点");
  }

  // Public: evaluate an expression string -> number
  function evaluate(expr) {
    var tokens = tokenize(expr);
    if (tokens.length === 0) throw new Error("空表达式");
    var parser = new Parser(tokens);
    var ast = parser.parseExpr();
    if (parser.pos !== tokens.length) {
      throw new Error("表达式存在多余内容");
    }
    var val = evalNode(ast);
    if (typeof val !== "number" || !isFinite(val)) {
      if (typeof val !== "number") throw new Error("计算结果不是数字");
      // Infinity / NaN
      if (Number.isNaN(val)) return "NaN";
      return val > 0 ? "Infinity" : "-Infinity";
    }
    return val;
  }

  // Pretty format a number (trim float noise)
  function format(val, decimals) {
    if (typeof val === "string") return val;
    if (decimals === undefined) decimals = 6;
    if (Number.isInteger(val)) return String(val);
    var r = parseFloat(val.toFixed(decimals));
    return String(r);
  }

  return {
    evaluate: evaluate,
    format: format,
    tokenize: tokenize,
    constants: CONSTANTS,
    funcs1: Object.keys(FUNCS1),
    funcsN: Object.keys(FUNCSN),
  };
});
