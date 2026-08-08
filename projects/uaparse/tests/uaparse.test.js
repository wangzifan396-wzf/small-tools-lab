"use strict";

const assert = require("node:assert/strict");
const U = require("../src/uaparse.js");

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SAFARI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const FIREFOX_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

// 1. Chrome on Windows
let r = U.parse(CHROME_WIN);
assert.strictEqual(r.browser.name, "Chrome");
assert.ok(r.browser.version.indexOf("120") === 0, "chrome version");
assert.strictEqual(r.engine.name, "Blink");
assert.strictEqual(r.os.name, "Windows");
assert.strictEqual(r.device.type, "desktop");

// 2. Safari on macOS → WebKit, not Blink
r = U.parse(SAFARI_MAC);
assert.strictEqual(r.browser.name, "Safari");
assert.strictEqual(r.engine.name, "WebKit");
assert.strictEqual(r.os.name, "macOS");
assert.ok(r.os.version.indexOf("10.15") === 0, "macos version");
assert.strictEqual(r.device.type, "desktop");

// 3. Firefox on Windows → Gecko
r = U.parse(FIREFOX_WIN);
assert.strictEqual(r.browser.name, "Firefox");
assert.strictEqual(r.engine.name, "Gecko");
assert.strictEqual(r.os.name, "Windows");

// 4. iPhone → mobile, Apple, iOS
r = U.parse(IPHONE);
assert.strictEqual(r.browser.name, "Safari");
assert.strictEqual(r.os.name, "iOS");
assert.strictEqual(r.os.version, "17.0");
assert.strictEqual(r.device.type, "mobile");
assert.strictEqual(r.device.vendor, "Apple");
assert.strictEqual(r.device.model, "iPhone");

// 5. Android Chrome → mobile, Android, model
r = U.parse(ANDROID);
assert.strictEqual(r.browser.name, "Chrome");
assert.strictEqual(r.engine.name, "Blink");
assert.strictEqual(r.os.name, "Android");
assert.strictEqual(r.os.version, "13");
assert.strictEqual(r.device.type, "mobile");
assert.ok(r.device.model.length > 0, "android model present");

// 6. Bot detection
r = U.parse(BOT);
assert.strictEqual(r.device.isBot, true);
assert.strictEqual(r.device.type, "bot");

// 7. Empty / unknown
r = U.parse("");
assert.strictEqual(r.browser.name, "Unknown");
assert.strictEqual(r.os.name, "Unknown");
assert.strictEqual(r.device.type, "desktop");

console.log("uaparse: all assertions passed");
