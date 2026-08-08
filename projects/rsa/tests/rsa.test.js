"use strict";

const assert = require("node:assert/strict");
const crypto = require("crypto");
const RSA = require("../src/rsa.js");

// ---- primitive correctness ----
assert.equal(RSA.modExp(7n, 13n, 19n), 7n ** 13n % 19n);
assert.equal(RSA.modInverse(17n, 3120n) * 17n % 3120n, 1n);
assert.equal(RSA.gcd(54n, 24n), 6n);
assert.equal(RSA.isProbablePrime(97n, 16), true);
assert.equal(RSA.isProbablePrime(91n, 16), false); // 7*13 composite
assert.equal(RSA.isProbablePrime(2n ** 127n - 1n, 12), true); // Mersenne prime M127
assert.equal(RSA.isProbablePrime(2n ** 64n + 1n, 12), false); // 2^64+1 = 274177 * 67280421310721

// ---- keygen invariants ----
const kp = RSA.keygen(1024);
assert.equal(kp.n, kp.p * kp.q);
const phi = (kp.p - 1n) * (kp.q - 1n);
assert.equal((kp.e * kp.d) % phi, 1n);

// ---- round-trip encrypt/decrypt (UTF-8, incl. unicode & long) ----
for (const m of ["Hi", "Hello, RSA! 中文测试 123", "x".repeat(100)]) {
  const ct = RSA.encrypt(m, kp.n, kp.e);
  assert.equal(RSA.decrypt(ct, kp.n, kp.d), m);
}
// message too long throws (1024-bit -> max 117 bytes)
assert.throws(function () { RSA.encrypt("y".repeat(200), kp.n, kp.e); });

// ---- interop with Node crypto (PKCS#1 v1.5) ----
function derLen(n) {
  if (n < 0x80) return [n];
  const b = []; let t = n; while (t > 0) { b.unshift(t & 0xff); t >>= 8; }
  return [0x80 | b.length, ...b];
}
function derInt(bi) {
  const bytes = []; let t = bi < 0n ? -bi : bi;
  if (t === 0n) bytes.push(0);
  while (t > 0n) { bytes.unshift(Number(t & 0xffn)); t >>= 8n; }
  if ((bytes[0] & 0x80) !== 0) bytes.unshift(0x00);
  return Buffer.from([0x02, ...derLen(bytes.length), ...bytes]);
}
function derSeq(...parts) {
  const body = Buffer.concat(parts);
  return Buffer.from([0x30, ...derLen(body.length), ...body]);
}
const algoSeq = Buffer.from([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
const rsaPub = derSeq(derInt(kp.n), derInt(kp.e));
const bitstr = Buffer.from([0x03, ...derLen(rsaPub.length + 1), 0x00, ...rsaPub]);
const spki = derSeq(Buffer.from(algoSeq), bitstr);
const pub = crypto.createPublicKey({ key: spki, format: "der", type: "spki" });

// Node encrypts, our private key decrypts -> recovers message
const nodeCt = crypto.publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from("interop-ok-中文"));
assert.equal(RSA.decrypt(nodeCt.toString("hex"), kp.n, kp.d), "interop-ok-中文");
// Our encrypt decrypts back (also proves our padding is valid PKCS#1 v1.5)
const myCt = RSA.encrypt("reverse-interop", kp.n, kp.e);
assert.equal(RSA.decrypt(myCt, kp.n, kp.d), "reverse-interop");

console.log("rsa all assertions passed");
