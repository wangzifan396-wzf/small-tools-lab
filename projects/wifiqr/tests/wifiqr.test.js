"use strict";

const assert = require("node:assert/strict");
const W = require("../src/wifiqr.js");

// 1. basic WPA
assert.equal(
  W.buildWifiString({ ssid: "MyWiFi", password: "secret123", encryption: "WPA" }),
  "WIFI:S:MyWiFi;T:WPA;P:secret123;;"
);

// 2. WEP
assert.equal(
  W.buildWifiString({ ssid: "oldnet", password: "wepkey", encryption: "WEP" }),
  "WIFI:S:oldnet;T:WEP;P:wepkey;;"
);

// 3. open network (nopass) -> no password field
assert.equal(
  W.buildWifiString({ ssid: "FreeNet", encryption: "nopass" }),
  "WIFI:S:FreeNet;T:nopass;;"
);

// 4. hidden network adds H:true
assert.equal(
  W.buildWifiString({ ssid: "HiddenSSID", password: "pw", encryption: "WPA", hidden: true }),
  "WIFI:S:HiddenSSID;T:WPA;P:pw;H:true;;"
);

// 5. escaping: semicolon, comma, colon, backslash, quote
assert.equal(
  W.buildWifiString({ ssid: "a;b,c:d\\e\"f", password: "p;w", encryption: "WPA" }),
  "WIFI:S:a\\;b\\,c\\:d\\\\e\\\"f;T:WPA;P:p\\;w;;"
);

// 6. case-insensitive encryption
assert.equal(
  W.buildWifiString({ ssid: "x", password: "y", encryption: "wpa" }),
  "WIFI:S:x;T:WPA;P:y;;"
);

// 7. errors
assert.throws(() => W.buildWifiString({ ssid: "" }), /SSID/);
assert.throws(() => W.buildWifiString({ ssid: "x", encryption: "WPA3" }), /加密方式/);

console.log("wifiqr all assertions passed");
