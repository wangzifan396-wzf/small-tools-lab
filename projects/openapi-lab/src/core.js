(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OpenApiLab = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
  var hasOwn = Function.call.bind(Object.prototype.hasOwnProperty);

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function parseDocument(source) {
    if (isObject(source)) return source;
    if (typeof source !== "string") throw new TypeError("OpenAPI input must be a JSON string or object");
    var text = source.replace(/^\uFEFF/, "").trim();
    if (!text) throw new SyntaxError("OpenAPI document is empty");
    try {
      var parsed = JSON.parse(text);
      if (!isObject(parsed)) throw new SyntaxError("OpenAPI root must be an object");
      return parsed;
    } catch (error) {
      if (error.message === "OpenAPI root must be an object") throw error;
      throw new SyntaxError("Invalid JSON: " + error.message);
    }
  }

  function issue(severity, code, path, message) {
    return { severity: severity, code: code, path: path, message: message };
  }

  function decodePointerPart(part) {
    return decodeURIComponent(part).replace(/~1/g, "/").replace(/~0/g, "~");
  }

  function resolveRef(document, ref, trail) {
    if (typeof ref !== "string") throw new TypeError("$ref must be a string");
    if (!ref.startsWith("#/")) throw new Error("External $ref is not loaded: " + ref);
    var seen = trail || [];
    if (seen.includes(ref)) throw new Error("Circular $ref: " + seen.concat(ref).join(" -> "));
    var value = document;
    var parts = ref.slice(2).split("/").map(decodePointerPart);
    for (var i = 0; i < parts.length; i++) {
      if (!isObject(value) && !Array.isArray(value)) throw new Error("Unresolved $ref: " + ref);
      if (!hasOwn(value, parts[i])) throw new Error("Unresolved $ref: " + ref);
      value = value[parts[i]];
    }
    if (isObject(value) && typeof value.$ref === "string") return resolveRef(document, value.$ref, seen.concat(ref));
    return value;
  }

  function dereference(document, value) {
    return isObject(value) && typeof value.$ref === "string" ? resolveRef(document, value.$ref) : value;
  }

  function validateDocument(document) {
    var problems = [];
    var operationIds = new Map();
    if (!isObject(document)) return [issue("error", "root", "$", "OpenAPI root must be an object")];
    if (typeof document.openapi !== "string" || !/^3\.(?:0|1)\.\d+(?:[-+].*)?$/.test(document.openapi)) {
      problems.push(issue("error", "version", "$.openapi", "Only OpenAPI 3.0.x and 3.1.x documents are supported"));
    }
    if (!isObject(document.info)) problems.push(issue("error", "info", "$.info", "info object is required"));
    else {
      if (typeof document.info.title !== "string" || !document.info.title.trim()) problems.push(issue("error", "title", "$.info.title", "info.title is required"));
      if (typeof document.info.version !== "string" || !document.info.version.trim()) problems.push(issue("error", "info-version", "$.info.version", "info.version is required"));
    }
    if (!isObject(document.paths)) problems.push(issue("error", "paths", "$.paths", "paths object is required"));
    else {
      Object.keys(document.paths).forEach(function (path) {
        if (!path.startsWith("/")) problems.push(issue("error", "path-key", "$.paths[" + JSON.stringify(path) + "]", "Path keys must start with /"));
        var pathItem;
        try { pathItem = dereference(document, document.paths[path]); }
        catch (error) { problems.push(issue("error", "path-ref", "$.paths[" + JSON.stringify(path) + "]", error.message)); return; }
        if (!isObject(pathItem)) {
          problems.push(issue("error", "path-item", "$.paths[" + JSON.stringify(path) + "]", "Path Item must be an object"));
          return;
        }
        var templated = Array.from(path.matchAll(/\{([^}]+)\}/g), function (match) { return match[1]; });
        METHODS.forEach(function (method) {
          if (!hasOwn(pathItem, method)) return;
          var operation = pathItem[method];
          var opPath = "$.paths[" + JSON.stringify(path) + "]." + method;
          if (!isObject(operation)) { problems.push(issue("error", "operation", opPath, "Operation must be an object")); return; }
          if (typeof operation.operationId === "string" && operation.operationId) {
            if (operationIds.has(operation.operationId)) problems.push(issue("error", "operation-id", opPath + ".operationId", "operationId must be unique; first used at " + operationIds.get(operation.operationId)));
            else operationIds.set(operation.operationId, opPath + ".operationId");
          }
          if (!isObject(operation.responses)) problems.push(issue("error", "responses", opPath + ".responses", "responses object is required"));
          else if (Object.keys(operation.responses).length === 0) problems.push(issue("error", "responses-empty", opPath + ".responses", "responses must define at least one response"));
          var parameters = mergeParameters(document, pathItem.parameters, operation.parameters, problems, opPath);
          templated.forEach(function (name) {
            var parameter = parameters.find(function (item) { return item.name === name && item.in === "path"; });
            if (!parameter) problems.push(issue("error", "path-parameter", opPath, "Path template {" + name + "} has no matching path parameter"));
            else if (parameter.required !== true) problems.push(issue("error", "path-required", opPath + ".parameters", "Path parameter " + name + " must set required: true"));
          });
        });
      });
    }
    if (Array.isArray(document.servers)) {
      document.servers.forEach(function (server, index) {
        if (!isObject(server) || typeof server.url !== "string") problems.push(issue("error", "server", "$.servers[" + index + "]", "Server requires a string url"));
      });
    }
    scanRefs(document, document, "$", new WeakSet(), problems);
    return problems;
  }

  function scanRefs(document, value, path, seen, problems) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (isObject(value) && typeof value.$ref === "string") {
      try { resolveRef(document, value.$ref); }
      catch (error) { problems.push(issue(value.$ref.startsWith("#/") ? "error" : "warning", "ref", path + ".$ref", error.message)); }
    }
    Object.keys(value).forEach(function (key) {
      scanRefs(document, value[key], path + "[" + JSON.stringify(key) + "]", seen, problems);
    });
  }

  function mergeParameters(document, pathParameters, operationParameters, problems, basePath) {
    var merged = new Map();
    function add(list, source) {
      if (list === undefined) return;
      if (!Array.isArray(list)) {
        if (problems) problems.push(issue("error", "parameters", basePath + "." + source, "parameters must be an array"));
        return;
      }
      var local = new Set();
      list.forEach(function (raw, index) {
        var parameter;
        try { parameter = dereference(document, raw); }
        catch (error) { if (problems) problems.push(issue("error", "parameter-ref", basePath + "." + source + "[" + index + "]", error.message)); return; }
        if (!isObject(parameter) || typeof parameter.name !== "string" || typeof parameter.in !== "string") {
          if (problems) problems.push(issue("error", "parameter", basePath + "." + source + "[" + index + "]", "Parameter requires name and in"));
          return;
        }
        var identity = parameter.in + ":" + parameter.name;
        if (local.has(identity) && problems) problems.push(issue("error", "parameter-duplicate", basePath + "." + source + "[" + index + "]", "Duplicate parameter " + identity));
        local.add(identity);
        merged.set(identity, parameter);
      });
    }
    add(pathParameters, "pathParameters");
    add(operationParameters, "operationParameters");
    return Array.from(merged.values());
  }

  function expandServer(server) {
    if (!server || typeof server.url !== "string") return "/";
    return server.url.replace(/\{([^}]+)\}/g, function (_, name) {
      var variable = isObject(server.variables) ? server.variables[name] : null;
      return variable && variable.default !== undefined ? String(variable.default) : "{" + name + "}";
    });
  }

  function chooseServer(document, pathItem, operation) {
    var servers = operation.servers || pathItem.servers || document.servers;
    return expandServer(Array.isArray(servers) && servers.length ? servers[0] : { url: "/" });
  }

  function listOperations(document) {
    var result = [];
    if (!isObject(document) || !isObject(document.paths)) return result;
    Object.keys(document.paths).sort().forEach(function (path) {
      var pathItem;
      try { pathItem = dereference(document, document.paths[path]); } catch (_) { return; }
      if (!isObject(pathItem)) return;
      METHODS.forEach(function (method) {
        var operation = pathItem[method];
        if (!isObject(operation)) return;
        result.push({
          id: operation.operationId || method + "-" + path.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          method: method.toUpperCase(),
          path: path,
          summary: operation.summary || operation.description || method.toUpperCase() + " " + path,
          description: operation.description || "",
          tags: Array.isArray(operation.tags) ? operation.tags.slice() : [],
          parameters: mergeParameters(document, pathItem.parameters, operation.parameters),
          requestBody: getRequestBody(document, operation.requestBody),
          responses: isObject(operation.responses) ? Object.keys(operation.responses) : [],
          server: chooseServer(document, pathItem, operation),
          operation: operation,
          pathItem: pathItem,
        });
      });
    });
    return result;
  }

  function getRequestBody(document, raw) {
    if (!raw) return null;
    try {
      var body = dereference(document, raw);
      if (!isObject(body) || !isObject(body.content)) return null;
      var mediaTypes = Object.keys(body.content);
      if (!mediaTypes.length) return null;
      var mediaType = mediaTypes.includes("application/json") ? "application/json" : mediaTypes[0];
      var media = body.content[mediaType];
      return { required: body.required === true, description: body.description || "", mediaType: mediaType, media: media };
    } catch (error) {
      return { error: error.message };
    }
  }

  function sampleFromSchema(document, rawSchema, state) {
    var context = state || { refs: [], depth: 0 };
    if (context.depth > 12) return null;
    if (!isObject(rawSchema)) return null;
    if (rawSchema.example !== undefined) return rawSchema.example;
    if (rawSchema.default !== undefined) return rawSchema.default;
    if (Array.isArray(rawSchema.examples) && rawSchema.examples.length) return rawSchema.examples[0];
    var schema = rawSchema;
    if (typeof schema.$ref === "string") {
      if (context.refs.includes(schema.$ref)) return null;
      try { schema = resolveRef(document, schema.$ref); }
      catch (_) { return null; }
      context = { refs: context.refs.concat(rawSchema.$ref), depth: context.depth + 1 };
    } else context = { refs: context.refs, depth: context.depth + 1 };
    var composite = schema.oneOf || schema.anyOf;
    if (Array.isArray(composite) && composite.length) return sampleFromSchema(document, composite[0], context);
    if (Array.isArray(schema.allOf)) {
      var combined = Object.create(null);
      schema.allOf.forEach(function (part) {
        var value = sampleFromSchema(document, part, context);
        if (isObject(value)) Object.assign(combined, value);
      });
      return combined;
    }
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
    var type = schema.type;
    if (Array.isArray(type)) type = type.find(function (item) { return item !== "null"; }) || type[0];
    if (type === "object" || isObject(schema.properties)) {
      var object = Object.create(null);
      Object.keys(schema.properties || {}).forEach(function (key) {
        object[key] = sampleFromSchema(document, schema.properties[key], context);
      });
      return object;
    }
    if (type === "array") return [sampleFromSchema(document, schema.items || {}, context)];
    if (type === "integer" || type === "number") return schema.minimum !== undefined ? schema.minimum : 0;
    if (type === "boolean") return false;
    if (schema.format === "date-time") return "2026-01-01T00:00:00Z";
    if (schema.format === "date") return "2026-01-01";
    if (schema.format === "email") return "user@example.com";
    if (schema.format === "uuid") return "00000000-0000-4000-8000-000000000000";
    return type === "null" ? null : "string";
  }

  function parameterExample(document, parameter) {
    if (parameter.example !== undefined) return parameter.example;
    if (isObject(parameter.examples)) {
      var first = Object.keys(parameter.examples)[0];
      if (first) {
        var example = parameter.examples[first];
        if (isObject(example) && example.value !== undefined) return example.value;
      }
    }
    var value = sampleFromSchema(document, parameter.schema || {});
    return value === null ? "value" : value;
  }

  function bodyExample(document, requestBody) {
    if (!requestBody || requestBody.error || !isObject(requestBody.media)) return undefined;
    if (requestBody.media.example !== undefined) return requestBody.media.example;
    if (isObject(requestBody.media.examples)) {
      var name = Object.keys(requestBody.media.examples)[0];
      var selected = requestBody.media.examples[name];
      if (isObject(selected) && selected.value !== undefined) return selected.value;
    }
    return sampleFromSchema(document, requestBody.media.schema || {});
  }

  function serializeParameter(parameter, value) {
    if (Array.isArray(value)) return value.map(String).join(",");
    if (isObject(value)) return Object.keys(value).map(function (key) { return key + "," + value[key]; }).join(",");
    return String(value);
  }

  function joinUrl(base, path) {
    if (base === "/") return path;
    return base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
  }

  function buildRequest(document, operation) {
    var warnings = [];
    var url = joinUrl(operation.server || "/", operation.path);
    var query = [];
    var headers = Object.create(null);
    var cookies = [];
    operation.parameters.forEach(function (parameter) {
      var value = parameterExample(document, parameter);
      var rendered = serializeParameter(parameter, value);
      if (parameter.in === "path") url = url.replace("{" + parameter.name + "}", encodeURIComponent(rendered));
      else if (parameter.in === "query") {
        var style = parameter.style || "form";
        var explode = parameter.explode !== undefined ? parameter.explode : style === "form";
        if (style === "deepObject" && isObject(value)) {
          Object.keys(value).forEach(function (key) { query.push(encodeURIComponent(parameter.name + "[" + key + "]") + "=" + encodeURIComponent(String(value[key]))); });
        } else if (style === "form" && Array.isArray(value) && explode) {
          value.forEach(function (item) { query.push(encodeURIComponent(parameter.name) + "=" + encodeURIComponent(String(item))); });
        } else if (style === "form" && isObject(value) && explode) {
          Object.keys(value).forEach(function (key) { query.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value[key]))); });
        } else if (style === "spaceDelimited" && Array.isArray(value)) {
          query.push(encodeURIComponent(parameter.name) + "=" + encodeURIComponent(value.map(String).join(" ")));
        } else if (style === "pipeDelimited" && Array.isArray(value)) {
          query.push(encodeURIComponent(parameter.name) + "=" + encodeURIComponent(value.map(String).join("|")));
        } else {
          query.push(encodeURIComponent(parameter.name) + "=" + encodeURIComponent(rendered));
          if (style !== "form") warnings.push("Query parameter " + parameter.name + " uses unsupported style/value combination " + style + "; generated as a single value");
        }
      }
      else if (parameter.in === "header") headers[parameter.name] = rendered;
      else if (parameter.in === "cookie") cookies.push(parameter.name + "=" + encodeURIComponent(rendered));
    });
    applySecurity(document, operation, query, headers, cookies, warnings);
    if (query.length) url += (url.includes("?") ? "&" : "?") + query.join("&");
    if (cookies.length) { headers.Cookie = cookies.join("; "); warnings.push("Browser fetch cannot set the Cookie header directly"); }
    var body = bodyExample(document, operation.requestBody);
    var bodyText;
    var bodyKind;
    if (body !== undefined) {
      var mediaType = operation.requestBody.mediaType;
      if (mediaType.includes("json")) {
        headers["Content-Type"] = mediaType;
        bodyKind = "json";
        bodyText = JSON.stringify(body, null, 2);
      } else if (mediaType === "application/x-www-form-urlencoded" && isObject(body)) {
        headers["Content-Type"] = mediaType;
        bodyKind = "urlencoded";
        bodyText = Object.keys(body).map(function (key) { return encodeURIComponent(key) + "=" + encodeURIComponent(String(body[key])); }).join("&");
      } else if (mediaType === "multipart/form-data" && isObject(body)) {
        bodyKind = "multipart";
        bodyText = body;
        warnings.push("Multipart examples use text placeholders; replace file fields manually");
      } else {
        headers["Content-Type"] = mediaType;
        bodyKind = "text";
        bodyText = typeof body === "string" ? body : JSON.stringify(body);
        warnings.push("Request media type " + mediaType + " may require manual serialization");
      }
    }
    if (/\{[^}]+\}/.test(url)) warnings.push("Some server or path variables do not have default examples");
    return { method: operation.method, url: url, headers: headers, body: bodyText, bodyKind: bodyKind, warnings: warnings };
  }

  function applySecurity(document, operation, query, headers, cookies, warnings) {
    var requirements = operation.operation.security !== undefined ? operation.operation.security : document.security;
    if (!Array.isArray(requirements) || requirements.length === 0 || !isObject(requirements[0])) return;
    var schemes = isObject(document.components) && isObject(document.components.securitySchemes) ? document.components.securitySchemes : {};
    Object.keys(requirements[0]).forEach(function (name) {
      var scheme;
      try { scheme = dereference(document, schemes[name]); }
      catch (error) { warnings.push(error.message); return; }
      if (!isObject(scheme)) { warnings.push("Security scheme not found: " + name); return; }
      if (scheme.type === "apiKey") {
        if (scheme.in === "header") headers[scheme.name] = "YOUR_API_KEY";
        else if (scheme.in === "query") query.push(encodeURIComponent(scheme.name) + "=YOUR_API_KEY");
        else if (scheme.in === "cookie") cookies.push(scheme.name + "=YOUR_API_KEY");
        else warnings.push("Unsupported apiKey location for " + name);
      } else if (scheme.type === "http" && String(scheme.scheme).toLowerCase() === "basic") {
        headers.Authorization = "Basic BASE64_USERNAME_PASSWORD";
      } else if ((scheme.type === "http" && String(scheme.scheme).toLowerCase() === "bearer") || scheme.type === "oauth2" || scheme.type === "openIdConnect") {
        headers.Authorization = "Bearer YOUR_ACCESS_TOKEN";
      } else {
        warnings.push("Security scheme " + name + " requires manual configuration");
      }
    });
  }

  function shellQuote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
  }

  function generateCurl(request) {
    var lines = ["curl -X " + request.method + " " + shellQuote(request.url)];
    Object.keys(request.headers).forEach(function (key) { lines.push("  -H " + shellQuote(key + ": " + request.headers[key])); });
    if (request.bodyKind === "multipart") Object.keys(request.body).forEach(function (key) { lines.push("  -F " + shellQuote(key + "=" + String(request.body[key]))); });
    else if (request.body !== undefined) lines.push("  --data-raw " + shellQuote(request.body));
    return lines.join(" \\\n");
  }

  function generateFetch(request) {
    var fetchHeaders = Object.assign({}, request.headers);
    if (hasOwn(fetchHeaders, "Cookie")) delete fetchHeaders.Cookie;
    if (request.bodyKind === "multipart") {
      var formLines = ["const form = new FormData();"];
      Object.keys(request.body).forEach(function (key) { formLines.push("form.append(" + JSON.stringify(key) + ", " + JSON.stringify(String(request.body[key])) + ");"); });
      formLines.push("", "const response = await fetch(" + JSON.stringify(request.url) + ", {", "  method: " + JSON.stringify(request.method) + ",");
      if (Object.keys(fetchHeaders).length) formLines.push("  headers: " + JSON.stringify(fetchHeaders, null, 2).replace(/\n/g, "\n  ") + ",");
      formLines.push("  body: form", "});", "if (!response.ok) throw new Error(`HTTP ${response.status}`);", "const data = await response.json();");
      return formLines.join("\n");
    }
    var options = { method: request.method };
    if (Object.keys(fetchHeaders).length) options.headers = fetchHeaders;
    var source = "const response = await fetch(" + JSON.stringify(request.url) + ", " + JSON.stringify(options, null, 2).replace(/\n/g, "\n") ;
    if (request.body !== undefined) {
      source = "const response = await fetch(" + JSON.stringify(request.url) + ", {\n  method: " + JSON.stringify(request.method) + (Object.keys(fetchHeaders).length ? ",\n  headers: " + JSON.stringify(fetchHeaders, null, 2).replace(/\n/g, "\n  ") : "") + ",\n  body: " + JSON.stringify(request.body) + "\n});";
    } else source += ");";
    return source + "\nif (!response.ok) throw new Error(`HTTP ${response.status}`);\nconst contentType = response.headers.get(\"content-type\") || \"\";\nconst data = response.status === 204 ? null : contentType.includes(\"json\") ? await response.json() : await response.text();";
  }

  function generatePython(request) {
    var lines = ["import requests", "", "response = requests.request(", "    " + JSON.stringify(request.method) + ",", "    " + JSON.stringify(request.url) + ","];
    if (Object.keys(request.headers).length) lines.push("    headers=" + JSON.stringify(request.headers) + ",");
    if (request.bodyKind === "multipart") lines.push("    files={" + Object.keys(request.body).map(function (key) { return JSON.stringify(key) + ": (None, " + JSON.stringify(String(request.body[key])) + ")"; }).join(", ") + "},");
    else if (request.body !== undefined) lines.push("    data=" + JSON.stringify(request.body) + ",");
    lines.push(")", "response.raise_for_status()", "print(response.json())");
    return lines.join("\n");
  }

  function generateCode(document, operation, language) {
    var request = buildRequest(document, operation);
    var code;
    if (language === "curl") code = generateCurl(request);
    else if (language === "fetch") code = generateFetch(request);
    else if (language === "python") code = generatePython(request);
    else throw new Error("Unsupported language: " + language);
    return { code: code, request: request, warnings: request.warnings.slice() };
  }

  function analyze(source) {
    var document = parseDocument(source);
    var issues = validateDocument(document);
    var operations = listOperations(document);
    return {
      document: document,
      issues: issues,
      operations: operations,
      summary: {
        title: isObject(document.info) ? document.info.title || "Untitled API" : "Untitled API",
        version: isObject(document.info) ? document.info.version || "" : "",
        openapi: document.openapi || "",
        operationCount: operations.length,
        errorCount: issues.filter(function (item) { return item.severity === "error"; }).length,
        warningCount: issues.filter(function (item) { return item.severity === "warning"; }).length,
      },
    };
  }

  return {
    METHODS: METHODS.slice(),
    parseDocument: parseDocument,
    resolveRef: resolveRef,
    validateDocument: validateDocument,
    listOperations: listOperations,
    sampleFromSchema: sampleFromSchema,
    buildRequest: buildRequest,
    generateCode: generateCode,
    analyze: analyze,
  };
});
