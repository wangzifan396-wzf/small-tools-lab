(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HarViewer = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PHASES = ["blocked", "dns", "connect", "send", "wait", "receive"];
  var SENSITIVE = /(?:^|[-_])(authorization|cookie|set-cookie|proxy-authorization|x-api-key|api-key|token|secret|password|passwd|session|signature|credential|csrf|xsrf)(?:$|[-_])/i;
  var COMPACT_SENSITIVE = /^(?:authorization|cookie|setcookie|proxyauthorization|xapikey|apikey|accesstoken|refreshtoken|token|secret|clientsecret|password|passwd|session|sessionid|signature|credential|csrf|csrftoken|xsrf|xsrftoken)$/i;
  var hasOwn = Function.call.bind(Object.prototype.hasOwnProperty);

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function number(value, fallback) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
  function nonNegative(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0; }
  function string(value, fallback) { return typeof value === "string" ? value : fallback || ""; }

  function parseHar(source) {
    var document = source;
    if (typeof source === "string") {
      var text = source.replace(/^\uFEFF/, "").trim();
      if (!text) throw new SyntaxError("HAR document is empty");
      try { document = JSON.parse(text); }
      catch (error) { throw new SyntaxError("Invalid HAR JSON: " + error.message); }
    }
    if (!isObject(document) || !isObject(document.log)) throw new TypeError("HAR root must contain a log object");
    if (!Array.isArray(document.log.entries)) throw new TypeError("HAR log.entries must be an array");
    return document;
  }

  function issue(severity, code, path, message) { return { severity: severity, code: code, path: path, message: message }; }

  function headerValue(headers, name) {
    if (!Array.isArray(headers)) return "";
    var target = name.toLowerCase();
    var match = headers.find(function (header) { return isObject(header) && string(header.name).toLowerCase() === target; });
    return match ? string(match.value) : "";
  }

  function classifyType(entry, mimeType, url) {
    var browserType = string(entry._resourceType).toLowerCase();
    if (["document", "stylesheet", "script", "image", "font", "media", "websocket", "xhr", "fetch"].includes(browserType)) {
      return browserType === "stylesheet" ? "css" : browserType === "fetch" ? "xhr" : browserType;
    }
    var mime = mimeType.toLowerCase();
    if (mime.includes("text/html")) return "document";
    if (mime.includes("javascript") || mime.includes("ecmascript")) return "script";
    if (mime.includes("text/css")) return "css";
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("font/") || mime.includes("woff")) return "font";
    if (mime.startsWith("audio/") || mime.startsWith("video/")) return "media";
    if (mime.includes("json") || mime.includes("xml")) return "xhr";
    if (/\.(?:js|mjs)(?:\?|$)/i.test(url)) return "script";
    if (/\.css(?:\?|$)/i.test(url)) return "css";
    if (/\.(?:png|jpe?g|gif|webp|svg|ico)(?:\?|$)/i.test(url)) return "image";
    return "other";
  }

  function parseUrl(rawUrl, issues, path) {
    try {
      var parsed = new URL(rawUrl);
      return { valid: true, domain: parsed.hostname, protocol: parsed.protocol.replace(/:$/, ""), path: parsed.pathname + parsed.search };
    } catch (_) {
      issues.push(issue("warning", "url", path, "Request URL is not an absolute URL"));
      return { valid: false, domain: "(invalid)", protocol: "", path: rawUrl || "(missing URL)" };
    }
  }

  function normalizeEntry(raw, index, issues, pages) {
    var base = "$.log.entries[" + index + "]";
    if (!isObject(raw)) { issues.push(issue("error", "entry", base, "Entry must be an object")); raw = {}; }
    var request = isObject(raw.request) ? raw.request : {};
    var response = isObject(raw.response) ? raw.response : {};
    if (!isObject(raw.request)) issues.push(issue("error", "request", base + ".request", "request object is required"));
    if (!isObject(raw.response)) issues.push(issue("error", "response", base + ".response", "response object is required"));
    var rawUrl = string(request.url);
    var url = parseUrl(rawUrl, issues, base + ".request.url");
    var started = Date.parse(string(raw.startedDateTime));
    if (!Number.isFinite(started)) { issues.push(issue("warning", "started", base + ".startedDateTime", "Invalid or missing startedDateTime")); started = 0; }
    var timings = isObject(raw.timings) ? raw.timings : {};
    if (!isObject(raw.timings)) issues.push(issue("warning", "timings", base + ".timings", "timings object is missing"));
    var phases = Object.create(null);
    PHASES.forEach(function (name) { phases[name] = nonNegative(timings[name]); });
    phases.ssl = nonNegative(timings.ssl);
    var phaseTotal = PHASES.reduce(function (sum, name) { return sum + phases[name]; }, 0);
    var duration = nonNegative(raw.time);
    if (duration === 0 && phaseTotal > 0) duration = phaseTotal;
    var content = isObject(response.content) ? response.content : {};
    var mimeType = string(content.mimeType).split(";")[0].trim();
    var bodySize = number(response.bodySize, -1);
    var headersSize = number(response.headersSize, -1);
    var hasTransferSize = hasOwn(response, "_transferSize") && typeof response._transferSize === "number" && Number.isFinite(response._transferSize) && response._transferSize >= 0;
    var transferSize = hasTransferSize ? response._transferSize : Math.max(0, bodySize) + Math.max(0, headersSize);
    var contentSize = Math.max(0, number(content.size, bodySize > 0 ? bodySize : 0));
    var status = number(response.status, 0);
    var pageRef = string(raw.pageref);
    return {
      id: "entry-" + index,
      index: index,
      raw: raw,
      pageRef: pageRef,
      pageTitle: pages[pageRef] ? pages[pageRef].title : "",
      started: started,
      duration: duration,
      end: started + duration,
      phases: phases,
      method: string(request.method, "GET").toUpperCase(),
      url: rawUrl,
      domain: url.domain,
      protocol: url.protocol,
      path: url.path,
      status: status,
      statusText: string(response.statusText),
      failed: status === 0 || status >= 400,
      redirected: status >= 300 && status < 400,
      mimeType: mimeType || "(unknown)",
      type: classifyType(raw, mimeType, rawUrl),
      transferSize: transferSize,
      contentSize: contentSize,
      compression: Math.max(0, number(content.compression, 0)),
      requestHeaders: Array.isArray(request.headers) ? request.headers : [],
      responseHeaders: Array.isArray(response.headers) ? response.headers : [],
      queryString: Array.isArray(request.queryString) ? request.queryString : [],
      requestCookies: Array.isArray(request.cookies) ? request.cookies : [],
      responseCookies: Array.isArray(response.cookies) ? response.cookies : [],
      serverIPAddress: string(raw.serverIPAddress),
      connection: string(raw.connection),
      cacheControl: headerValue(response.headers, "cache-control"),
      contentEncoding: headerValue(response.headers, "content-encoding"),
    };
  }

  function normalizePages(log, issues) {
    var result = Object.create(null);
    if (log.pages !== undefined && !Array.isArray(log.pages)) issues.push(issue("warning", "pages", "$.log.pages", "pages should be an array"));
    (Array.isArray(log.pages) ? log.pages : []).forEach(function (page, index) {
      if (!isObject(page) || typeof page.id !== "string") { issues.push(issue("warning", "page", "$.log.pages[" + index + "]", "Page requires a string id")); return; }
      result[page.id] = { id: page.id, title: string(page.title, page.id), started: Date.parse(string(page.startedDateTime)) || 0, timings: isObject(page.pageTimings) ? page.pageTimings : {} };
    });
    return result;
  }

  function validateVersion(log, issues) {
    if (typeof log.version !== "string") issues.push(issue("warning", "version", "$.log.version", "HAR log.version is missing"));
    else if (log.version !== "1.2") issues.push(issue("warning", "version", "$.log.version", "Expected HAR 1.2; attempting compatible parsing of " + log.version));
    if (!isObject(log.creator) || typeof log.creator.name !== "string") issues.push(issue("warning", "creator", "$.log.creator", "HAR creator metadata is missing"));
  }

  function summarize(entries, pages) {
    var started = entries.filter(function (entry) { return entry.started > 0; }).map(function (entry) { return entry.started; });
    var first = started.length ? Math.min.apply(Math, started) : 0;
    var last = entries.reduce(function (max, entry) { return Math.max(max, entry.end); }, first);
    var domains = new Set(entries.map(function (entry) { return entry.domain; }));
    return {
      requestCount: entries.length,
      failedCount: entries.filter(function (entry) { return entry.failed; }).length,
      redirectCount: entries.filter(function (entry) { return entry.redirected; }).length,
      domainCount: domains.size,
      pageCount: Object.keys(pages).length,
      transferredBytes: entries.reduce(function (sum, entry) { return sum + entry.transferSize; }, 0),
      contentBytes: entries.reduce(function (sum, entry) { return sum + entry.contentSize; }, 0),
      totalDuration: Math.max(0, last - first),
      firstStarted: first,
      slowest: entries.slice().sort(function (a, b) { return b.duration - a.duration; })[0] || null,
    };
  }

  function analyzeHar(source) {
    var document = parseHar(source);
    var issues = [];
    validateVersion(document.log, issues);
    var pages = normalizePages(document.log, issues);
    var entries = document.log.entries.map(function (entry, index) { return normalizeEntry(entry, index, issues, pages); });
    var report = { document: document, entries: entries, pages: pages, issues: issues, summary: summarize(entries, pages) };
    report.findings = diagnose(entries);
    return report;
  }

  function phaseLayout(entry) {
    var total = entry.duration || 1;
    var cursor = 0;
    return PHASES.map(function (name) {
      var duration = entry.phases[name];
      var phase = { name: name, duration: duration, offsetPercent: Math.min(100, cursor / total * 100), widthPercent: Math.min(100, duration / total * 100) };
      cursor += duration;
      return phase;
    });
  }

  function buildWaterfall(entries) {
    if (!entries.length) return { start: 0, duration: 0, rows: [] };
    var validStarts = entries.filter(function (entry) { return entry.started > 0; }).map(function (entry) { return entry.started; });
    var start = validStarts.length ? Math.min.apply(Math, validStarts) : 0;
    var end = entries.reduce(function (max, entry) { return Math.max(max, entry.end - start); }, 0);
    var duration = Math.max(1, end);
    return {
      start: start,
      duration: duration,
      rows: entries.map(function (entry) {
        var offset = entry.started > 0 ? entry.started - start : 0;
        return Object.assign({}, entry, { offset: offset, offsetPercent: Math.min(100, offset / duration * 100), widthPercent: Math.max(0.35, Math.min(100, entry.duration / duration * 100)), phaseLayout: phaseLayout(entry) });
      }),
    };
  }

  function statusGroup(status) {
    if (status === 0) return "failed";
    return Math.floor(status / 100) + "xx";
  }

  function filterEntries(entries, options) {
    var settings = options || {};
    var query = string(settings.query).toLowerCase();
    return entries.filter(function (entry) {
      if (settings.status === "failed" && !entry.failed) return false;
      if (settings.status && settings.status !== "all" && settings.status !== "failed" && statusGroup(entry.status) !== settings.status) return false;
      if (settings.domain && settings.domain !== "all" && entry.domain !== settings.domain) return false;
      if (settings.type && settings.type !== "all" && entry.type !== settings.type) return false;
      if (settings.page && settings.page !== "all" && entry.pageRef !== settings.page) return false;
      if (number(settings.minDuration, 0) > entry.duration) return false;
      if (query && ![entry.method, entry.url, entry.domain, entry.path, entry.status, entry.mimeType].join(" ").toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function finding(severity, code, title, detail, entry) {
    return { severity: severity, code: code, title: title, detail: detail, entryId: entry ? entry.id : null };
  }

  function diagnose(entries) {
    var findings = [];
    entries.forEach(function (entry) {
      if (entry.failed) findings.push(finding("error", "http-error", "Failed HTTP request", entry.method + " " + entry.path + " returned " + entry.status, entry));
      if (entry.duration >= 1500) findings.push(finding("warning", "slow", "Slow request", entry.path + " took " + Math.round(entry.duration) + " ms", entry));
      if (entry.phases.wait >= 800) findings.push(finding("warning", "ttfb", "High server wait", entry.path + " waited " + Math.round(entry.phases.wait) + " ms for the first byte", entry));
      if (entry.phases.dns >= 250) findings.push(finding("info", "dns", "Slow DNS lookup", entry.domain + " required " + Math.round(entry.phases.dns) + " ms", entry));
      if (entry.phases.connect >= 400) findings.push(finding("info", "connect", "Slow connection setup", entry.domain + " required " + Math.round(entry.phases.connect) + " ms", entry));
      if (entry.transferSize >= 1024 * 1024) findings.push(finding("warning", "large", "Large transfer", entry.path + " transferred " + entry.transferSize + " bytes", entry));
      if (/^(?:text\/|application\/(?:json|javascript|xml))/.test(entry.mimeType) && entry.contentSize >= 20 * 1024 && !entry.contentEncoding) findings.push(finding("info", "compression", "Compression may be missing", entry.path + " is a sizeable text response without Content-Encoding", entry));
      if (["script", "css", "image", "font"].includes(entry.type) && !entry.cacheControl) findings.push(finding("info", "cache", "Cache policy not visible", entry.path + " has no Cache-Control response header", entry));
    });
    var counts = new Map();
    entries.forEach(function (entry) { counts.set(entry.url, (counts.get(entry.url) || 0) + 1); });
    counts.forEach(function (count, url) { if (count >= 3) findings.push(finding("info", "duplicate", "Repeated request", url + " was requested " + count + " times")); });
    var rank = { error: 0, warning: 1, info: 2 };
    return findings.sort(function (a, b) { return rank[a.severity] - rank[b.severity]; });
  }

  function sensitiveName(name) {
    var normalized = string(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return SENSITIVE.test("-" + normalized + "-") || COMPACT_SENSITIVE.test(normalized.replace(/-/g, ""));
  }
  function redactHeaders(headers) {
    return Array.isArray(headers) ? headers.map(function (header) {
      if (!isObject(header)) return header;
      return Object.assign({}, header, sensitiveName(header.name) ? { value: "[REDACTED]" } : {});
    }) : headers;
  }
  function redactCookies(cookies) {
    return Array.isArray(cookies) ? cookies.map(function (cookie) { return isObject(cookie) ? Object.assign({}, cookie, { value: "[REDACTED]" }) : cookie; }) : cookies;
  }
  function redactValue(value) {
    if (Array.isArray(value)) return value.map(redactValue);
    if (!isObject(value)) return value;
    var output = Object.create(null);
    Object.keys(value).forEach(function (key) { output[key] = sensitiveName(key) ? "[REDACTED]" : redactValue(value[key]); });
    return output;
  }
  function redactUrl(raw) {
    try {
      var url = new URL(raw);
      Array.from(url.searchParams.keys()).forEach(function (key) { if (sensitiveName(key)) url.searchParams.set(key, "[REDACTED]"); });
      url.username = ""; url.password = "";
      return url.toString();
    } catch (_) { return raw; }
  }

  function redactFormBody(text) {
    var params = new URLSearchParams(text);
    Array.from(new Set(Array.from(params.keys()))).forEach(function (key) {
      if (sensitiveName(key)) params.set(key, "[REDACTED]");
    });
    return params.toString();
  }

  function sanitizeHar(source, options) {
    var settings = Object.assign({ stripBodies: true, stripAddresses: true }, options || {});
    var document = parseHar(source);
    var copy = JSON.parse(JSON.stringify(document));
    copy.log.entries.forEach(function (entry) {
      if (!isObject(entry)) return;
      if (isObject(entry.request)) {
        entry.request.url = redactUrl(entry.request.url);
        entry.request.headers = redactHeaders(entry.request.headers);
        entry.request.cookies = redactCookies(entry.request.cookies);
        if (Array.isArray(entry.request.queryString)) entry.request.queryString = entry.request.queryString.map(function (item) { return isObject(item) && sensitiveName(item.name) ? Object.assign({}, item, { value: "[REDACTED]" }) : item; });
        if (isObject(entry.request.postData)) {
          if (Array.isArray(entry.request.postData.params)) entry.request.postData.params = entry.request.postData.params.map(function (item) { return isObject(item) && sensitiveName(item.name) ? Object.assign({}, item, { value: "[REDACTED]" }) : item; });
          if (settings.stripBodies) delete entry.request.postData.text;
          else if (typeof entry.request.postData.text === "string" && /json/i.test(string(entry.request.postData.mimeType))) {
            try { entry.request.postData.text = JSON.stringify(redactValue(JSON.parse(entry.request.postData.text))); } catch (_) { entry.request.postData.text = "[UNPARSEABLE BODY REDACTED]"; }
          } else if (typeof entry.request.postData.text === "string" && /x-www-form-urlencoded/i.test(string(entry.request.postData.mimeType))) {
            entry.request.postData.text = redactFormBody(entry.request.postData.text);
          }
        }
      }
      if (isObject(entry.response)) {
        entry.response.headers = redactHeaders(entry.response.headers);
        entry.response.cookies = redactCookies(entry.response.cookies);
        if (settings.stripBodies && isObject(entry.response.content)) { delete entry.response.content.text; delete entry.response.content.encoding; }
      }
      if (settings.stripAddresses) { delete entry.serverIPAddress; delete entry.connection; delete entry._securityDetails; }
    });
    return copy;
  }

  function csvCell(value) {
    var text = String(value === undefined || value === null ? "" : value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function entriesToCsv(entries) {
    var rows = [["startedDateTime", "method", "status", "domain", "path", "type", "mimeType", "durationMs", "waitMs", "transferBytes"]];
    entries.forEach(function (entry) {
      rows.push([entry.started ? new Date(entry.started).toISOString() : "", entry.method, entry.status, entry.domain, entry.path, entry.type, entry.mimeType, entry.duration, entry.phases.wait, entry.transferSize]);
    });
    return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\n") + "\n";
  }

  function formatBytes(bytes) {
    var value = nonNegative(bytes);
    if (value < 1024) return Math.round(value) + " B";
    if (value < 1024 * 1024) return (value / 1024).toFixed(value < 10 * 1024 ? 1 : 0) + " KB";
    return (value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0) + " MB";
  }

  function formatDuration(ms) {
    var value = nonNegative(ms);
    return value < 1000 ? Math.round(value) + " ms" : (value / 1000).toFixed(value < 10000 ? 2 : 1) + " s";
  }

  return {
    PHASES: PHASES.slice(), parseHar: parseHar, analyzeHar: analyzeHar, buildWaterfall: buildWaterfall,
    filterEntries: filterEntries, diagnose: diagnose, sanitizeHar: sanitizeHar, entriesToCsv: entriesToCsv,
    headerValue: headerValue, formatBytes: formatBytes, formatDuration: formatDuration,
  };
});
