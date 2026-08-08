"use strict";

const assert = require("node:assert/strict");
const M = require("../src/macaddr.js");

// 1. normalize collapses any separator to canonical colon form
assert.equal(M.normalize("aabb.cc00.1234"), "AA:BB:CC:00:12:34");
assert.equal(M.normalize("aa-bb-cc-00-12-34"), "AA:BB:CC:00:12:34");
assert.equal(M.normalize("aabbcc001234"), "AA:BB:CC:00:12:34");

// 2. format separators + case
assert.equal(M.format("aabbcc001234", ":", false), "aa:bb:cc:00:12:34");
assert.equal(M.format("aabbcc001234", "-", true), "AA-BB-CC-00-12-34");
assert.equal(M.format("aabbcc001234", "", true), "AABBCC001234");
assert.equal(M.format("aabbcc001234", ".", true), "AA.BB.CC.00.12.34");

// 3. invalid input rejected
assert.equal(M.toHex("zz"), null);
assert.equal(M.toHex("aabbcc"), null);
assert.equal(M.normalize("not a mac"), null);

// 4. OUI + vendor lookup (Apple prefix 00:1B:63)
assert.equal(M.oui("00:1B:63:AA:BB:CC"), "001B63");
assert.equal(M.vendor("00:1B:63:AA:BB:CC").vendor, "Apple, Inc.");
// unknown OUI yields null vendor but valid oui
assert.equal(M.vendor("DE:AD:BE:EF:00:11").vendor, null);
assert.equal(M.vendor("DE:AD:BE:EF:00:11").oui, "DEADBE");

// 5. multicast / local bit sniffing
// AA:BB:... first octet 0xAA = 1010 1010 -> I/G(lsb)=0, U/L(bit1)=1
assert.equal(M.isMulticast("AA:BB:CC:00:12:34"), false);
assert.equal(M.isLocal("AA:BB:CC:00:12:34"), true);
// 01:00:... first octet 0x01 -> multicast bit set
assert.equal(M.isMulticast("01:00:00:00:00:00"), true);

// 6. random() returns a valid locally-administered unicast MAC
const r = M.random();
assert.equal(M.toHex(r).length, 12);
assert.equal(M.isLocal(r), true);
// pinned OUI honored
const r2 = M.random({ oui: "001B63" });
assert.equal(M.oui(r2), "001B63");

console.log("macaddr all assertions passed");
