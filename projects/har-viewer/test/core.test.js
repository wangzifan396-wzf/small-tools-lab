"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const H = require("../src/core.js");

function entry(overrides = {}) {
  const base = {
    pageref: "page-1",
    startedDateTime: "2026-08-16T02:00:00.000Z",
    time: 150,
    request: {
      method: "GET",
      url: "https://api.example.com/v1/items?limit=10",
      httpVersion: "HTTP/2",
      headers: [{ name: "Accept", value: "application/json" }],
      queryString: [{ name: "limit", value: "10" }],
      cookies: [],
      headersSize: 20,
      bodySize: 0,
    },
    response: {
      status: 200,
      statusText: "OK",
      httpVersion: "HTTP/2",
      headers: [
        { name: "content-type", value: "application/json; charset=utf-8" },
        { name: "cache-control", value: "public, max-age=60" },
        { name: "content-encoding", value: "br" },
      ],
      cookies: [],
      content: { size: 400, mimeType: "application/json", text: "{}" },
      redirectURL: "",
      headersSize: 100,
      bodySize: 300,
    },
    cache: {},
    timings: { blocked: 5, dns: 10, connect: 20, ssl: 15, send: 5, wait: 80, receive: 30 },
    serverIPAddress: "203.0.113.10",
    connection: "42",
  };
  return Object.assign(base, overrides);
}

function fixture(entries = [entry()]) {
  return {
    log: {
      version: "1.2",
      creator: { name: "Browser", version: "1" },
      pages: [{ id: "page-1", title: "Items", startedDateTime: "2026-08-16T02:00:00.000Z", pageTimings: { onLoad: 900 } }],
      entries,
    },
  };
}

test("parses HAR objects and JSON text without mutating the document", () => {
  const source = fixture();
  assert.equal(H.parseHar(source), source);
  assert.equal(H.parseHar("\uFEFF" + JSON.stringify(source)).log.entries.length, 1);
  const before = JSON.stringify(source);
  H.analyzeHar(source);
  assert.equal(JSON.stringify(source), before);
});

test("rejects empty, malformed, and structurally invalid HAR input", () => {
  assert.throws(() => H.parseHar(""), /empty/);
  assert.throws(() => H.parseHar("{bad}"), /Invalid HAR JSON/);
  assert.throws(() => H.parseHar([]), /log object/);
  assert.throws(() => H.parseHar({ log: {} }), /log\.entries/);
});

test("reports version, creator, and pages compatibility warnings", () => {
  const source = fixture();
  source.log.version = "1.1";
  delete source.log.creator;
  source.log.pages = {};
  assert.deepEqual(H.analyzeHar(source).issues.map((item) => item.code), ["version", "creator", "pages"]);
});

test("normalizes request identity, page metadata, headers, and timing phases", () => {
  const item = H.analyzeHar(fixture()).entries[0];
  assert.equal(item.method, "GET");
  assert.equal(item.domain, "api.example.com");
  assert.equal(item.protocol, "https");
  assert.equal(item.path, "/v1/items?limit=10");
  assert.equal(item.pageTitle, "Items");
  assert.equal(item.mimeType, "application/json");
  assert.equal(item.phases.ssl, 15);
  assert.equal(item.cacheControl, "public, max-age=60");
});

test("warns about invalid URLs, dates, missing objects, and missing timings", () => {
  const report = H.analyzeHar(fixture([{ startedDateTime: "bad", request: { url: "/relative" } }]));
  assert.equal(report.entries[0].domain, "(invalid)");
  assert.equal(report.entries[0].started, 0);
  assert.deepEqual(report.issues.map((item) => item.code), ["response", "url", "started", "timings"]);
});

test("uses phase totals when entry.time is unavailable without double-counting ssl", () => {
  const raw = entry({ time: -1 });
  assert.equal(H.analyzeHar(fixture([raw])).entries[0].duration, 150);
});

test("classifies resources using browser hints, MIME types, and URL extensions", () => {
  const items = [
    entry({ _resourceType: "stylesheet" }),
    entry({ response: { status: 200, content: { mimeType: "image/webp", size: 1 } } }),
    entry({ request: { method: "GET", url: "https://cdn.example.com/app.mjs" }, response: { status: 200, content: {} } }),
  ];
  assert.deepEqual(H.analyzeHar(fixture(items)).entries.map((item) => item.type), ["css", "image", "script"]);
});

test("prefers explicit transfer size and preserves a zero cache transfer", () => {
  const cached = entry();
  cached.response._transferSize = 0;
  const transferred = entry();
  transferred.response._transferSize = 777;
  assert.deepEqual(H.analyzeHar(fixture([cached, transferred])).entries.map((item) => item.transferSize), [0, 777]);
});

test("falls back to positive response header and body sizes when transfer size is absent", () => {
  const item = entry();
  item.response.headersSize = 90;
  item.response.bodySize = 310;
  assert.equal(H.analyzeHar(fixture([item])).entries[0].transferSize, 400);
});

