// macaddr.js — zero-dependency MAC address utilities (UMD)
// normalize / reformat separators, generate random MACs, inspect
// unicast/multicast & local/global bits, and resolve OUI vendor prefixes.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MacAddr = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Common OUI (first 3 octets) -> vendor. A compact, well-known subset.
  var OUI = {
    "00000C": "Cisco Systems",
    "00001B": "Cisco Systems",
    "00005E": "IANA (VRRP / RFC 1042)",
    "0000F6": "Apple, Inc.",
    "000C29": "VMware, Inc.",
    "000F1F": "Apple, Inc.",
    "001018": "Apple, Inc.",
    "003065": "Apple, Inc.",
    "0050C2": "Cisco-Linksys",
    "0060B0": "Apple, Inc.",
    "008773": "Apple, Inc.",
    "000819": "Huawei Technologies",
    "000C29": "VMware, Inc.",
    "000E0C": "Cisco Systems",
    "001093": "Huawei",
    "001A2B": "Google, Inc.",
    "001B63": "Apple, Inc.",
    "001D0F": "Dell Inc.",
    "001E52": "Google, Inc.",
    "002123": "Samsung Electronics",
    "002368": "Cisco Systems",
    "002556": "Samsung Electronics",
    "0026BB": "Apple, Inc.",
    "00270B": "Intel Corporate",
    "003048": "Samsung Electronics",
    "004096": "Cisco Systems",
    "005056": "VMware, Inc.",
    "006097": "Cisco Systems",
    "009027": "Intel Corporate",
    "00A056": "Cisco (Aruba)",
    "00E04C": "Realtek Semiconductor",
    "001150": "Google, Inc.",
    "001A11": "Google, Inc.",
    "001BFC": "Cisco-Linksys",
    "001D72": "Cisco-Linksys",
    "001E65": "Cisco Systems",
    "001F3F": "Apple, Inc.",
    "0021CC": "Cisco-Linksys",
    "002241": "Cisco-Linksys",
    "002436": "Apple, Inc.",
    "00249B": "Huawei Technologies",
    "002563": "Cisco Systems",
    "0026C6": "Apple, Inc.",
    "002708": "Intel Corporate",
    "0029CF": "Cisco Systems",
    "002AA1": "Google, Inc.",
    "0030BD": "Apple, Inc.",
    "00336F": "Apple, Inc.",
    "0050B6": "Microsoft",
    "0050F2": "Microsoft",
    "080027": "PCS Systemtechnik (VirtualBox)",
    "0C1D9A": "Cisco Systems",
    "0C8210": "Cisco Systems",
    "1007F6": "Amazon Technologies",
    "180F76": "Cisco Systems",
    "1CABA0": "Apple, Inc.",
    "206E9C": "TP-LINK Technologies",
    "24181D": "Huawei Device Co.",
    "245B2B": "Huawei Technologies",
    "286C07": "Cisco Systems",
    "2C3361": "Huawei Technologies",
    "2C56DC": "Huawei Device Co.",
    "3C5282": "TP-LINK",
    "3CD0F8": "Cisco Systems",
    "40A8F0": "Xiaomi Communications",
    "404A03": "Xiaomi",
    "445A2B": "Huawei Device Co.",
    "4860BC": "Samsung Electronics",
    "506A03": "Xiaomi",
    "503EAA": "Microsoft",
    "582C80": "Cisco Systems",
    "5C514F": "Cisco Systems",
    "6045BD": "Apple, Inc.",
    "645B8C": "Apple, Inc.",
    "6854FD": "Cisco Systems",
    "6883C4": "Cisco Systems",
    "6C8814": "Cisco Systems",
    "703A0E": "Xiaomi",
    "744D28": "Cisco Systems",
    "784F43": "Cisco Systems",
    "7C6A60": "Cisco Systems",
    "7CA7B0": "Cisco-Linksys",
    "8C8590": "Cisco Systems",
    "985FD3": "Cisco Systems",
    "A021B7": "Cisco Systems",
    "A44CC8": "Cisco Systems",
    "A8B86E": "Cisco Systems",
    "ACBC32": "Cisco Systems",
    "B019C6": "Samsung Electronics",
    "B025AA": "Samsung Electronics",
    "B06EBF": "Cisco Systems",
    "B42E99": "Cisco Systems",
    "B827EB": "Raspberry Pi Foundation",
    "BC628E": "Cisco Systems",
    "C05627": "Cisco Systems",
    "C42C03": "Cisco Systems",
    "C85B76": "Cisco Systems",
    "CC20E8": "Cisco Systems",
    "D022BE": "Samsung Electronics",
    "D46375": "Samsung Electronics",
    "D867D9": "Samsung Electronics",
    "DCA632": "Raspberry Pi Trading",
    "E02A82": "Cisco Systems",
    "E41F13": "Cisco Systems",
    "E82AEA": "Samsung Electronics",
    "EC71DB": "Apple, Inc.",
    "F01898": "Cisco Systems",
    "F40669": "Samsung Electronics",
    "F40F24": "Cisco Systems",
    "F48E38": "Cisco Systems",
    "F81654": "Cisco Systems",
    "F81A67": "Cisco Systems",
    "FC5CEE": "Cisco Systems",
    "FC7484": "Cisco-Linksys",
    "AC7A4D": "Microsoft",
    "9CB6D0": "Huawei Device",
    "9C934E": "Xiaomi",
  };

  function clean(s) {
    return String(s).toUpperCase().replace(/[^0-9A-F]/g, "");
  }

  // Strip everything except hex; return 12 hex chars or null if invalid.
  function toHex(mac) {
    var h = clean(mac);
    if (h.length !== 12) return null;
    if (!/^[0-9A-F]{12}$/.test(h)) return null;
    return h;
  }

  // Reformat a MAC with the given separator and case.
  // sep: ":" | "-" | "" (none) | "." ; upper: boolean
  function format(mac, sep, upper) {
    var h = toHex(mac);
    if (!h) return null;
    if (sep === undefined) sep = ":";
    var groups = h.match(/.{2}/g);
    var out = groups.join(sep);
    return upper ? out : out.toLowerCase();
  }

  // Normalize any common input into canonical colon form (upper).
  function normalize(mac) {
    return format(mac, ":", true);
  }

  // First 3 octets (OUI) as 6 hex chars, upper.
  function oui(mac) {
    var h = toHex(mac);
    if (!h) return null;
    return h.slice(0, 6);
  }

  // Multicast = least-significant bit of the 1st octet is set (I/G bit).
  function isMulticast(mac) {
    var h = toHex(mac);
    if (!h) return null;
    return (parseInt(h.slice(0, 2), 16) & 0x01) === 0x01;
  }

  // Locally administered = 2nd-least-significant bit of 1st octet (U/L bit).
  function isLocal(mac) {
    var h = toHex(mac);
    if (!h) return null;
    return (parseInt(h.slice(0, 2), 16) & 0x02) === 0x02;
  }

  // Resolve vendor from OUI; returns { vendor, oui } or { vendor: null }.
  function vendor(mac) {
    var o = oui(mac);
    if (!o) return { vendor: null, oui: null };
    var v = OUI[o] || null;
    return { vendor: v, oui: o };
  }

  // Generate a random MAC.
  // opts.local: set locally-administered bit (default true)
  // opts.multicast: force multicast bit (default false)
  // opts.oui: 6-hex prefix to pin the vendor (optional)
  // opts.sep: separator for output (default ":")
  function random(opts) {
    opts = opts || {};
    var bytes = new Array(6);
    var rnd;
    if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.getRandomValues) {
      var u = globalThis.crypto.getRandomValues(new Uint8Array(6));
      for (var i = 0; i < 6; i++) bytes[i] = u[i];
    } else if (typeof require !== "undefined") {
      rnd = require("crypto").randomBytes(6);
      for (var j = 0; j < 6; j++) bytes[j] = rnd[j];
    } else {
      for (var k = 0; k < 6; k++) bytes[k] = Math.floor(Math.random() * 256);
    }
    if (opts.oui) {
      var oh = toHex(opts.oui + "000000");
      if (oh) {
        bytes[0] = parseInt(oh.slice(0, 2), 16);
        bytes[1] = parseInt(oh.slice(2, 4), 16);
        bytes[2] = parseInt(oh.slice(4, 6), 16);
      }
      // When an OUI is pinned, keep its bits intact (it already encodes
      // the global/local + unicast/multicast flags).
    } else {
      // Manage U/L bit
      if (opts.local === false) {
        bytes[0] &= 0xfd; // clear local bit (0x02)
      } else {
        bytes[0] |= 0x02; // set local bit
      }
      // Manage I/G bit
      if (opts.multicast) {
        bytes[0] |= 0x01;
      } else if (opts.multicast === false) {
        bytes[0] &= 0xfe;
      }
    }
    var hex = bytes.map(function (b) { return ("0" + b.toString(16).toUpperCase()).slice(-2); }).join("");
    return format(hex, opts.sep === undefined ? ":" : opts.sep, true);
  }

  return {
    clean: clean,
    toHex: toHex,
    format: format,
    normalize: normalize,
    oui: oui,
    isMulticast: isMulticast,
    isLocal: isLocal,
    vendor: vendor,
    random: random,
    OUI: OUI,
  };
});
