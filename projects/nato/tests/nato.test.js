"use strict";

const assert = require("node:assert/strict");
const N = require("../src/nato.js");

// 1. letter -> word
assert.equal(N.encode("A"), "Alfa");
assert.equal(N.encode("z"), "Zulu");

// 2. word -> letter (case-insensitive)
assert.equal(N.decode("Alfa"), "A");
assert.equal(N.decode("alfa"), "A");
assert.equal(N.decode("ZULU"), "Z");

// 3. phrase: letters/digits become words, space kept inline; decode recovers alphanumerics
var phrase = "SOS 123";
var enc = N.encode(phrase);
assert.equal(enc, "Sierra Oscar Sierra One Two Three");
// decode recovers the alphanumeric sequence (space not reconstructable via whitespace tokens)
assert.equal(N.decode(enc), "SOS123");

// 4. full alphabet encode/decode symmetry
var alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
var enc2 = N.encode(alpha, { sep: " " });
var dec2 = N.decode(enc2);
assert.equal(dec2, alpha);

// 5. comma-separated decode
assert.equal(N.decode("Alfa, Bravo"), "AB");

// 6. unknown/punctuation token preserved literally
assert.equal(N.decode("Alfa ?? Bravo"), "A??B");

console.log("nato all assertions passed");
