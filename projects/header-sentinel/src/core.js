(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HeaderSentinel = factory();
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  var SINGLETONS = new Set([
    'strict-transport-security', 'content-security-policy', 'content-security-policy-report-only',
    'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy',
    'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy',
    'access-control-allow-origin', 'access-control-allow-credentials', 'cache-control'
  ]);
  var SEVERITY = { error: 0, warning: 1, info: 2 };

  function text(value, fallback) { return typeof value === 'string' ? value : (fallback || ''); }
  function finding(severity, code, header, message, remediation) {
    return { severity: severity, code: code, header: header, message: message, remediation: remediation || '' };
  }
  function parseHeaderBlock(source) {
    var headers = new Map(), errors = [], statusLine = '', previous = '';
    text(source).replace(/^\uFEFF/, '').split(/\r?\n/).forEach(function(raw, index) {
      var line = raw.trimEnd();
      if (!line.trim()) return;
      if (/^HTTP\/\d(?:\.\d)?\s+\d{3}/i.test(line)) { statusLine = line.trim(); previous = ''; return; }
      if (/^[ \t]/.test(raw)) { errors.push('Line ' + (index + 1) + ': obsolete folded header is not supported' + (previous ? ' after ' + previous : '')); return; }
      var at = line.indexOf(':');
      if (at < 1) { errors.push('Line ' + (index + 1) + ': expected Header-Name: value'); return; }
      var name = line.slice(0, at).trim().toLowerCase(), value = line.slice(at + 1).trim();
      if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name)) { errors.push('Line ' + (index + 1) + ': invalid header name'); return; }
      if (!headers.has(name)) headers.set(name, []);
      headers.get(name).push(value);
      previous = name;
    });
    return { headers: headers, errors: errors, statusLine: statusLine };
  }
  function values(parsed, name) { return parsed.headers.get(name) || []; }
  function value(parsed, name) { return values(parsed, name).join(', '); }
  function has(parsed, name) { return parsed.headers.has(name); }
  function directives(input) {
    var result = new Map();
    text(input).split(';').forEach(function(part) {
      var bits = part.trim().split(/\s+/), name = (bits.shift() || '').toLowerCase();
      if (name && !result.has(name)) result.set(name, bits);
    });
    return result;
  }
  function attributes(input) {
    var result = new Map();
    text(input).split(';').forEach(function(part) {
      var item = part.trim(), at = item.indexOf('='), name = (at < 0 ? item : item.slice(0, at)).trim().toLowerCase();
      if (name && !result.has(name)) result.set(name, at < 0 ? '' : item.slice(at + 1).trim());
    });
    return result;
  }
  function tokens(input) { return text(input).toLowerCase().split(',').map(function(x) { return x.trim(); }).filter(Boolean); }
  function auditHeaders(source, options) {
    var parsed = source && source.headers instanceof Map ? source : parseHeaderBlock(source);
    var opts = Object.assign({ url: 'https://example.com/', kind: 'html', sensitive: false, isolation: false }, options || {});
    var findings = [], url;
    try { url = new URL(opts.url); } catch (_) { url = null; findings.push(finding('error', 'url.invalid', '(context)', 'Target URL is invalid', 'Enter an absolute HTTP or HTTPS URL.')); }
    parsed.errors.forEach(function(message) { findings.push(finding('error', 'syntax.invalid', '(input)', message)); });
    parsed.headers.forEach(function(list, name) { if (SINGLETONS.has(name) && list.length > 1) findings.push(finding('warning', 'header.duplicate', name, 'Singleton header appears ' + list.length + ' times', 'Emit one unambiguous field value.')); });

    if (url && url.protocol === 'https:') {
      if (!has(parsed, 'strict-transport-security')) findings.push(finding('error', 'hsts.missing', 'strict-transport-security', 'HSTS is missing on an HTTPS response', 'Use max-age=31536000; includeSubDomains after rollout validation.'));
      else {
        var hsts = attributes(values(parsed, 'strict-transport-security')[0]), maxAge = hsts.get('max-age');
        var seconds = /^\d+$/.test(maxAge || '') ? Number(maxAge) : NaN;
        if (!Number.isFinite(seconds)) findings.push(finding('error', 'hsts.invalid-max-age', 'strict-transport-security', 'HSTS max-age is missing or invalid'));
        else if (seconds < 31536000) findings.push(finding('warning', 'hsts.short-max-age', 'strict-transport-security', 'HSTS max-age is shorter than one year'));
        if (!hsts.has('includesubdomains')) findings.push(finding('info', 'hsts.no-subdomains', 'strict-transport-security', 'HSTS does not cover subdomains', 'Only add includeSubDomains after every subdomain is HTTPS-ready.'));
      }
    }
    if (!has(parsed, 'x-content-type-options')) findings.push(finding('error', 'nosniff.missing', 'x-content-type-options', 'MIME sniffing protection is missing', 'Set X-Content-Type-Options: nosniff.'));
    else if (value(parsed, 'x-content-type-options').toLowerCase() !== 'nosniff') findings.push(finding('error', 'nosniff.invalid', 'x-content-type-options', 'The only valid protective value is nosniff'));

    var csp = value(parsed, 'content-security-policy'), cspMap = directives(csp), kind = text(opts.kind).toLowerCase();
    if (kind === 'html') {
      if (!csp) findings.push(finding('error', 'csp.missing', 'content-security-policy', 'HTML response has no enforced Content Security Policy', 'Start with a restrictive report-only policy, then enforce it.'));
      else {
        var script = cspMap.get('script-src') || cspMap.get('default-src') || [];
        if (script.indexOf("'unsafe-eval'") >= 0) findings.push(finding('error', 'csp.unsafe-eval', 'content-security-policy', "script-src allows 'unsafe-eval'"));
        if (script.indexOf('*') >= 0) findings.push(finding('warning', 'csp.wildcard-script', 'content-security-policy', 'Script sources contain a broad wildcard'));
      }
      var frameAncestors = cspMap.get('frame-ancestors'), xfo = value(parsed, 'x-frame-options').toLowerCase();
      if (!frameAncestors && !['deny', 'sameorigin'].includes(xfo)) findings.push(finding('warning', 'framing.missing', 'content-security-policy', 'No effective anti-framing policy was found', "Use frame-ancestors 'none' or SAMEORIGIN where embedding is required."));
      if (xfo && !['deny', 'sameorigin'].includes(xfo)) findings.push(finding('warning', 'xfo.invalid', 'x-frame-options', 'X-Frame-Options has an unsupported value'));
    }
    if (has(parsed, 'content-security-policy-report-only') && !csp) findings.push(finding('warning', 'csp.report-only', 'content-security-policy-report-only', 'CSP is report-only and does not enforce restrictions'));

    var referrer = value(parsed, 'referrer-policy').toLowerCase();
    if (!referrer) findings.push(finding('warning', 'referrer.missing', 'referrer-policy', 'Referrer policy is implicit', 'Use strict-origin-when-cross-origin or a stricter policy.'));
    else if (['unsafe-url', 'no-referrer-when-downgrade'].includes(tokens(referrer).slice(-1)[0])) findings.push(finding('error', 'referrer.unsafe', 'referrer-policy', 'Referrer policy can expose full URLs cross-origin'));

    var permissions = value(parsed, 'permissions-policy');
    if (kind === 'html' && !permissions) findings.push(finding('warning', 'permissions.missing', 'permissions-policy', 'Permissions Policy is missing', 'Disable unused powerful features explicitly.'));
    if (/\b(camera|microphone|geolocation)\s*=\s*\*/i.test(permissions)) findings.push(finding('error', 'permissions.wildcard', 'permissions-policy', 'A sensitive capability is allowed to every origin'));

    var acao = value(parsed, 'access-control-allow-origin'), acac = value(parsed, 'access-control-allow-credentials').toLowerCase();
    if (acao === '*' && acac === 'true') findings.push(finding('error', 'cors.wildcard-credentials', 'access-control-allow-origin', 'Wildcard origin cannot be combined with credentialed CORS'));
    if (acao === 'null') findings.push(finding('error', 'cors.null-origin', 'access-control-allow-origin', 'The opaque null origin is explicitly trusted'));
    if (acao && acao !== '*' && !tokens(value(parsed, 'vary')).includes('origin')) findings.push(finding('warning', 'cors.vary-origin', 'vary', 'Origin-specific CORS response does not vary on Origin', 'Add Vary: Origin to protect shared caches.'));

    var cache = value(parsed, 'cache-control').toLowerCase();
    if (opts.sensitive && !/(^|,)\s*(no-store|private)\b/.test(cache)) findings.push(finding('error', 'cache.sensitive', 'cache-control', 'Sensitive response may be stored by shared caches', 'Use Cache-Control: no-store for secrets or private for user-specific content.'));
    if (has(parsed, 'set-cookie') && /(^|,)\s*public\b/.test(cache)) findings.push(finding('error', 'cache.public-cookie', 'cache-control', 'A response setting cookies is explicitly public-cacheable'));

    ['server', 'x-powered-by', 'x-aspnet-version'].forEach(function(name) { if (has(parsed, name)) findings.push(finding('info', 'disclosure.' + name, name, 'Technology disclosure header is present', 'Remove or minimize unnecessary implementation details.')); });
    var xss = value(parsed, 'x-xss-protection').trim();
    if (xss && xss !== '0') findings.push(finding('warning', 'legacy.xss-protection', 'x-xss-protection', 'Legacy X-XSS-Protection should be disabled with 0'));

    var coop = value(parsed, 'cross-origin-opener-policy').toLowerCase();
    var coep = value(parsed, 'cross-origin-embedder-policy').toLowerCase();
    var corp = value(parsed, 'cross-origin-resource-policy').toLowerCase();
    var isolated = coop === 'same-origin' && ['require-corp', 'credentialless'].includes(coep);
    if (opts.isolation && coop !== 'same-origin') findings.push(finding('error', 'isolation.coop', 'cross-origin-opener-policy', 'Cross-origin isolation requires COOP: same-origin'));
    if (opts.isolation && !['require-corp', 'credentialless'].includes(coep)) findings.push(finding('error', 'isolation.coep', 'cross-origin-embedder-policy', 'Cross-origin isolation requires COEP: require-corp or credentialless'));
    if (corp && !['same-origin', 'same-site', 'cross-origin'].includes(corp)) findings.push(finding('warning', 'corp.invalid', 'cross-origin-resource-policy', 'Cross-Origin-Resource-Policy has an unknown value'));

    findings.sort(function(a, b) { return SEVERITY[a.severity] - SEVERITY[b.severity] || a.header.localeCompare(b.header) || a.code.localeCompare(b.code); });
    var errors = findings.filter(function(x) { return x.severity === 'error'; }).length;
    var warnings = findings.filter(function(x) { return x.severity === 'warning'; }).length;
    return { parsed: parsed, findings: findings, summary: { headers: parsed.headers.size, errors: errors, warnings: warnings, info: findings.length - errors - warnings, score: Math.max(0, 100 - errors * 12 - warnings * 5), crossOriginIsolated: isolated } };
  }
  function compareHeaders(beforeSource, afterSource, options) {
    var before = auditHeaders(beforeSource, options), after = auditHeaders(afterSource, options), changes = [];
    var names = new Set(Array.from(before.parsed.headers.keys()).concat(Array.from(after.parsed.headers.keys())));
    names.forEach(function(name) {
      var oldValue = value(before.parsed, name), newValue = value(after.parsed, name);
      if (oldValue === newValue) return;
      if (!newValue) changes.push(finding(SINGLETONS.has(name) ? 'error' : 'warning', 'header.removed', name, 'Header was removed'));
      else if (!oldValue) changes.push(finding('info', 'header.added', name, 'Header was added'));
      else changes.push(finding('warning', 'header.changed', name, 'Header value changed', oldValue + ' -> ' + newValue));
    });
    var oldCodes = new Set(before.findings.map(function(x) { return x.code + '|' + x.header; }));
    after.findings.forEach(function(item) { if (!oldCodes.has(item.code + '|' + item.header) && item.severity !== 'info') changes.push(finding(item.severity, 'finding.introduced', item.header, 'New issue: ' + item.message)); });
    changes.sort(function(a, b) { return SEVERITY[a.severity] - SEVERITY[b.severity] || a.header.localeCompare(b.header); });
    return { before: before, after: after, changes: changes, summary: { errors: changes.filter(function(x) { return x.severity === 'error'; }).length, warnings: changes.filter(function(x) { return x.severity === 'warning'; }).length, info: changes.filter(function(x) { return x.severity === 'info'; }).length, scoreDelta: after.summary.score - before.summary.score } };
  }
  function generateBaseline(options) {
    var opts = Object.assign({ kind: 'html', sensitive: false, isolation: false }, options || {}), lines = [
      'Strict-Transport-Security: max-age=31536000; includeSubDomains',
      'X-Content-Type-Options: nosniff',
      'Referrer-Policy: strict-origin-when-cross-origin'
    ];
    if (opts.kind === 'html') {
      lines.push("Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
      lines.push('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    }
    if (opts.sensitive) lines.push('Cache-Control: no-store');
    if (opts.isolation) { lines.push('Cross-Origin-Opener-Policy: same-origin'); lines.push('Cross-Origin-Embedder-Policy: require-corp'); }
    return lines.join('\n');
  }
  function filterFindings(findings, options) {
    var opts = options || {}, query = text(opts.query).toLowerCase();
    return findings.filter(function(item) { if (opts.severity && opts.severity !== 'all' && item.severity !== opts.severity) return false; return !query || (item.code + ' ' + item.header + ' ' + item.message + ' ' + item.remediation).toLowerCase().includes(query); });
  }
  function formatMarkdown(report) {
    var lines = ['# Header Sentinel', '', '- Score: ' + report.summary.score + '/100', '- Headers: ' + report.summary.headers, '- Errors: ' + report.summary.errors, '- Warnings: ' + report.summary.warnings, '- Cross-origin isolated: ' + (report.summary.crossOriginIsolated ? 'yes' : 'no'), ''];
    if (!report.findings.length) lines.push('No findings.');
    report.findings.forEach(function(item) { lines.push('- **' + item.severity.toUpperCase() + '** `' + item.header + '` - ' + item.message); });
    return lines.join('\n') + '\n';
  }
  return { parseHeaderBlock: parseHeaderBlock, auditHeaders: auditHeaders, compareHeaders: compareHeaders, generateBaseline: generateBaseline, filterFindings: filterFindings, formatMarkdown: formatMarkdown };
}));
