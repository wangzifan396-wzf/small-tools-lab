(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TraceAtlas = factory();
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';
  var SEVERITY = { error: 0, warning: 1, info: 2 };
  function text(value, fallback) { return typeof value === 'string' ? value : (fallback || ''); }
  function array(value) { return Array.isArray(value) ? value : []; }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function number(value, fallback) { var n = Number(value); return Number.isFinite(n) ? n : (fallback || 0); }
  function finding(severity, code, span, message, detail) { return { severity: severity, code: code, span: span || '', message: message, detail: detail || '' }; }
  function parseJson(source) {
    if (typeof source !== 'string') return source;
    var input = source.replace(/^\uFEFF/, '').trim();
    if (!input) throw new SyntaxError('Trace document is empty');
    try { return JSON.parse(input); } catch (error) { throw new SyntaxError('Invalid trace JSON: ' + error.message); }
  }
  function attrValue(value) {
    if (!object(value)) return value;
    if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, 'intValue')) return Number(value.intValue);
    if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
    if (Object.prototype.hasOwnProperty.call(value, 'boolValue')) return Boolean(value.boolValue);
    if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) return array(value.arrayValue.values).map(attrValue);
    return value.value !== undefined ? attrValue(value.value) : value;
  }
  function attributes(raw) {
    var result = {};
    if (Array.isArray(raw)) raw.forEach(function(item) { if (item && item.key) result[item.key] = attrValue(item.value); });
    else if (object(raw)) Object.keys(raw).forEach(function(key) { result[key] = attrValue(raw[key]); });
    return result;
  }
  function resourceService(resource) {
    var attrs = attributes(resource && resource.attributes), name = attrs['service.name'] || attrs.service_name;
    return text(name, 'unknown-service');
  }
  function timestamp(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return 0;
    if (n > 1e17) return n / 1e6;
    if (n > 1e14) return n / 1e3;
    if (n > 1e11) return n;
    return n * 1000;
  }
  function normalizeStatus(raw, attrs) {
    var code = raw && (raw.code !== undefined ? raw.code : raw.statusCode);
    if (String(code).toUpperCase() === 'STATUS_CODE_ERROR' || String(code) === '2' || attrs.error === true || attrs['otel.status_code'] === 'ERROR') return 'error';
    return String(code).toUpperCase() === 'STATUS_CODE_UNSET' || code === undefined || code === 0 ? 'unset' : 'ok';
  }
  function normalizeSpan(raw, service, traceId, processName, timeUnit) {
    var attrs = attributes(raw.attributes || raw.tags), startRaw = raw.startTimeUnixNano !== undefined ? raw.startTimeUnixNano : raw.startTime, endRaw = raw.endTimeUnixNano !== undefined ? raw.endTimeUnixNano : raw.endTime;
    var factor = timeUnit === 'nanoseconds' ? 1e6 : timeUnit === 'microseconds' ? 1e3 : 1;
    var start = Number(startRaw) / factor, end = endRaw !== undefined ? Number(endRaw) / factor : 0;
    if (!Number.isFinite(start)) start = 0;
    if (!end || end < start) end = start + Math.max(0, number(raw.duration) / factor);
    var refs = array(raw.references), parent = text(raw.parentSpanId || raw.parentSpanID);
    if (!parent) { var child = refs.find(function(ref) { return String(ref.refType).toUpperCase() === 'CHILD_OF' || String(ref.refType).toUpperCase() === 'FOLLOWS_FROM'; }); parent = text(child && (child.spanID || child.spanId)); }
    var status = normalizeStatus(raw.status, attrs), http = number(attrs['http.status_code'] || attrs['http.response.status_code']);
    if (http >= 500) status = 'error';
    return { traceId: text(raw.traceId || raw.traceID, traceId), spanId: text(raw.spanId || raw.spanID, 'span-' + Math.random().toString(16).slice(2)), parentSpanId: parent, name: text(raw.name, 'unnamed span'), service: service, process: processName || '', start: start, end: end, duration: Math.max(0, end - start), status: status, attributes: attrs, events: array(raw.events), kind: text(raw.kind), httpStatus: http || null };
  }
  function collect(document) {
    var spans = [], format = 'unknown';
    if (Array.isArray(document.data)) {
      format = 'jaeger';
      document.data.forEach(function(trace) { var processes = trace.processes || {}; array(trace.spans).forEach(function(raw) { var process = processes[raw.processID] || {}; spans.push(normalizeSpan(raw, text(process.serviceName, 'unknown-service'), text(raw.traceID), process.serviceName, 'microseconds')); }); });
    } else if (Array.isArray(document.resourceSpans)) {
      format = 'otlp';
      document.resourceSpans.forEach(function(resourceSpan) { var service = resourceService(resourceSpan.resource); array(resourceSpan.scopeSpans || resourceSpan.instrumentationLibrarySpans).forEach(function(scope) { array(scope.spans).forEach(function(raw) { spans.push(normalizeSpan(raw, service, text(raw.traceId), '', 'nanoseconds')); }); }); });
    } else if (Array.isArray(document.spans)) {
      format = 'flat';
      array(document.spans).forEach(function(raw) { spans.push(normalizeSpan(raw, text(raw.service, 'unknown-service'), text(raw.traceId), '', 'milliseconds')); });
    }
    return { format: format, spans: spans };
  }
  function criticalPath(spans) {
    var byParent = new Map(); spans.forEach(function(span) { if (!byParent.has(span.parentSpanId)) byParent.set(span.parentSpanId, []); byParent.get(span.parentSpanId).push(span); });
    function walk(span, seen) { if (seen.has(span.spanId)) return { duration: span.duration, spans: [span] }; var nextSeen = new Set(seen); nextSeen.add(span.spanId); var children = array(byParent.get(span.spanId)); if (!children.length) return { duration: span.duration, spans: [span] }; var best = children.map(function(child) { var path = walk(child, nextSeen); return { duration: span.duration + path.duration, spans: [span].concat(path.spans) }; }).sort(function(a, b) { return b.duration - a.duration; })[0]; return best; }
    var roots = spans.filter(function(span) { return !span.parentSpanId || !spans.some(function(candidate) { return candidate.spanId === span.parentSpanId; }); });
    return roots.map(function(rootSpan) { return walk(rootSpan, new Set()); }).sort(function(a, b) { return b.duration - a.duration; })[0] || { duration: 0, spans: [] };
  }
  function analyzeTrace(source) {
    var document = parseJson(source), collected = collect(document), spans = collected.spans, findings = [], byTrace = new Map(), spanIds = new Set();
    spans.forEach(function(span) { if (!byTrace.has(span.traceId)) byTrace.set(span.traceId, []); byTrace.get(span.traceId).push(span); spanIds.add(span.spanId); if (span.status === 'error') findings.push(finding('error', 'span.error', span.spanId, 'Error span: ' + span.name, span.service)); if (span.duration >= 1000) findings.push(finding('warning', 'span.slow', span.spanId, 'Slow span: ' + span.name, formatDuration(span.duration))); if (span.httpStatus >= 400) findings.push(finding(span.httpStatus >= 500 ? 'error' : 'warning', 'http.status', span.spanId, 'HTTP ' + span.httpStatus + ' in ' + span.name, span.service)); });
    spans.forEach(function(span) { if (span.parentSpanId && !spanIds.has(span.parentSpanId)) findings.push(finding('warning', 'span.orphan', span.spanId, 'Span references a missing parent', span.parentSpanId)); });
    var traces = Array.from(byTrace.entries()).map(function(entry) { var traceId = entry[0], traceSpans = entry[1].sort(function(a, b) { return a.start - b.start; }), start = Math.min.apply(Math, traceSpans.map(function(x) { return x.start; })), end = Math.max.apply(Math, traceSpans.map(function(x) { return x.end; })), path = criticalPath(traceSpans); return { traceId: traceId, spans: traceSpans, duration: Math.max(0, end - start), criticalPath: path, root: traceSpans.find(function(x) { return !x.parentSpanId; }) || traceSpans[0] }; });
    var services = new Map(); spans.forEach(function(span) { if (!services.has(span.service)) services.set(span.service, { service: span.service, spans: 0, errors: 0, totalDuration: 0, maxDuration: 0 }); var service = services.get(span.service); service.spans += 1; service.errors += span.status === 'error' ? 1 : 0; service.totalDuration += span.duration; service.maxDuration = Math.max(service.maxDuration, span.duration); });
    var summary = { format: collected.format, spans: spans.length, traces: traces.length, services: services.size, errors: findings.filter(function(x) { return x.severity === 'error'; }).length, warnings: findings.filter(function(x) { return x.severity === 'warning'; }).length, maxTraceDuration: traces.reduce(function(max, trace) { return Math.max(max, trace.duration); }, 0), criticalPath: traces.reduce(function(max, trace) { return Math.max(max, trace.criticalPath.duration); }, 0) };
    findings.sort(function(a, b) { return SEVERITY[a.severity] - SEVERITY[b.severity] || a.span.localeCompare(b.span) || a.code.localeCompare(b.code); });
    return { format: collected.format, spans: spans, traces: traces, services: Array.from(services.values()).sort(function(a, b) { return b.totalDuration - a.totalDuration; }), findings: findings, summary: summary };
  }
  function formatDuration(ms) { if (!Number.isFinite(ms)) return '0 ms'; if (ms < 1) return (ms * 1000).toFixed(1) + ' µs'; if (ms < 1000) return Math.round(ms) + ' ms'; return (ms / 1000).toFixed(2) + ' s'; }
  function compareTraces(beforeSource, afterSource) {
    var before = beforeSource && beforeSource.summary ? beforeSource : analyzeTrace(beforeSource), after = afterSource && afterSource.summary ? afterSource : analyzeTrace(afterSource), oldMap = new Map(before.services.map(function(x) { return [x.service, x]; })), changes = [];
    after.services.forEach(function(service) { var old = oldMap.get(service.service); if (!old) { changes.push(finding('info', 'service.added', service.service, 'Service appeared in the candidate trace')); return; } var oldAverage = old.totalDuration / Math.max(1, old.spans), newAverage = service.totalDuration / Math.max(1, service.spans), delta = newAverage - oldAverage; if (delta > Math.max(25, oldAverage * 0.2)) changes.push(finding('warning', 'service.regression', service.service, 'Average service span duration increased', formatDuration(delta))); if (service.errors > old.errors) changes.push(finding('error', 'service.errors', service.service, 'Service has more error spans', old.errors + ' -> ' + service.errors)); oldMap.delete(service.service); });
    oldMap.forEach(function(service) { changes.push(finding('info', 'service.removed', service.service, 'Service disappeared from the candidate trace')); });
    var durationDelta = after.summary.maxTraceDuration - before.summary.maxTraceDuration; if (durationDelta > Math.max(50, before.summary.maxTraceDuration * 0.2)) changes.push(finding('warning', 'trace.regression', 'trace', 'Longest trace duration increased', formatDuration(durationDelta)));
    changes.sort(function(a, b) { return SEVERITY[a.severity] - SEVERITY[b.severity] || a.span.localeCompare(b.span); });
    return { before: before, after: after, changes: changes, summary: { errors: changes.filter(function(x) { return x.severity === 'error'; }).length, warnings: changes.filter(function(x) { return x.severity === 'warning'; }).length, info: changes.filter(function(x) { return x.severity === 'info'; }).length } };
  }
  function filterFindings(findings, options) { var opts = options || {}, query = text(opts.query).toLowerCase(); return findings.filter(function(x) { if (opts.severity && opts.severity !== 'all' && x.severity !== opts.severity) return false; return !query || (x.code + ' ' + x.span + ' ' + x.message + ' ' + x.detail).toLowerCase().includes(query); }); }
  function formatMarkdown(report) { var lines = ['# Trace Atlas', '', '- Format: ' + report.summary.format, '- Spans: ' + report.summary.spans, '- Traces: ' + report.summary.traces, '- Services: ' + report.summary.services, '- Errors: ' + report.summary.errors, '- Warnings: ' + report.summary.warnings, '- Longest trace: ' + formatDuration(report.summary.maxTraceDuration), '']; report.findings.forEach(function(x) { lines.push('- **' + x.severity.toUpperCase() + '** `' + x.code + '` - ' + x.message + (x.detail ? ' (' + x.detail + ')' : '')); }); return lines.join('\n') + '\n'; }
  return { parseJson: parseJson, analyzeTrace: analyzeTrace, compareTraces: compareTraces, filterFindings: filterFindings, formatMarkdown: formatMarkdown, formatDuration: formatDuration };
}));
