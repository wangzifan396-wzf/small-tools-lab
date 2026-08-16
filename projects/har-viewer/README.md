# HAR Viewer

A private, local-first HAR 1.2 waterfall viewer and performance diagnostics workbench. Open a browser network capture, isolate slow or failed requests, inspect timings and headers, then export a redacted HAR or a filtered CSV without uploading the capture.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/har-viewer/)

## Why it exists

HAR files are useful bug reports, but they may contain cookies, bearer tokens, API keys, query secrets, request and response bodies, client addresses, and internal hostnames. Uploading one to an unfamiliar viewer creates a second incident while investigating the first. HAR Viewer performs parsing, visualization, diagnosis, filtering, and export in the current browser tab. It makes no network requests and stores no capture.

## Features

- HAR 1.2 JSON parsing with compatibility notices for missing metadata
- Request timeline and phase waterfall for blocked, DNS, connect, send, wait/TTFB, and receive time
- Correct SSL treatment as a sub-phase of connect rather than double-counted elapsed time
- Search and filters for status, domain, resource type, page, and minimum duration
- Request detail for status, MIME type, transfer size, page, timings, query parameters, and headers
- Diagnostics for HTTP failures, slow requests, high TTFB, slow DNS and connections, large transfers, missing text compression, absent static cache policies, and repeated URLs
- Safe handling of explicit zero-byte transfer sizes, which commonly indicate cache use
- Redacted HAR download that strips bodies, IP/connection/security metadata, URL credentials, and redacts cookies and common credential fields
- Recursive JSON-body and URL-encoded form redaction in the reusable core when body retention is explicitly requested
- CSV export of the current filtered result with spreadsheet-formula injection protection
- 25 MB browser file limit, zero runtime dependencies, no account, no telemetry, and no network requests
- Responsive desktop and mobile layouts with light and dark themes

## Getting a HAR

In Chromium-based browsers, open Developer Tools, choose **Network**, reproduce the problem, then use the request list's context menu to save all requests as HAR. Browser versions differ, and some offer a sanitized HAR export. Treat every capture as sensitive even when the browser calls it sanitized.

## Redaction boundary

The interface's **Download redacted HAR** action uses the safest built-in mode:

- request and response body text is removed;
- request and response cookies are replaced;
- authorization, cookie, token, API-key, password, session, signature, credential, CSRF, and similar named fields are replaced;
- matching URL query values and structured form fields are replaced;
- URL usernames and passwords are removed;
- server IP addresses, connection identifiers, and security-detail extensions are removed.

Redaction is risk reduction, not a proof that a capture is anonymous. Custom secret field names, internal domains, paths, non-sensitive query values, headers with unusual names, timing patterns, and other metadata remain. Review the resulting file before sharing it.

## Diagnostics are heuristics

The findings intentionally use transparent thresholds: 1.5 seconds for a slow request, 800 ms for high wait/TTFB, 250 ms for DNS, 400 ms for connection setup, and 1 MiB for a large transfer. A missing `Cache-Control` or `Content-Encoding` header is reported only as a review prompt. HAR producer behavior, service workers, caches, connection reuse, proxies, and incomplete captures can affect every metric.

## Development

```bash
npm test
```

The dependency-free UMD core is in `src/core.js` and can also be required from Node.js. The browser controller in `src/app.mjs` renders imported strings with DOM text nodes and creates the waterfall as native SVG under a strict Content Security Policy.

The core API exposes `parseHar`, `analyzeHar`, `buildWaterfall`, `filterEntries`, `diagnose`, `sanitizeHar`, `entriesToCsv`, `formatBytes`, and `formatDuration`.
