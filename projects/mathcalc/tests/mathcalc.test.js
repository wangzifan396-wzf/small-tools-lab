"use strict";

const assert = require("node:assert/strict");
const M = require("../src/mathcalc.js");

function ev(s) { return M.evaluate(s); }

// 1. basic arithmetic + precedence
assert.equal(ev("1 + 2 * 3"), 7);
assert.equal(ev("(1 + 2) * 3"), 9);
assert.equal(ev("10 - 4 - 3"), 3); // left assoc
assert.equal(ev("2 ^ 3 ^ 2"), 512); // right assoc -> 2^(3^2)
assert.equal(ev("-3 + 5"), 2);
assert.equal(ev("7 % 3"), 1);

// 2. decimals and parentheses
assert.ok(Math.abs(ev("0.1 + 0.2") - 0.3) < 1e-12);
assert.equal(ev("((2+3)*4)/2"), 10);

// 3. constants
assert.ok(Math.abs(ev("pi") - Math.PI) < 1e-12);
assert.ok(Math.abs(ev("2 * pi") - 2 * Math.PI) < 1e-12);
assert.ok(Math.abs(ev("e") - Math.E) < 1e-12);
assert.ok(Math.abs(ev("tau") - 2 * Math.PI) < 1e-12);
assert.ok(Math.abs(ev("phi") - (1 + Math.sqrt(5)) / 2) < 1e-12);

// 4. single-arg functions
assert.ok(Math.abs(ev("sqrt(16)") - 4) < 1e-12);
assert.equal(ev("abs(-7)"), 7);
assert.equal(ev("floor(3.9)"), 3);
assert.equal(ev("ceil(3.1)"), 4);
assert.equal(ev("round(2.5)"), 3);
assert.equal(ev("sign(-9)"), -1);
assert.ok(Math.abs(ev("sin(0)") - 0) < 1e-12);
assert.ok(Math.abs(ev("cos(0)") - 1) < 1e-12);
assert.ok(Math.abs(ev("ln(e)") - 1) < 1e-12);
assert.ok(Math.abs(ev("log(1000)") - 3) < 1e-9);
assert.ok(Math.abs(ev("log2(8)") - 3) < 1e-12);
assert.ok(Math.abs(ev("exp(0)") - 1) < 1e-12);

// 5. multi-arg functions
assert.equal(ev("max(1, 5, 3)"), 5);
assert.equal(ev("min(1, 5, 3)"), 1);
assert.ok(Math.abs(ev("pow(2, 10)") - 1024) < 1e-9);
assert.ok(Math.abs(ev("hypot(3, 4)") - 5) < 1e-12);
assert.ok(Math.abs(ev("atan2(1, 1)") - Math.PI / 4) < 1e-12);

// 6. nested + mixed
assert.ok(Math.abs(ev("sqrt( (3+1)^2 + 0 )") - 4) < 1e-12);
assert.ok(Math.abs(ev("2 * (sin(pi/2) + 1)") - 4) < 1e-12);

// 7. error handling
assert.throws(() => ev(""), /空表达式/);
assert.throws(() => ev("1 +"), /表达式不完整|语法|多余/);
assert.throws(() => ev("foo(1)"), /未知函数/);
assert.throws(() => ev("xyz"), /未知变量/);
assert.throws(() => ev("1 +* 2"), /语法|无法解析/);
assert.throws(() => ev("2 2"), /多余/);
assert.throws(() => ev("sqrt()"), /需要 1 个参数/);

// 8. format helper
assert.equal(M.format(42), "42");
assert.equal(M.format(3.1400001, 2), "3.14");

// 9. infinity / nan handling (division by zero)
assert.equal(ev("1 / 0"), "Infinity");

console.log("mathcalc all assertions passed");
