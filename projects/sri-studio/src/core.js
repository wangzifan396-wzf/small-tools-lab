(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SriStudio = factory();
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';
  var ALGORITHMS = ['sha256', 'sha384', 'sha512'];
  var SEVERITY = { error: 0, warning: 1, info: 2 };
  function text(value, fallback) { return typeof value === 'string' ? value : (fallback || ''); }
  function array(value) { return Array.isArray(value) ? value : []; }
  function finding(severity, code, resource, message, detail) { return { severity: severity, code: code, resource: resource, message: message, detail: detail || '' }; }
  function decodeBase64(value) { return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0; }
  function parseIntegrity(source) {
    var errors = [], hashes = [], seen = new Set();
    text(source).trim().split(/\s+/).filter(Boolean).forEach(function(token) {
      var at = token.indexOf('-'), algorithm = at < 0 ? '' : token.slice(0, at).toLowerCase(), digest = at < 0 ? '' : token.slice(at + 1).split('?')[0];
      if (!algorithm || !digest) { errors.push('Malformed integrity token: ' + token); return; }
      if (ALGORITHMS.indexOf(algorithm) < 0) { errors.push('Unsupported integrity algorithm: ' + algorithm); return; }
      var expectedLength = { sha256: 44, sha384: 64, sha512: 88 }[algorithm];
      if (!decodeBase64(digest) || digest.length !== expectedLength) { errors.push('Integrity digest has invalid base64 length: ' + algorithm); return; }
      var key = algorithm + '-' + digest;
      if (seen.has(key)) errors.push('Duplicate integrity token: ' + algorithm);
      seen.add(key); hashes.push({ algorithm: algorithm, digest: digest, token: token });
    });
    return { hashes: hashes, errors: errors };
  }
  function attributes(tag) {
    var result = {}, re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, match;
    while ((match = re.exec(tag))) { var name = match[1].toLowerCase(); if (name !== 'script' && name !== 'link') result[name] = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : ''; }
    return result;
  }
  function extractResources(html, baseUrl) {
    var resources = [], input = text(html), re = /<(script|link)\b[^>]*>/gi, match, index = 0;
    while ((match = re.exec(input))) {
      var attrs = attributes(match[0]), tag = match[1].toLowerCase(), href = tag === 'script' ? attrs.src : attrs.href;
      if (tag === 'link' && !/(^|\s)stylesheet(\s|$)/i.test(attrs.rel || '')) continue;
      if (!href) continue;
      var url = href;
      try { url = new URL(href, baseUrl || 'https://example.com/').toString(); } catch (_) {}
      resources.push({ id: 'resource-' + (++index), kind: tag === 'script' ? 'script' : 'stylesheet', url: url, integrity: text(attrs.integrity), crossorigin: text(attrs.crossorigin), referrerPolicy: text(attrs.referrerpolicy), raw: match[0] });
    }
    return resources;
  }
  function sameOrigin(url, baseUrl) { try { return new URL(url, baseUrl).origin === new URL(baseUrl).origin; } catch (_) { return true; } }
  function auditResources(html, options) {
    var opts = Object.assign({ baseUrl: 'https://app.example.com/', requireIntegrity: true }, options || {}), resources = extractResources(html, opts.baseUrl), findings = [];
    resources.forEach(function(resource) {
      var parsed = parseIntegrity(resource.integrity), external = /^https?:$/i.test((function(){ try { return new URL(resource.url).protocol; } catch (_) { return ''; } })()), cross = external && !sameOrigin(resource.url, opts.baseUrl);
      if (opts.requireIntegrity && external && !resource.integrity) findings.push(finding('error', 'integrity.missing', resource.url, 'External ' + resource.kind + ' has no integrity attribute', 'Pin the exact bytes with a SHA-384 or SHA-512 integrity expression.'));
      parsed.errors.forEach(function(message) { findings.push(finding('error', 'integrity.invalid', resource.url, message)); });
      if (resource.integrity && parsed.hashes.length && parsed.hashes.every(function(hash) { return hash.algorithm === 'sha256'; })) findings.push(finding('info', 'integrity.sha256-only', resource.url, 'Integrity uses SHA-256 only', 'SHA-384 is a common stronger default for published assets.'));
      if (cross && resource.integrity && !resource.crossorigin) findings.push(finding('warning', 'crossorigin.missing', resource.url, 'Cross-origin SRI resource has no crossorigin attribute', 'Use crossorigin="anonymous" and serve the resource with compatible CORS headers.'));
      if (resource.crossorigin && resource.crossorigin.toLowerCase() === 'use-credentials') findings.push(finding('warning', 'crossorigin.credentials', resource.url, 'SRI resource opts into credentials', 'Prefer crossorigin="anonymous" unless credentialed CORS is deliberate.'));
      if (/^http:/i.test(resource.url) && /^https:/i.test(opts.baseUrl)) findings.push(finding('error', 'resource.insecure', resource.url, 'HTTPS document references an HTTP resource', 'Use HTTPS before adding integrity.'));
    });
    findings.sort(function(a, b) { return SEVERITY[a.severity] - SEVERITY[b.severity] || a.resource.localeCompare(b.resource) || a.code.localeCompare(b.code); });
    return { resources: resources, findings: findings, summary: { resources: resources.length, errors: findings.filter(function(x) { return x.severity === 'error'; }).length, warnings: findings.filter(function(x) { return x.severity === 'warning'; }).length, info: findings.filter(function(x) { return x.severity === 'info'; }).length } };
  }
  function base64(bytes) { var binary = ''; for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]); if (typeof btoa === 'function') return btoa(binary); if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64'); throw new Error('No base64 encoder available'); }
  function bytesOf(content) { return new TextEncoder().encode(text(content)); }
  async function generateIntegrity(content, algorithms) {
    var cryptoObject = typeof crypto !== 'undefined' ? crypto : null;
    if (!cryptoObject || !cryptoObject.subtle) throw new Error('Web Crypto is unavailable');
    var bytes = bytesOf(content), selected = array(algorithms).length ? algorithms : ['sha384'], output = [];
    for (var i = 0; i < selected.length; i += 1) { var algorithm = String(selected[i]).toLowerCase(); if (ALGORITHMS.indexOf(algorithm) < 0) throw new Error('Unsupported integrity algorithm: ' + algorithm); var subtleName = algorithm.replace('sha', 'SHA-'); var digest = await cryptoObject.subtle.digest(subtleName, bytes); output.push(algorithm + '-' + base64(new Uint8Array(digest))); }
    return output.join(' ');
  }
  async function verifyIntegrity(content, integrity) {
    var parsed = parseIntegrity(integrity), actual = await generateIntegrity(content, parsed.hashes.map(function(x) { return x.algorithm; })), actualParsed = parseIntegrity(actual), matches = parsed.hashes.map(function(expected) { return { algorithm: expected.algorithm, matches: actualParsed.hashes.some(function(got) { return got.algorithm === expected.algorithm && got.digest === expected.digest; }) }; });
    return { valid: parsed.errors.length === 0 && matches.some(function(x) { return x.matches; }), matches: matches, errors: parsed.errors, generated: actual };
  }
  function compareDocuments(beforeSource, afterSource, options) {
    var before = auditResources(beforeSource, options), after = auditResources(afterSource, options), oldMap = new Map(before.resources.map(function(x) { return [x.kind + ' ' + x.url, x]; })), changes = [];
    after.resources.forEach(function(resource) { var key = resource.kind + ' ' + resource.url, old = oldMap.get(key); if (!old) changes.push(finding('info', 'resource.added', resource.url, 'Resource was added')); else if (old.integrity !== resource.integrity) changes.push(finding(resource.integrity ? 'warning' : 'error', 'integrity.changed', resource.url, 'Integrity expression changed')); oldMap.delete(key); });
    oldMap.forEach(function(resource) { changes.push(finding('warning', 'resource.removed', resource.url, 'Resource was removed')); });
    changes.sort(function(a, b) { return SEVERITY[a.severity] - SEVERITY[b.severity] || a.resource.localeCompare(b.resource); });
    return { before: before, after: after, changes: changes, summary: { errors: changes.filter(function(x) { return x.severity === 'error'; }).length, warnings: changes.filter(function(x) { return x.severity === 'warning'; }).length, info: changes.filter(function(x) { return x.severity === 'info'; }).length } };
  }
  function filterFindings(findings, options) { var opts = options || {}, query = text(opts.query).toLowerCase(); return findings.filter(function(x) { if (opts.severity && opts.severity !== 'all' && x.severity !== opts.severity) return false; return !query || (x.code + ' ' + x.resource + ' ' + x.message).toLowerCase().includes(query); }); }
  function formatMarkdown(report) { var lines = ['# SRI Studio', '', '- Resources: ' + report.summary.resources, '- Errors: ' + report.summary.errors, '- Warnings: ' + report.summary.warnings, '']; report.findings.forEach(function(x) { lines.push('- **' + x.severity.toUpperCase() + '** `' + x.code + '` - ' + x.message + ' (`' + x.resource + '`)'); }); return lines.join('\n') + '\n'; }
  return { parseIntegrity: parseIntegrity, extractResources: extractResources, auditResources: auditResources, generateIntegrity: generateIntegrity, verifyIntegrity: verifyIntegrity, compareDocuments: compareDocuments, filterFindings: filterFindings, formatMarkdown: formatMarkdown };
}));
