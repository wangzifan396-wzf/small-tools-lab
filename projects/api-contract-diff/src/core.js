(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApiContractDiff = factory();
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  var METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
  var STATUS = /^\d{3}$/;
  var SEVERITY_RANK = { breaking: 0, warning: 1, info: 2 };

  function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function array(value) { return Array.isArray(value) ? value : []; }
  function text(value, fallback) { return typeof value === 'string' ? value : (fallback || ''); }
  function issue(severity, code, path, message, extra) {
    return Object.assign({ severity: severity, code: code, path: path, message: message }, extra || {});
  }
  function parseJson(source) {
    if (typeof source !== 'string') return source;
    var input = source.replace(/^\uFEFF/, '').trim();
    if (!input) throw new SyntaxError('OpenAPI document is empty');
    try { return JSON.parse(input); } catch (error) { throw new SyntaxError('Invalid OpenAPI JSON: ' + error.message); }
  }
  function resolveRef(value, document, seen) {
    if (!isObject(value) || typeof value.$ref !== 'string') return value;
    var ref = value.$ref;
    if (ref.indexOf('#/') !== 0) return value;
    var key = ref.slice(2).split('/').map(function(part) { return part.replace(/~1/g, '/').replace(/~0/g, '~'); });
    var current = document;
    for (var i = 0; i < key.length; i += 1) { if (!isObject(current) && !Array.isArray(current)) return value; current = current[key[i]]; }
    if (current === undefined) return value;
    var visited = seen || {};
    if (visited[ref]) return {};
    visited[ref] = true;
    return resolveRef(current, document, visited);
  }
  function versionOf(document) {
    if (typeof document.openapi === 'string') return document.openapi;
    if (typeof document.swagger === 'string') return document.swagger;
    return '';
  }
  function parseDocument(source) {
    var document = parseJson(source);
    if (!isObject(document)) throw new TypeError('OpenAPI root must be an object');
    var version = versionOf(document);
    if (!version) throw new TypeError('Expected an openapi or swagger version');
    if (document.openapi && !/^3\.\d+(?:\.\d+)?(?:[-+].*)?$/.test(version)) throw new TypeError('Only OpenAPI 3.x documents are supported');
    if (document.swagger && version !== '2.0') throw new TypeError('Only Swagger 2.0 documents are supported');
    if (!isObject(document.paths)) throw new TypeError('OpenAPI paths must be an object');
    return { document: document, version: version, title: text(document.info && document.info.title, 'Untitled API'), operations: normalizeOperations(document) };
  }
  function parameterKey(parameter) { return text(parameter && parameter.name) + '|' + text(parameter && parameter.in); }
  function normalizeParameter(raw, document) {
    var parameter = resolveRef(raw, document) || {};
    var schema = resolveRef(parameter.schema, document) || (isObject(parameter.content) ? resolveRef(parameter.content[Object.keys(parameter.content)[0]] && parameter.content[Object.keys(parameter.content)[0]].schema, document) : {});
    return { name: text(parameter.name, '(unnamed)'), in: text(parameter.in, 'unknown'), required: parameter.required === true || parameter.in === 'path', description: text(parameter.description), schema: schema || {}, key: parameterKey(parameter) };
  }
  function mergeParameters(pathParameters, operationParameters, document) {
    var map = new Map();
    array(pathParameters).concat(array(operationParameters)).forEach(function(raw) {
      var item = normalizeParameter(raw, document);
      if (item.key !== '|') map.set(item.key, item);
    });
    return Array.from(map.values()).sort(function(a, b) { return a.key.localeCompare(b.key); });
  }
  function normalizeRequestBody(operation, document) {
    var body = resolveRef(operation.requestBody, document);
    if (!body && operation.parameters) {
      var form = array(operation.parameters).map(function(p) { return resolveRef(p, document); }).find(function(p) { return p && p.in === 'body'; });
      if (form) body = { required: form.required, content: { 'application/json': { schema: form.schema || {} } } };
    }
    if (!body) return null;
    var content = isObject(body.content) ? body.content : {};
    var media = Object.keys(content).sort()[0] || 'application/json';
    var mediaType = resolveRef(content[media], document) || {};
    return { required: body.required === true, media: media, schema: resolveRef(mediaType.schema, document) || {}, description: text(body.description) };
  }
  function normalizeResponses(operation, document) {
    var responses = resolveRef(operation.responses, document) || {};
    return Object.keys(responses).filter(function(status) { return STATUS.test(status) || status === 'default'; }).sort().map(function(status) {
      var response = resolveRef(responses[status], document) || {};
      var content = isObject(response.content) ? response.content : {};
      var media = Object.keys(content).sort()[0] || '';
      var mediaType = media ? resolveRef(content[media], document) || {} : {};
      return { status: status, description: text(response.description), media: media, schema: resolveRef(mediaType.schema || response.schema, document) || {} };
    });
  }
  function normalizeOperations(document) {
    var operations = [];
    Object.keys(document.paths).sort().forEach(function(path) {
      var item = resolveRef(document.paths[path], document) || {};
      METHODS.forEach(function(method) {
        var operation = resolveRef(item[method], document);
        if (!isObject(operation)) return;
        operations.push({ key: method.toUpperCase() + ' ' + path, method: method.toUpperCase(), path: path, operationId: text(operation.operationId), summary: text(operation.summary), parameters: mergeParameters(item.parameters, operation.parameters, document), requestBody: normalizeRequestBody(operation, document), responses: normalizeResponses(operation, document), security: operation.security === undefined ? document.security : operation.security });
      });
    });
    return operations;
  }
  function schemaType(schema, document) {
    var value = resolveRef(schema, document) || {};
    if (value.type) return value.type;
    if (value.properties || value.required) return 'object';
    if (value.items) return 'array';
    if (value.oneOf || value.anyOf || value.allOf) return 'union';
    return '';
  }
  function schemaName(schema, document) { var value = resolveRef(schema, document) || {}; return schemaType(value, document) || (value.$ref ? value.$ref : 'any'); }
  function propertyMap(schema, document) {
    var value = resolveRef(schema, document) || {};
    return isObject(value.properties) ? value.properties : {};
  }
  function requiredSet(schema, document) { return new Set(array((resolveRef(schema, document) || {}).required)); }
  function compareSchema(oldSchema, newSchema, documentOld, documentNew, path, direction, changes, depth) {
    if ((depth || 0) > 12) return;
    var oldValue = resolveRef(oldSchema, documentOld) || {};
    var newValue = resolveRef(newSchema, documentNew) || {};
    var oldType = schemaType(oldValue, documentOld), newType = schemaType(newValue, documentNew);
    if (oldType && newType && oldType !== newType) changes.push(issue('breaking', 'schema.type-changed', path, 'Schema type changed from ' + oldType + ' to ' + newType));
    var oldRequired = requiredSet(oldValue, documentOld), newRequired = requiredSet(newValue, documentNew);
    newRequired.forEach(function(name) { if (!oldRequired.has(name)) changes.push(issue(direction === 'request' ? 'breaking' : 'warning', 'schema.required-added', path + '.required', 'Required property added: ' + name)); });
    oldRequired.forEach(function(name) { if (!newRequired.has(name)) changes.push(issue(direction === 'response' ? 'breaking' : 'warning', 'schema.required-removed', path + '.required', 'Required property removed: ' + name)); });
    var oldProperties = propertyMap(oldValue, documentOld), newProperties = propertyMap(newValue, documentNew);
    Object.keys(oldProperties).forEach(function(name) {
      if (!(name in newProperties)) { changes.push(issue(direction === 'response' ? 'breaking' : 'warning', 'schema.property-removed', path + '.properties.' + name, 'Property removed: ' + name)); return; }
      compareSchema(oldProperties[name], newProperties[name], documentOld, documentNew, path + '.properties.' + name, direction, changes, (depth || 0) + 1);
    });
    Object.keys(newProperties).forEach(function(name) { if (!(name in oldProperties) && !newRequired.has(name)) changes.push(issue('info', 'schema.property-added', path + '.properties.' + name, 'Optional property added: ' + name)); });
    var oldEnum = array(oldValue.enum), newEnum = array(newValue.enum);
    if (oldEnum.length && newEnum.length) oldEnum.forEach(function(item) { if (newEnum.indexOf(item) < 0) changes.push(issue('breaking', 'schema.enum-removed', path + '.enum', 'Enum value removed: ' + String(item))); });
    if (oldValue.items || newValue.items) compareSchema(oldValue.items || {}, newValue.items || {}, documentOld, documentNew, path + '.items', direction, changes, (depth || 0) + 1);
  }
  function compareParameter(oldParameter, newParameter, operationKey, changes) {
    if (oldParameter.required !== newParameter.required) changes.push(issue(newParameter.required ? 'breaking' : 'info', 'parameter.required-' + (newParameter.required ? 'added' : 'removed'), operationKey + '.parameters.' + newParameter.key, 'Parameter ' + newParameter.name + ' is now ' + (newParameter.required ? 'required' : 'optional')));
    var oldType = schemaName(oldParameter.schema, {}), newType = schemaName(newParameter.schema, {});
    if (oldType !== newType && oldType && newType) changes.push(issue('breaking', 'parameter.type-changed', operationKey + '.parameters.' + newParameter.key, 'Parameter type changed from ' + oldType + ' to ' + newType));
  }
  function compareOperation(oldOperation, newOperation, oldDoc, newDoc, changes) {
    var key = newOperation.key;
    if (oldOperation.operationId && newOperation.operationId && oldOperation.operationId !== newOperation.operationId) changes.push(issue('warning', 'operation-id-changed', key, 'operationId changed from ' + oldOperation.operationId + ' to ' + newOperation.operationId));
    var oldParameters = new Map(oldOperation.parameters.map(function(p) { return [p.key, p]; }));
    var newParameters = new Map(newOperation.parameters.map(function(p) { return [p.key, p]; }));
    oldParameters.forEach(function(parameter, parameterKeyValue) { if (!newParameters.has(parameterKeyValue)) changes.push(issue('warning', 'parameter.removed', key + '.parameters.' + parameterKeyValue, 'Parameter removed: ' + parameter.name)); else compareParameter(parameter, newParameters.get(parameterKeyValue), key, changes); });
    newParameters.forEach(function(parameter, parameterKeyValue) { if (!oldParameters.has(parameterKeyValue)) changes.push(issue(parameter.required ? 'breaking' : 'info', 'parameter.added', key + '.parameters.' + parameterKeyValue, (parameter.required ? 'Required' : 'Optional') + ' parameter added: ' + parameter.name)); });
    if (oldOperation.requestBody && !newOperation.requestBody) changes.push(issue('breaking', 'request-body.removed', key, 'Request body was removed'));
    if (!oldOperation.requestBody && newOperation.requestBody) changes.push(issue(newOperation.requestBody.required ? 'breaking' : 'info', 'request-body.added', key, 'Request body added'));
    if (oldOperation.requestBody && newOperation.requestBody) { if (oldOperation.requestBody.required !== newOperation.requestBody.required) changes.push(issue(newOperation.requestBody.required ? 'breaking' : 'info', 'request-body.required', key, 'Request body is now ' + (newOperation.requestBody.required ? 'required' : 'optional'))); compareSchema(oldOperation.requestBody.schema, newOperation.requestBody.schema, oldDoc, newDoc, key + '.requestBody', 'request', changes, 0); }
    var oldResponses = new Map(oldOperation.responses.map(function(r) { return [r.status, r]; }));
    var newResponses = new Map(newOperation.responses.map(function(r) { return [r.status, r]; }));
    oldResponses.forEach(function(response, status) { if (!newResponses.has(status)) changes.push(issue('breaking', 'response.removed', key + '.responses.' + status, 'Response status removed: ' + status)); else { var next = newResponses.get(status); if (response.media && !next.media) changes.push(issue('breaking', 'response.media-removed', key + '.responses.' + status, 'Response media type removed: ' + response.media)); else if (response.media && next.media && response.media !== next.media) changes.push(issue('breaking', 'response.media-changed', key + '.responses.' + status, 'Response media type changed from ' + response.media + ' to ' + next.media)); compareSchema(response.schema, next.schema, oldDoc, newDoc, key + '.responses.' + status, 'response', changes, 0); } });
    newResponses.forEach(function(response, status) { if (!oldResponses.has(status)) changes.push(issue('info', 'response.added', key + '.responses.' + status, 'Response status added: ' + status)); });
    var oldSecurity = JSON.stringify(oldOperation.security || []), newSecurity = JSON.stringify(newOperation.security || []);
    if (oldSecurity !== newSecurity) changes.push(issue(newOperation.security && newOperation.security.length ? 'breaking' : 'warning', 'security-changed', key, 'Security requirements changed'));
  }
  function compareDocuments(oldSource, newSource) {
    var oldParsed = oldSource && oldSource.operations ? oldSource : parseDocument(oldSource);
    var newParsed = newSource && newSource.operations ? newSource : parseDocument(newSource);
    var oldMap = new Map(oldParsed.operations.map(function(operation) { return [operation.key, operation]; }));
    var newMap = new Map(newParsed.operations.map(function(operation) { return [operation.key, operation]; }));
    var changes = [];
    oldMap.forEach(function(operation, key) { if (!newMap.has(key)) changes.push(issue('breaking', 'operation.removed', key, 'Operation removed')); else compareOperation(operation, newMap.get(key), oldParsed.document, newParsed.document, changes); });
    newMap.forEach(function(operation, key) { if (!oldMap.has(key)) changes.push(issue('info', 'operation.added', key, 'Operation added')); });
    changes.sort(function(a, b) { return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.path.localeCompare(b.path) || a.code.localeCompare(b.code); });
    return { before: oldParsed, after: newParsed, changes: changes, summary: { breaking: changes.filter(function(x) { return x.severity === 'breaking'; }).length, warnings: changes.filter(function(x) { return x.severity === 'warning'; }).length, info: changes.filter(function(x) { return x.severity === 'info'; }).length, beforeOperations: oldParsed.operations.length, afterOperations: newParsed.operations.length, addedOperations: newParsed.operations.filter(function(x) { return !oldMap.has(x.key); }).length, removedOperations: oldParsed.operations.filter(function(x) { return !newMap.has(x.key); }).length } };
  }
  function filterChanges(changes, filter) {
    var options = filter || {}, query = text(options.query).toLowerCase();
    return changes.filter(function(change) { if (options.severity && options.severity !== 'all' && change.severity !== options.severity) return false; if (query && (change.message + ' ' + change.path + ' ' + change.code).toLowerCase().indexOf(query) < 0) return false; return true; });
  }
  function formatMarkdown(diff) {
    var lines = ['# API Contract Diff', '', '- Before operations: ' + diff.summary.beforeOperations, '- After operations: ' + diff.summary.afterOperations, '- Breaking: ' + diff.summary.breaking, '- Warnings: ' + diff.summary.warnings, '- Informational: ' + diff.summary.info, ''];
    if (!diff.changes.length) lines.push('No contract changes detected.');
    else diff.changes.forEach(function(change) { lines.push('- **' + change.severity.toUpperCase() + '** `' + change.code + '` at `' + change.path + '` - ' + change.message); });
    return lines.join('\n') + '\n';
  }
  return { parseDocument: parseDocument, compareDocuments: compareDocuments, filterChanges: filterChanges, formatMarkdown: formatMarkdown, normalizeOperations: normalizeOperations, resolveRef: resolveRef };
}));
