import test from "node:test";
import assert from "node:assert/strict";
import { b64urlDecode, decodeSegment, parse, summarize } from "../src/core/jwt.js";
import { run } from "../src/cli.js";

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Encode a raw string (no JSON wrapping) for non-JSON segment tests.
function b64raw(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const HEADER = { alg: "HS256", typ: "JWT" };
const SIG = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

function makeToken(payload, header = HEADER) {
  return `${b64url(header)}.${b64url(payload)}.${SIG}`;
}

test("b64urlDecode round-trips UTF-8", () => {
  const enc = b64url({ name: "张三 🚀" });
  const dec = decodeSegment(enc);
  assert.equal(dec.ok, true);
  assert.equal(dec.value.name, "张三 🚀");
});

test("parse recognizes a well-formed JWT", () => {
  const t = makeToken({ sub: "123", name: "John", exp: 9999999999 });
  const r = parse(t);
  assert.equal(r.valid, true);
  assert.equal(r.error, null);
  assert.equal(r.header.alg, "HS256");
  assert.equal(r.payload.name, "John");
  assert.equal(r.hasSignature, true);
  assert.equal(r.claimCount, 3);
});

test("timing reports valid when exp is in the future", () => {
  const t = makeToken({ sub: "x", exp: 4102444800 }); // 2100-01-01
  const r = parse(t, new Date("2026-01-01").getTime());
  assert.equal(r.timing.hasExpiry, true);
  assert.equal(r.timing.status, "valid");
  assert.ok(r.timing.msUntilExp > 0);
  assert.equal(r.timing.expAt.startsWith("2100-"), true);
});

test("timing reports expired when exp is in the past", () => {
  const t = makeToken({ sub: "x", exp: 100 }); // 1970-01-01
  const r = parse(t, new Date("2026-01-01").getTime());
  assert.equal(r.timing.status, "expired");
  assert.ok(r.timing.msUntilExp < 0);
});

test("timing honors not-before (nbf)", () => {
  const t = makeToken({ sub: "x", nbf: 4102444800, exp: 4200000000 }); // both future
  const r = parse(t, new Date("2026-01-01").getTime());
  assert.equal(r.timing.notYet, true);
  assert.equal(r.timing.status, "not-yet");
});

test("token without exp is reported as no-exp", () => {
  const t = makeToken({ sub: "x" });
  const r = parse(t);
  assert.equal(r.timing.hasExpiry, false);
  assert.equal(r.timing.status, "no-exp");
});

test("unsigned token (empty signature) still parses", () => {
  const t = `${b64url(HEADER)}.${b64url({ sub: "x" })}.`;
  const r = parse(t);
  assert.equal(r.valid, true);
  assert.equal(r.hasSignature, false);
});

test("non-JWT input is rejected", () => {
  const r = parse("not-a-token");
  assert.equal(r.valid, false);
  assert.equal(r.error, "not-a-jwt");
  assert.equal(r.header, null);
});

test("decodeSegment flags non-JSON", () => {
  const d = decodeSegment(b64raw("this is not json"));
  assert.equal(d.ok, false);
  assert.ok(typeof d.raw === "string");
});

test("CLI summarize prints algorithm and expiry", () => {
  const t = makeToken({ sub: "x", name: "Jane", exp: 9999999999 });
  const r = run([t]);
  assert.equal(r.code, 0);
  assert.match(r.out, /HS256/);
  assert.match(r.out, /将于|已于/);
});

test("CLI --json emits full parse", () => {
  const t = makeToken({ sub: "x" });
  const r = run([t, "--json"]);
  assert.equal(r.code, 0);
  const obj = JSON.parse(r.out);
  assert.equal(obj.valid, true);
  assert.equal(obj.payload.sub, "x");
});

test("CLI --header / --payload isolate segments", () => {
  const t = makeToken({ sub: "x", role: "admin" });
  const h = JSON.parse(run([t, "--header"]).out);
  const p = JSON.parse(run([t, "--payload"]).out);
  assert.equal(h.alg, "HS256");
  assert.equal(p.role, "admin");
});

test("CLI shows usage on empty input", () => {
  const r = run([]);
  assert.equal(r.code, 1);
  assert.match(r.out, /用法/);
});
