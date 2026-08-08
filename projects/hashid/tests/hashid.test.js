"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const H = require("../src/hashid.js");

const names = (arr) => arr.map((x) => x.name);

// 1. MD5 (32 hex)
assert.ok(names(H.identify("5d41402abc4b2a76b9719d911017c592")).includes("MD5"));

// 2. SHA-1 (40 hex)
assert.ok(names(H.identify("2fd4e1c67a2d28fced849ee1bb76e7391b93eb12")).includes("SHA-1"));

// 3. SHA-256 (64 hex)
assert.ok(names(H.identify("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")).includes("SHA-256"));

// 4. SHA-512 (128 hex)
assert.ok(names(H.identify("9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3aff259f6b0a773d9d")).includes("SHA-512"));

// 5. bcrypt prefix
assert.strictEqual(H.identify("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZd9qJ6jFm")[0].name, "bcrypt");

// 6. sha512crypt prefix
assert.strictEqual(H.identify("$6$rounds=5000$saltstring$hashvaluehere")[0].name, "SHA-512 (crypt)");

// 7. argon2 prefix
assert.strictEqual(H.identify("$argon2i$v=19$m=4096,t=3,p=1$c29tZXNhbHQ$abcdef")[0].name, "Argon2");

// 8. LM / NTLM (32 uppercase hex)
assert.ok(names(H.identify("AAD3B435B51404EE7C4FE08D12345678")).includes("NTLM"));

// 9. Base64 SHA-256 (unpadded)
const realB64 = crypto.createHash("sha256").update("hello").digest("base64").replace(/=+$/, "");
assert.ok(realB64.length >= 42 && realB64.length <= 44, "b64 length sanity: " + realB64.length);
assert.ok(names(H.identify(realB64)).includes("SHA-256 (Base64)"));

// 10. empty
assert.strictEqual(H.identify("").length, 0);

// 11. unrecognized
assert.strictEqual(H.identify("!!! not a hash !!!")[0].name, "无法识别");

console.log("hashid: all assertions passed");
