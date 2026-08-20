"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { webcrypto } = require("node:crypto");
const J = require("../src/core.js");

function segment(value) { return J.bytesToB64url(new TextEncoder().encode(JSON.stringify(value))); }
function unsigned(header, payload) { const a = segment(header), b = segment(payload); return `${a}.${b}.`; }

test("parses compact JWT and preserves signing input", () => {
  const parsed = J.parseToken(unsigned({ alg: "RS256", kid: "k1" }, { sub: "alice", exp: 2000 }));
  assert.equal(parsed.header.kid, "k1"); assert.equal(parsed.payload.sub, "alice"); assert.match(parsed.signingInput, /^ey/);
});

test("rejects malformed or non-object JWT segments", () => {
  assert.throws(() => J.parseToken("one.two"), /header, payload, and signature/);
  assert.throws(() => J.parseToken(`${segment([])}.${segment({})}.x`), /header must be/);
});

test("selects a signing key by kid and reports missing keys", () => {
  const header = { alg: "RS256", kid: "new" };
  const keys = { keys: [{ kty: "RSA", kid: "old", alg: "RS256", use: "sig" }, { kty: "RSA", kid: "new", alg: "RS256", use: "sig" }] };
  assert.equal(J.selectJwk(header, keys).key.kid, "new");
  assert.equal(J.selectJwk({ alg: "RS256", kid: "missing" }, keys).key, null);
});

test("audits expiry, issuer, audience, and unsafe header hints", () => {
  const report = J.inspect(unsigned({ alg: "none", jku: "https://evil.test/jwks" }, { exp: 900, iss: "other", aud: "web" }), { now: 1000, issuer: "expected", audience: "api", clockSkew: 0 });
  const codes = [...report.headerFindings, ...report.claimFindings].map((x) => x.code);
  assert.ok(codes.includes("header.alg-unsafe")); assert.ok(codes.includes("header.remote-key-hint")); assert.ok(codes.includes("claims.expired")); assert.ok(codes.includes("claims.issuer-mismatch")); assert.ok(codes.includes("claims.audience-mismatch"));
});

test("verifies an RS256 signature with a local JWK", async () => {
  const pair = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey); jwk.kid = "test"; jwk.alg = "RS256"; jwk.use = "sig";
  const header = segment({ alg: "RS256", kid: "test", typ: "JWT" }); const payload = segment({ sub: "alice", exp: Math.floor(Date.now() / 1000) + 300 }); const input = `${header}.${payload}`;
  const sig = await webcrypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, pair.privateKey, new TextEncoder().encode(input));
  const report = await J.verify(`${input}.${J.bytesToB64url(new Uint8Array(sig))}`, { keys: [jwk] }, {});
  assert.equal(report.signatureValid, true); assert.equal(report.summary.errors, 0);
});

test("formats a report without exposing token segments", () => {
  const report = J.inspect(unsigned({ alg: "HS256" }, { sub: "alice" }), {}); const markdown = J.formatMarkdown(report);
  assert.match(markdown, /JWT Trust report/); assert.doesNotMatch(markdown, /eyJ/);
});
