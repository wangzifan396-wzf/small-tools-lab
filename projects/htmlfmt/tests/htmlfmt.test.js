"use strict";

const assert = require("node:assert/strict");
const H = require("../src/htmlfmt.js");

// 1. beautify introduces newlines and indentation for nested tags
const b = H.beautify("<ul><li>a</li><li>b</li></ul>");
assert.ok(b.includes("\n"), "beautify should introduce newlines");
assert.ok(/<ul>/.test(b) && /<li>a<\/li>/.test(b), "nested structure preserved");

// 2. void elements are kept inline without breaking indent
const v = H.beautify('<div><br><img src="x.png"></div>');
assert.ok(/<br>/.test(v), "br preserved");
assert.ok(/<img src="x.png">/.test(v), "img preserved with attribute");

// 3. attribute strings containing > and & are preserved verbatim
const a = H.beautify('<a href="https://x.com?a=1&b=2">t</a>');
assert.ok(a.includes('href="https://x.com?a=1&b=2"'), "attribute string preserved");

// 4. script bodies (which may contain >) are protected
const sc = H.beautify("<script>var a = 1 > 0;</script>");
assert.ok(sc.includes("var a = 1 > 0;"), "script body preserved");

// 5. minify removes inter-tag whitespace
assert.strictEqual(H.minify("<ul>\n  <li>a</li>\n</ul>"), "<ul><li>a</li></ul>");

// 6. minify drops HTML comments
assert.strictEqual(H.minify("<!-- note --><p>x</p>"), "<p>x</p>");

// 7. minify keeps script blocks intact
assert.strictEqual(H.minify("<script>var a = 1 > 0;</script>"), "<script>var a = 1 > 0;</script>");

// 8. empty / whitespace-only input
assert.strictEqual(H.beautify("   "), "");
assert.strictEqual(H.minify(""), "");

console.log("htmlfmt: all assertions passed");
