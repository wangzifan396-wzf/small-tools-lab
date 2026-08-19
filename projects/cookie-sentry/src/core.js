(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CookieSentry = factory();
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';
  var SEVERITY = { error: 0, warning: 1, info: 2 };
  function text(value, fallback) { return typeof value === 'string' ? value : (fallback || ''); }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function issue(severity, code, cookie, message, detail) { return { severity: severity, code: code, cookie: cookie, message: message, detail: detail || '' }; }
  function splitHeader(line) {
    var result = [], current = '', quoted = false;
    String(line || '').split('').forEach(function(ch) { if (ch === '"') quoted = !quoted; if (ch === ';' && !quoted) { result.push(current.trim()); current = ''; } else current += ch; });
    if (current.trim()) result.push(current.trim());
    return result;
  }
  function parseCookieHeader(source) {
    var errors = [], pairs = [], input = text(source).trim();
    if (!input) return { pairs: pairs, errors: errors };
    input.split(';').forEach(function(part, index) { var item = part.trim(); if (!item) return; var at = item.indexOf('='); if (at < 1) { errors.push('Cookie pair ' + (index + 1) + ' has no name/value separator'); return; } var name = item.slice(0, at).trim(), value = item.slice(at + 1).trim(); if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) errors.push('Invalid cookie name: ' + name); pairs.push({ name: name, value: value, raw: item }); });
    return { pairs: pairs, errors: errors };
  }
  function parseSetCookie(source) {
    var parts = splitHeader(source), first = parts.shift() || '', at = first.indexOf('='), errors = [];
    if (at < 1) throw new SyntaxError('Set-Cookie must start with name=value');
    var name = first.slice(0, at).trim(), value = first.slice(at + 1).trim(), attributes = {}, flags = [];
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) errors.push('Invalid cookie name: ' + name);
    parts.forEach(function(part) { var split = part.indexOf('='); if (split < 0) flags.push(part.toLowerCase()); else { var key = part.slice(0, split).trim().toLowerCase(); attributes[key] = part.slice(split + 1).trim(); } });
    return { name: name, value: value, attributes: attributes, flags: flags, raw: text(source).trim(), errors: errors };
  }
  function has(cookie, key) { return Object.prototype.hasOwnProperty.call(cookie.attributes, key); }
  function flag(cookie, key) { return cookie.flags.indexOf(key) >= 0; }
  function auditCookie(cookie) {
    var findings = [], name = cookie.name, lower = name.toLowerCase(), sameSite = text(cookie.attributes.samesite).toLowerCase();
    if (cookie.errors.length) cookie.errors.forEach(function(error) { findings.push(issue('error', 'invalid-name', name, error)); });
    if (!flag(cookie, 'secure')) findings.push(issue('error', 'missing-secure', name, 'Cookie is missing Secure', 'Prevent transmission over cleartext HTTP.'));
    if (!flag(cookie, 'httponly')) findings.push(issue('warning', 'missing-httponly', name, 'Cookie is readable by JavaScript', 'Add HttpOnly unless client-side access is intentional.'));
    if (!sameSite) findings.push(issue('warning', 'missing-samesite', name, 'SameSite is not explicit', 'Prefer Lax for ordinary session cookies or Strict for sensitive flows.'));
    if (sameSite === 'none' && !flag(cookie, 'secure')) findings.push(issue('error', 'samesite-none-without-secure', name, 'SameSite=None requires Secure', 'Modern browsers reject this combination.'));
    if (sameSite && ['lax', 'strict', 'none'].indexOf(sameSite) < 0) findings.push(issue('warning', 'invalid-samesite', name, 'Unknown SameSite value: ' + cookie.attributes.samesite));
    if (has(cookie, 'domain')) { var domain = cookie.attributes.domain.toLowerCase(); if (!domain || domain.charAt(0) === '.') findings.push(issue('warning', 'broad-domain', name, 'Domain widens cookie scope', 'Prefer a host-only cookie unless cross-subdomain sharing is required.')); }
    if (has(cookie, 'expires') && isNaN(Date.parse(cookie.attributes.expires))) findings.push(issue('warning', 'invalid-expires', name, 'Expires is not a valid date'));
    if (has(cookie, 'max-age') && !/^-?\d+$/.test(cookie.attributes['max-age'])) findings.push(issue('warning', 'invalid-max-age', name, 'Max-Age is not an integer'));
    if (lower.indexOf('__host-') === 0) { if (!flag(cookie, 'secure')) findings.push(issue('error', 'host-prefix-secure', name, '__Host- cookies must use Secure')); if (has(cookie, 'domain')) findings.push(issue('error', 'host-prefix-domain', name, '__Host- cookies must not set Domain')); if (cookie.attributes.path !== '/') findings.push(issue('error', 'host-prefix-path', name, '__Host- cookies must set Path=/')); }
    if (lower.indexOf('__secure-') === 0 && !flag(cookie, 'secure')) findings.push(issue('error', 'secure-prefix', name, '__Secure- cookies must use Secure'));
    if (flag(cookie, 'partitioned') && !flag(cookie, 'secure')) findings.push(issue('error', 'partitioned-secure', name, 'Partitioned cookies must use Secure'));
    return findings;
  }
  function analyzeSetCookies(source) {
    var lines = Array.isArray(source) ? source : text(source).split(/\r?\n/), cookies = [], findings = [], errors = [];
    lines.map(function(line) { return text(line).trim(); }).filter(Boolean).forEach(function(line) { try { var cookie = parseSetCookie(line); cookies.push(cookie); findings = findings.concat(auditCookie(cookie)); } catch (error) { errors.push(error.message); } });
    findings.sort(function(a, b) { return SEVERITY[a.severity] - SEVERITY[b.severity] || a.cookie.localeCompare(b.cookie) || a.code.localeCompare(b.code); });
    return { cookies: cookies, findings: findings, errors: errors, summary: { cookies: cookies.length, errors: findings.filter(function(x) { return x.severity === 'error'; }).length + errors.length, warnings: findings.filter(function(x) { return x.severity === 'warning'; }).length, info: findings.filter(function(x) { return x.severity === 'info'; }).length } };
  }
  function compareSnapshots(beforeSource, afterSource) {
    var before = analyzeSetCookies(beforeSource), after = analyzeSetCookies(afterSource), oldMap = new Map(before.cookies.map(function(c) { return [c.name, c]; })), newMap = new Map(after.cookies.map(function(c) { return [c.name, c]; })), changes = [];
    oldMap.forEach(function(cookie, name) {
      if (!newMap.has(name)) { changes.push(issue('warning', 'cookie-removed', name, 'Cookie was removed')); return; }
      var next = newMap.get(name);
      ['secure', 'httponly', 'partitioned'].forEach(function(flagName) {
        if (flag(cookie, flagName) !== flag(next, flagName)) changes.push(issue(flag(next, flagName) ? 'info' : 'error', 'attribute-' + flagName, name, flagName + ' changed to ' + (flag(next, flagName) ? 'enabled' : 'disabled')));
      });
      var oldSame = text(cookie.attributes.samesite), newSame = text(next.attributes.samesite);
      if (oldSame.toLowerCase() !== newSame.toLowerCase()) changes.push(issue(newSame.toLowerCase() === 'none' ? 'error' : 'warning', 'attribute-samesite', name, 'SameSite changed from ' + (oldSame || 'unset') + ' to ' + (newSame || 'unset')));
    });
    newMap.forEach(function(cookie, name) { if (!oldMap.has(name)) changes.push(issue('info', 'cookie-added', name, 'Cookie was added')); });
    changes.sort(function(a, b) { return SEVERITY[a.severity] - SEVERITY[b.severity] || a.cookie.localeCompare(b.cookie); });
    return { before: before, after: after, changes: changes, summary: { errors: changes.filter(function(x) { return x.severity === 'error'; }).length, warnings: changes.filter(function(x) { return x.severity === 'warning'; }).length, info: changes.filter(function(x) { return x.severity === 'info'; }).length } };
  }
  function generateTemplate(options) { var o = options || {}, name = text(o.name, '__Host-session'), same = text(o.sameSite, 'Lax'); return name + '=REPLACE_WITH_RANDOM_VALUE; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=' + same; }
  function formatMarkdown(report) { var lines = ['# Cookie Sentry', '', '- Cookies: ' + report.summary.cookies, '- Errors: ' + report.summary.errors, '- Warnings: ' + report.summary.warnings, '']; report.findings.forEach(function(f) { lines.push('- **' + f.severity.toUpperCase() + '** `' + f.cookie + '` - ' + f.message); }); return lines.join('\n') + '\n'; }
  return { parseCookieHeader: parseCookieHeader, parseSetCookie: parseSetCookie, analyzeSetCookies: analyzeSetCookies, compareSnapshots: compareSnapshots, generateTemplate: generateTemplate, formatMarkdown: formatMarkdown };
}));