test("summarizes requests, failures, redirects, domains, bytes, pages, and elapsed time", () => {
  const second = entry({
    startedDateTime: "2026-08-16T02:00:00.500Z",
    time: 300,
    request: { method: "GET", url: "https://cdn.example.net/app.js" },
    response: { status: 404, headersSize: 10, bodySize: 20, content: { size: 20, mimeType: "text/javascript" } },
  });
  const redirect = entry({ response: { status: 302, headersSize: 20, bodySize: 0, content: { size: 0 } } });
  const summary = H.analyzeHar(fixture([entry(), second, redirect])).summary;
  assert.equal(summary.requestCount, 3);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.redirectCount, 1);
  assert.equal(summary.domainCount, 2);
  assert.equal(summary.pageCount, 1);
  assert.equal(summary.totalDuration, 800);
  assert.equal(summary.slowest.duration, 300);
});

test("builds global and phase waterfall layouts with bounded percentages", () => {
  const entries = H.analyzeHar(fixture([entry(), entry({ startedDateTime: "2026-08-16T02:00:00.500Z", time: 500 })])).entries;
  const waterfall = H.buildWaterfall(entries);
  assert.equal(waterfall.duration, 1000);
  assert.equal(waterfall.rows[1].offset, 500);
  assert.equal(waterfall.rows[1].offsetPercent, 50);
  assert.equal(waterfall.rows[0].phaseLayout.find((phase) => phase.name === "wait").duration, 80);
  assert.equal(H.buildWaterfall([]).duration, 0);
});

test("builds a useful waterfall even when every start date is invalid", () => {
  const entries = H.analyzeHar(fixture([entry({ startedDateTime: "bad", time: 50 })])).entries;
  assert.equal(H.buildWaterfall(entries).rows[0].widthPercent, 100);
});

test("filters entries by status, domain, type, page, duration, and search", () => {
  const failed = entry({
    pageref: "other",
    time: 2000,
    request: { method: "POST", url: "https://errors.example.net/fail" },
    response: { status: 500, content: { mimeType: "text/html", size: 1 } },
  });
  const entries = H.analyzeHar(fixture([entry(), failed])).entries;
  assert.equal(H.filterEntries(entries, { status: "5xx" }).length, 1);
  assert.equal(H.filterEntries(entries, { status: "failed" }).length, 1);
  assert.equal(H.filterEntries(entries, { domain: "api.example.com" }).length, 1);
  assert.equal(H.filterEntries(entries, { type: "document" }).length, 1);
  assert.equal(H.filterEntries(entries, { page: "other" }).length, 1);
  assert.equal(H.filterEntries(entries, { minDuration: 1000 }).length, 1);
  assert.equal(H.filterEntries(entries, { query: "errors.example" }).length, 1);
});

test("diagnoses HTTP errors and slow request, wait, DNS, and connection phases", () => {
  const raw = entry({ time: 2500 });
  raw.response.status = 503;
  raw.timings.wait = 900;
  raw.timings.dns = 300;
  raw.timings.connect = 450;
  const codes = H.analyzeHar(fixture([raw])).findings.map((item) => item.code);
  for (const code of ["http-error", "slow", "ttfb", "dns", "connect"]) assert.ok(codes.includes(code));
});

test("treats status zero as a failed request", () => {
  const raw = entry();
  raw.response.status = 0;
  const report = H.analyzeHar(fixture([raw]));
  assert.equal(report.entries[0].failed, true);
  assert.equal(report.findings[0].code, "http-error");
});

test("diagnoses large, uncompressed, and uncached static responses", () => {
  const raw = entry({ _resourceType: "script" });
  raw.response.bodySize = 2 * 1024 * 1024;
  raw.response.content = { size: 2 * 1024 * 1024, mimeType: "application/javascript" };
  raw.response.headers = [];
  const codes = H.analyzeHar(fixture([raw])).findings.map((item) => item.code);
  for (const code of ["large", "compression", "cache"]) assert.ok(codes.includes(code));
});

test("diagnoses URLs requested three or more times", () => {
  const findings = H.analyzeHar(fixture([entry(), entry(), entry()])).findings;
  assert.equal(findings.filter((item) => item.code === "duplicate").length, 1);
});

