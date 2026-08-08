// nato.js — zero-dependency NATO phonetic alphabet converter (UMD)
// Encode text -> NATO phonetic words; decode phonetic words -> text.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Nato = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ICAO / NATO phonetic alphabet (26 letters + 10 digits).
  var CODE = {
    A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
    G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima",
    M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
    S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
    X: "X-ray", Y: "Yankee", Z: "Zulu",
    0: "Zero", 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five",
    6: "Six", 7: "Seven", 8: "Eight", 9: "Nine",
  };

  // Reverse lookup, case-insensitive, keyed by lowercased word.
  var REV = {};
  Object.keys(CODE).forEach(function (k) {
    REV[CODE[k].toLowerCase()] = k;
  });

  // Characters that pass through as-is in encoding (space, punctuation).
  function isPassthrough(ch) {
    return /[^A-Za-z0-9]/.test(ch);
  }

  // Encode a string into NATO words.
  // opts.sep: separator inserted between adjacent letter/digit words (default " ").
  // Spaces/punctuation are kept inline (no extra separator around them), so the
  // result stays readable; they are preserved literally in the output.
  function encode(text, opts) {
    opts = opts || {};
    var sep = opts.sep === undefined ? " " : opts.sep;
    var res = "";
    var prevWord = false;
    var chars = String(text).split("");
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      var up = ch.toUpperCase();
      if (CODE[up]) {
        if (res && prevWord) res += sep;
        res += CODE[up];
        prevWord = true;
      } else {
        res += ch;
        prevWord = false;
      }
    }
    return res;
  }

  // Decode NATO words back into text.
  // Accepts words separated by spaces/commas; case-insensitive.
  // Literal punctuation/space tokens are preserved.
  function decode(phonetic) {
    var raw = String(phonetic).replace(/,/g, " ");
    var toks = raw.split(/\s+/).filter(function (t) { return t.length > 0; });
    var out = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      var key = t.toLowerCase();
      if (REV[key] !== undefined) {
        out.push(REV[key]);
      } else {
        out.push(t); // punctuation / unknown -> keep
      }
    }
    return out.join("");
  }

  return { CODE: CODE, REV: REV, encode: encode, decode: decode };
});
