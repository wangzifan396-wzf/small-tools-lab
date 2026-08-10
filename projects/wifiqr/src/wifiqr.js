(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.WifiQR = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Escape special characters per the WIFI QR code spec.
  // Backslash first, then ; , " : (the chars that would otherwise break parsing).
  function escapeValue(s) {
    return String(s)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/"/g, '\\"')
      .replace(/:/g, "\\:");
  }

  // Build the WIFI QR payload string.
  // opts: { ssid, password, encryption: 'WPA'|'WEP'|'nopass', hidden: bool }
  // Returns the canonical "WIFI:..." string, or throws on missing ssid.
  function buildWifiString(opts) {
    opts = opts || {};
    var ssid = opts.ssid == null ? "" : String(opts.ssid);
    if (!ssid) throw new Error("SSID 不能为空");
    var encryption = (opts.encryption || "WPA").toUpperCase();
    if (encryption !== "WPA" && encryption !== "WEP" && encryption !== "NOPASS") {
      throw new Error("加密方式仅支持 WPA / WEP / nopass");
    }
    var hidden = !!opts.hidden;

    var out = "WIFI:S:" + escapeValue(ssid) + ";";
    if (encryption === "NOPASS") {
      out += "T:nopass;";
    } else {
      var password = opts.password == null ? "" : String(opts.password);
      out += "T:" + encryption + ";";
      out += "P:" + escapeValue(password) + ";";
    }
    if (hidden) out += "H:true;";
    out += ";";
    return out;
  }

  return {
    buildWifiString: buildWifiString,
    escapeValue: escapeValue,
  };
});