test("sanitizes headers, cookies, query fields, URL credentials, and common compact secret names", () => {
  const raw = entry();
  raw.request.url = "https://user:pass@example.com/?apiKey=secret&safe=yes";
  raw.request.headers = [{ name: "Authorization", value: "Bearer secret" }, { name: "X-Safe", value: "ok" }];
  raw.request.cookies = [{ name: "sid", value: "secret" }];
  raw.request.queryString = [{ name: "accessToken", value: "secret" }, { name: "safe", value: "ok" }];
  raw.response.headers.push({ name: "Set-Cookie", value: "sid=secret" });
  const clean = H.sanitizeHar(fixture([raw]));
  assert.equal(clean.log.entries[0].request.headers[0].value, "[REDACTED]");
  assert.equal(clean.log.entries[0].request.headers[1].value, "ok");
  assert.equal(clean.log.entries[0].request.cookies[0].value, "[REDACTED]");
  assert.equal(clean.log.entries[0].request.queryString[0].value, "[REDACTED]");
  assert.equal(new URL(clean.log.entries[0].request.url).username, "");
  assert.equal(new URL(clean.log.entries[0].request.url).searchParams.get("apiKey"), "[REDACTED]");
  assert.equal(clean.log.entries[0].response.headers.at(-1).value, "[REDACTED]");
});

test("strips bodies, addresses, connections, and security details by default", () => {
  const raw = entry();
  raw.request.postData = { mimeType: "application/json", text: "{\"token\":\"secret\"}" };
  raw.response.content.text = "private";
  raw.response.content.encoding = "base64";
  raw._securityDetails = { subjectName: "private.example" };
  const clean = H.sanitizeHar(fixture([raw])).log.entries[0];
  assert.equal("text" in clean.request.postData, false);
  assert.equal("text" in clean.response.content, false);
  assert.equal("encoding" in clean.response.content, false);
  assert.equal("serverIPAddress" in clean, false);
  assert.equal("connection" in clean, false);
  assert.equal("_securityDetails" in clean, false);
});

test("recursively redacts JSON bodies when bodies are retained", () => {
  const raw = entry();
  raw.request.postData = { mimeType: "application/json", text: JSON.stringify({ user: "Ada", client_secret: "secret", nested: [{ refreshToken: "secret" }] }) };
  const body = JSON.parse(H.sanitizeHar(fixture([raw]), { stripBodies: false }).log.entries[0].request.postData.text);
  assert.deepEqual(body, { user: "Ada", client_secret: "[REDACTED]", nested: [{ refreshToken: "[REDACTED]" }] });
});

test("replaces malformed JSON bodies when retention was requested", () => {
  const raw = entry();
  raw.request.postData = { mimeType: "application/json", text: "{bad}" };
  assert.equal(H.sanitizeHar(fixture([raw]), { stripBodies: false }).log.entries[0].request.postData.text, "[UNPARSEABLE BODY REDACTED]");
});

test("redacts URL-encoded bodies and structured post parameters when retained", () => {
  const raw = entry();
  raw.request.postData = {
    mimeType: "application/x-www-form-urlencoded",
    text: "username=ada&password=secret",
    params: [{ name: "csrf_token", value: "secret" }, { name: "color", value: "green" }],
  };
  const clean = H.sanitizeHar(fixture([raw]), { stripBodies: false }).log.entries[0].request.postData;
  assert.equal(new URLSearchParams(clean.text).get("password"), "[REDACTED]");
  assert.equal(clean.params[0].value, "[REDACTED]");
  assert.equal(clean.params[1].value, "green");
});

test("can retain bodies and network addresses only when explicitly requested", () => {
  const raw = entry();
  raw.request.postData = { mimeType: "text/plain", text: "ordinary body" };
  raw.response.content.text = "response body";
  const clean = H.sanitizeHar(fixture([raw]), { stripBodies: false, stripAddresses: false }).log.entries[0];
  assert.equal(clean.request.postData.text, "ordinary body");
  assert.equal(clean.response.content.text, "response body");
  assert.equal(clean.serverIPAddress, "203.0.113.10");
});

test("exports stable CSV with quotes, newlines, and spreadsheet-formula protection", () => {
  const normalized = H.analyzeHar(fixture([entry({ request: { method: "GET", url: "https://example.com/=cmd,\"x\"" } })])).entries;
  normalized[0].path = "=cmd,\"x\"";
  const csv = H.entriesToCsv(normalized);
  assert.match(csv, /^"startedDateTime","method"/);
  assert.match(csv, /"'=cmd,""x"""/);
  assert.equal(csv.endsWith("\n"), true);
});

test("leaves CSV start time empty when a timestamp is invalid", () => {
  const normalized = H.analyzeHar(fixture([entry({ startedDateTime: "invalid" })])).entries;
  assert.match(H.entriesToCsv(normalized), /\n"","GET"/);
});

test("formats bytes and durations at readable boundaries", () => {
  assert.equal(H.formatBytes(0), "0 B");
  assert.equal(H.formatBytes(1536), "1.5 KB");
  assert.equal(H.formatBytes(2 * 1024 * 1024), "2.0 MB");
  assert.equal(H.formatDuration(999), "999 ms");
  assert.equal(H.formatDuration(1500), "1.50 s");
});

test("finds case-insensitive header values and tolerates absent arrays", () => {
  assert.equal(H.headerValue([{ name: "Content-Type", value: "text/plain" }], "content-type"), "text/plain");
  assert.equal(H.headerValue(null, "content-type"), "");
});
