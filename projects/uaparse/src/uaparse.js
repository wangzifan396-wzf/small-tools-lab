/*
 * uaparse — zero-dependency User-Agent string parser.
 * Detects browser, rendering engine, OS and device type/vendor/model
 * from a UA string. No external rules database, no network.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Uaparse = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function first(re, str) {
    var m = str.match(re);
    return m ? (m[1] || m[0]) : "";
  }

  function parseBrowser(ua) {
    var name = "Unknown", version = "";
    var tests = [
      [/EdgA\/([\d.]+)/, "Microsoft Edge (Android)"],
      [/EdgiOS\/([\d.]+)/, "Microsoft Edge (iOS)"],
      [/Edg\/([\d.]+)/, "Microsoft Edge"],
      [/OPR\/([\d.]+)/, "Opera"],
      [/OPiOS\/([\d.]+)/, "Opera (iOS)"],
      [/Opera\/([\d.]+)/, "Opera"],
      [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
      [/UCBrowser\/([\d.]+)/, "UC Browser"],
      [/MQQBrowser\/([\d.]+)/, "QQ Browser"],
      [/QQBrowser\/([\d.]+)/, "QQ Browser"],
      [/BIDUBrowser\/([\d.]+)/, "Baidu Browser"],
      [/2345Explorer\/([\d.]+)/, "2345 Browser"],
      [/Maxthon\/([\d.]+)/, "Maxthon"],
      [/Vivaldi\/([\d.]+)/, "Vivaldi"],
      [/YaBrowser\/([\d.]+)/, "Yandex Browser"],
      [/Brave\/([\d.]+)/, "Brave"],
      [/FxiOS\/([\d.]+)/, "Firefox (iOS)"],
      [/Firefox\/([\d.]+)/, "Firefox"],
      [/CriOS\/([\d.]+)/, "Chrome (iOS)"],
      [/Chrome\/([\d.]+)/, "Chrome"],
      [/Chromium\/([\d.]+)/, "Chromium"],
      [/Safari\/([\d.]+)/, "Safari"],
      [/Trident\/.*rv:([\d.]+)/, "Internet Explorer"],
      [/MSIE ([\d.]+)/, "Internet Explorer"]
    ];
    for (var i = 0; i < tests.length; i++) {
      var m = ua.match(tests[i][0]);
      if (m) { name = tests[i][1]; version = m[1] || ""; break; }
    }
    return { name: name, version: version };
  }

  function parseEngine(ua) {
    var name = "Unknown", version = "";
    if (/Edg\/|EdgA\/|EdgiOS\/|Chrome\/|Chromium\/|OPR\/|CriOS\/|SamsungBrowser\/|UCBrowser\/|MQQBrowser\/|QQBrowser\/|BIDUBrowser\/|Vivaldi\/|YaBrowser\/|Brave\/|2345Explorer\/|Maxthon\/|HeadlessChrome\//.test(ua)) {
      name = "Blink";
      version = first(/Chrome\/([\d.]+)/, ua) || first(/Chromium\/([\d.]+)/, ua);
    } else if (/Trident\//.test(ua)) {
      name = "Trident"; version = first(/Trident\/([\d.]+)/, ua);
    } else if (/Edge\/|EdgeHTML\//.test(ua)) {
      name = "EdgeHTML";
    } else if (/Gecko\//.test(ua)) {
      name = "Gecko"; version = first(/rv:([\d.]+)/, ua);
    } else if (/Presto\//.test(ua)) {
      name = "Presto"; version = first(/Presto\/([\d.]+)/, ua);
    } else if (/AppleWebKit\//.test(ua)) {
      name = "WebKit"; version = first(/Version\/([\d.]+)/, ua) || first(/AppleWebKit\/([\d.]+)/, ua);
    }
    return { name: name, version: version };
  }

  function parseOS(ua) {
    var name = "Unknown", version = "";
    if (/Windows NT 10\.0/.test(ua)) { name = "Windows"; version = "10 / 11"; }
    else if (/Windows NT 6\.3/.test(ua)) { name = "Windows"; version = "8.1"; }
    else if (/Windows NT 6\.2/.test(ua)) { name = "Windows"; version = "8"; }
    else if (/Windows NT 6\.1/.test(ua)) { name = "Windows"; version = "7"; }
    else if (/Windows NT/.test(ua)) { name = "Windows"; version = first(/Windows NT ([\d.]+)/, ua); }
    else if (/iPhone|iPad|iPod/.test(ua)) { name = "iOS"; version = first(/OS ([\d_]+)/, ua).replace(/_/g, "."); }
    else if (/Mac OS X/.test(ua)) { name = "macOS"; version = first(/Mac OS X ([\d_]+)/, ua).replace(/_/g, "."); }
    else if (/Android/.test(ua)) { name = "Android"; version = first(/Android ([\d.]+)/, ua); }
    else if (/CrOS/.test(ua)) { name = "Chrome OS"; }
    else if (/Ubuntu/.test(ua)) { name = "Ubuntu"; }
    else if (/Fedora/.test(ua)) { name = "Fedora"; }
    else if (/Linux/.test(ua)) { name = "Linux"; }
    else if (/Macintosh/.test(ua)) { name = "macOS"; }
    return { name: name, version: version };
  }

  function parseDevice(ua) {
    var type = "desktop", vendor = "", model = "", bot = false;
    if (/bot|spider|crawl|slurp|mediapartners|bingpreview|google page speed|facebookexternalhit|whatsapp|telegrambot|pingdom/i.test(ua)) {
      bot = true; type = "bot";
    } else if (/iPad/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) || /Tablet/.test(ua)) {
      type = "tablet";
    } else if (/Mobile|iPhone|iPod|Android|Windows Phone/.test(ua)) {
      type = "mobile";
    }
    if (/iPhone/.test(ua)) { vendor = "Apple"; model = "iPhone"; }
    else if (/iPad/.test(ua)) { vendor = "Apple"; model = "iPad"; }
    else if (/iPod/.test(ua)) { vendor = "Apple"; model = "iPod"; }
    else if (/Android/.test(ua)) { model = first(/;\s?([^;]+?)(?:\sBuild\/|\))/, ua) || first(/Android [^;]+;\s?([^;)]+)/, ua); vendor = model; }
    else if (/Windows Phone/.test(ua)) { vendor = "Microsoft"; model = first(/Windows Phone(?: OS)?[^;]*?;\s?([^;)]+)/, ua); }
    return { type: type, vendor: vendor, model: model, isBot: bot };
  }

  function parse(uaString) {
    var ua = String(uaString == null ? "" : uaString);
    return {
      ua: ua,
      browser: parseBrowser(ua),
      engine: parseEngine(ua),
      os: parseOS(ua),
      device: parseDevice(ua)
    };
  }

  return { parse: parse };
});
