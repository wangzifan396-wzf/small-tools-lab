"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const T = require("../src/totp.js");

const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

// 1. SHA digests match Node's reference implementation
for (const [algo, fn] of [["sha1", T.sha1], ["sha256", T.sha256], ["sha512", T.sha512]]) {
  for (const msg of ["", "abc", "The quick brown fox jumps over the lazy dog", "a".repeat(1000)]) {
    const ref = crypto.createHash(algo).update(msg).digest("hex");
    assert.strictEqual(hex(fn(T.utf8ToBytes(msg))), ref, `${algo}(${JSON.stringify(msg)}) digest`);
  }
}

// 2. HMAC matches Node's reference for every algorithm
for (const algo of ["sha1", "sha256", "sha512"]) {
  for (const [k, m] of [["key", "The quick brown fox jumps over the lazy dog"], ["", "x"], ["secret", ""]]) {
    const ref = crypto.createHmac(algo, Buffer.from(T.utf8ToBytes(k))).update(Buffer.from(T.utf8ToBytes(m))).digest();
    assert.strictEqual(hex(T.hmac(algo, T.utf8ToBytes(k), T.utf8ToBytes(m))), ref.toString("hex"), `hmac ${algo}`);
  }
}

// 3. RFC 6238 Appendix B vectors (ASCII secret, 8 digits, period 30, SHA-1)
const SEC = "12345678901234567890";
const vectors = [
  [59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"],
  [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"]
];
for (const [t, code] of vectors) {
  assert.strictEqual(T.totpToken(SEC, { t, digits: 8 }), code, `RFC6238 T=${t}`);
}

// 4. Base32 secret decoding (canonical RFC 4648)
assert.strictEqual(hex(T.base32Decode("MY")), "66", "base32 'MY' decodes to 0x66");

// 5. Previous/next code differs within a step and matches deterministic counter
const now = 1234567890;
const cur = T.totpToken(SEC, { t: now, digits: 6 });
const prev = T.totpToken(SEC, { t: now - 30, digits: 6 });
const nxt = T.totpToken(SEC, { t: now + 30, digits: 6 });
assert.notStrictEqual(cur, prev, "previous step yields a different code");
assert.notStrictEqual(cur, nxt, "next step yields a different code");

// 6. otpauth URI builder
const uri = T.otpUri({ issuer: "Acme", account: "me@acme.com", secret: "JBSWY3DPEHPK3PXP" });
assert.ok(uri.startsWith("otpauth://totp/"), "uri scheme");
assert.ok(uri.includes("secret=JBSWY3DPEHPK3PXP"), "uri carries secret");

console.log("totp: all assertions passed");
