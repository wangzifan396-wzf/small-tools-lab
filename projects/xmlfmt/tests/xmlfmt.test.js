"use strict";

const assert = require("node:assert/strict");
const X = require("../src/xmlfmt.js");

// 1. beautify introduces newlines and indentation
const b = X.beautify("<note><to>T</to><from>F</from></note>");
assert.ok(b.includes("\n"), "beautify should introduce newlines");
assert.ok(/<note>/.test(b) && /<to>T<\/to>/.test(b), "structure preserved");

// 2. self-closing tags preserved without extra indent
const s = X.beautify('<root><item id="1"/><item id="2"/></root>');
assert.ok(/<item id="1"\/>/.test(s), "self-closing tag preserved");
assert.ok(/<root>/.test(s) && /<\/root>/.test(s), "root element preserved");

// 3. attribute strings (double + single quoted, with >) preserved
const a = X.beautify("<a b=\"x > y\" c='p'/>");
assert.ok(a.includes('b="x > y"'), "double-quoted attr with > preserved");
assert.ok(a.includes("c='p'"), "single-quoted attr preserved");

// 4. CDATA blocks are protected verbatim
const c = X.beautify("<r><![CDATA[1 < 2 & 3]]></r>");
assert.ok(c.includes("<![CDATA[1 < 2 & 3]]>"), "CDATA preserved");

// 5. minify removes inter-tag whitespace
assert.strictEqual(X.minify("<a>\n  <b>x</b>\n</a>"), "<a><b>x</b></a>");

// 6. minify drops comments
assert.strictEqual(X.minify("<!-- c --><a>x</a>"), "<a>x</a>");

// 7. empty / whitespace-only input
assert.strictEqual(X.beautify(""), "");
assert.strictEqual(X.minify("   "), "");

console.log("xmlfmt: all assertions passed");
