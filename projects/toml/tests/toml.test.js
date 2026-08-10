"use strict";

const assert = require("node:assert/strict");
const T = require("../src/toml.js");

// 1. parse a representative TOML doc (covers most value types)
var doc = `
# comment line
title = "TOML 示例"
basics = '字面量字符串'
count = 42
neg = -7
big = 1_000_000
hex = 0xFF
oct = 0o17
bin = 0b1010
pi = 3.14
exp = 5e+22
ratio = 6.626e-34
flag = true
when = 1979-05-27T07:32:00Z
dateonly = 1979-05-27
timeonly = 07:32:00

[owner]
name = "Tom"
dob = 1979-05-27T07:32:00-07:00

[database]
enabled = true
ports = [ 8000, 8001, 8002 ]
data = [ ["gamma", "delta"], [1, 2] ]
meta = { cpu = 12.4, alive = true }

[products]            # table
name = "Hammer"

[[products]]          # array of tables
name = "Nail"

[server.ips]
v4 = "127.0.0.1"
`;
var obj = T.parse(doc);
assert.equal(obj.title, "TOML 示例");
assert.equal(obj.basics, "字面量字符串");
assert.equal(obj.count, 42);
assert.equal(obj.neg, -7);
assert.equal(obj.big, 1000000);
assert.equal(obj.hex, 255);
assert.equal(obj.oct, 15);
assert.equal(obj.bin, 10);
assert.ok(Math.abs(obj.pi - 3.14) < 1e-12);
assert.equal(obj.exp, 5e22);
assert.ok(Math.abs(obj.ratio - 6.626e-34) < 1e-40);
assert.equal(obj.flag, true);
assert.equal(obj.when, "1979-05-27T07:32:00Z");
assert.equal(obj.dateonly, "1979-05-27");
assert.equal(obj.timeonly, "07:32:00");
assert.equal(obj.owner.name, "Tom");
assert.equal(obj.owner.dob, "1979-05-27T07:32:00-07:00");
assert.equal(obj.database.enabled, true);
assert.deepEqual(obj.database.ports, [8000, 8001, 8002]);
assert.deepEqual(obj.database.data, [["gamma", "delta"], [1, 2]]);
assert.equal(obj.database.meta.cpu, 12.4);
assert.equal(obj.database.meta.alive, true);
assert.equal(obj.products[0].name, "Hammer");
assert.equal(obj.products[1].name, "Nail");
assert.equal(obj.server.ips.v4, "127.0.0.1");

// 2. dotted keys
var d = T.parse("a.b.c = 1\nx.y = 'hi'");
assert.equal(d.a.b.c, 1);
assert.equal(d.x.y, "hi");

// 3. multiline basic string with escapes
var m = T.parse('ml = """\n第一行\n第二行\\n转义\n"""');
assert.equal(m.ml, "第一行\n第二行\n转义");

// 4. inf / nan
var f = T.parse("a = inf\nb = -inf\nc = nan");
assert.equal(f.a, Infinity);
assert.equal(f.b, -Infinity);
assert.ok(Number.isNaN(f.c));

// 5. serialize simple object -> TOML, then parse back (round trip)
var src = { name: "test", count: 3, ratio: 0.5, flag: false, tags: ["x", "y"], nested: { a: 1, b: "two" } };
var tomlStr = T.stringify(src);
var back = T.parse(tomlStr);
assert.equal(back.name, "test");
assert.equal(back.count, 3);
assert.ok(Math.abs(back.ratio - 0.5) < 1e-12);
assert.equal(back.flag, false);
assert.deepEqual(back.tags, ["x", "y"]);
assert.equal(back.nested.a, 1);
assert.equal(back.nested.b, "two");
assert.ok(/\[nested\]/.test(tomlStr), "nested table header emitted");

// 6. array of tables round trip
var src2 = { items: [{ id: 1 }, { id: 2 }] };
var s2 = T.stringify(src2);
var back2 = T.parse(s2);
assert.equal(back2.items[0].id, 1);
assert.equal(back2.items[1].id, 2);
assert.ok(/\[\[items\]\]/.test(s2), "array-of-tables header emitted");

// 7. special keys remain data and cannot mutate Object.prototype
delete Object.prototype.polluted;
var protectedObj = T.parse("__proto__.polluted = true\nconstructor.name = 'data'");
assert.equal({}.polluted, undefined);
assert.equal(protectedObj.__proto__.polluted, true);
assert.equal(protectedObj.constructor.name, "data");
assert.equal(Object.getPrototypeOf(protectedObj), null);

// 8. duplicate keys and scalar/table collisions are rejected
assert.throws(function () { T.parse("answer = 1\nanswer = 2"); }, /重复键/);
assert.throws(function () { T.parse("item = 1\nitem.name = 'x'"); }, /不能用表覆盖已有值/);
assert.throws(function () { T.parse("item = 1\n[item]\nname = 'x'"); }, /不能用表覆盖已有值/);

console.log("toml all assertions passed");
