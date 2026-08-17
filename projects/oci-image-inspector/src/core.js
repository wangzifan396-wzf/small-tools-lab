(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.OciImageInspector = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var decoder = new TextDecoder("utf-8");
  var SECRET_NAME = /(?:^|[_-])(?:api[_-]?key|auth|authorization|credential|password|passwd|private[_-]?key|secret|session|token)(?:$|[_-])/i;
  var SECRET_ASSIGNMENT = /\b(?:api[_-]?key|auth(?:orization)?|credential|password|passwd|private[_-]?key|secret|session|token)\s*=\s*([^\s;&|]+)/ig;

  function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function string(value, fallback) { return typeof value === "string" ? value : fallback || ""; }
  function array(value) { return Array.isArray(value) ? value : []; }
  function issue(severity, code, path, message) { return { severity: severity, code: code, path: path, message: message }; }
  function text(bytes) { return decoder.decode(bytes).replace(/\0.*$/s, ""); }
  function field(bytes, start, length) { return text(bytes.subarray(start, start + length)).trim(); }

  function tarNumber(bytes) {
    if (!bytes.length) return 0;
    if (bytes[0] & 0x80) {
      var value = BigInt(bytes[0] & 0x7f);
      for (var index = 1; index < bytes.length; index += 1) value = value * 256n + BigInt(bytes[index]);
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Tar numeric field exceeds JavaScript safe integer range");
      return Number(value);
    }
    var raw = text(bytes).replace(/\0/g, "").trim();
    if (!raw) return 0;
    if (!/^[0-7]+$/.test(raw)) throw new SyntaxError("Invalid tar octal field: " + raw);
    return parseInt(raw, 8);
  }

  function headerChecksum(bytes) {
    var sum = 0;
    for (var index = 0; index < 512; index += 1) sum += index >= 148 && index < 156 ? 32 : bytes[index];
    return sum;
  }

  function allZero(bytes) { for (var index = 0; index < bytes.length; index += 1) if (bytes[index] !== 0) return false; return true; }
  function safePath(path) {
    var normalized = string(path).replace(/\\/g, "/").replace(/^\.\//, "");
    var unsafe = normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized) || normalized.split("/").includes("..");
    return { path: normalized, safe: Boolean(normalized) && !unsafe };
  }

  function parseHeader(bytes, offset) {
    if (bytes.length !== 512) throw new RangeError("Truncated tar header at byte " + offset);
    if (allZero(bytes)) return null;
    var name = field(bytes, 0, 100); var prefix = field(bytes, 345, 155);
    var size = tarNumber(bytes.subarray(124, 136)); var storedChecksum = tarNumber(bytes.subarray(148, 156));
    return { name: prefix ? prefix + "/" + name : name, size: size, type: String.fromCharCode(bytes[156] || 48), linkName: field(bytes, 157, 100), mode: field(bytes, 100, 8), mtime: tarNumber(bytes.subarray(136, 148)), checksumValid: storedChecksum === headerChecksum(bytes), offset: offset, dataOffset: offset + 512 };
  }

  function parsePax(bytes) {
    var source = decoder.decode(bytes); var output = Object.create(null); var cursor = 0;
    while (cursor < source.length) {
      var space = source.indexOf(" ", cursor); if (space < 0) break;
      var length = Number(source.slice(cursor, space)); if (!Number.isInteger(length) || length <= 0 || cursor + length > source.length) break;
      var record = source.slice(space + 1, cursor + length).replace(/\n$/, ""); var equals = record.indexOf("=");
      if (equals > 0) output[record.slice(0, equals)] = record.slice(equals + 1); cursor += length;
    }
    return output;
  }

  function merge(object, extra) { Object.keys(extra || {}).forEach(function (key) { object[key] = extra[key]; }); return object; }
  function effectiveSize(header, pax) { var candidate = Number(pax && pax.size); return Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : header.size; }

  function scanTar(bytes, options) {
    var source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); var settings = Object.assign({ maxEntries: 200000, maxMetadataBytes: 1024 * 1024 }, options || {});
    if (source[0] === 0x1f && source[1] === 0x8b) throw new TypeError("Gzip-wrapped archives are not supported; provide the uncompressed tar archive");
    var entries = []; var issues = []; var offset = 0; var pendingLong = ""; var localPax = null; var globalPax = Object.create(null);
    while (offset + 512 <= source.length) {
      var header = parseHeader(source.subarray(offset, offset + 512), offset); if (!header) break;
      var special = header.type === "L" || header.type === "x" || header.type === "g"; var pax = merge(Object.create(null), globalPax); merge(pax, localPax); var size = special ? header.size : effectiveSize(header, pax);
      var padded = Math.ceil(size / 512) * 512; var end = header.dataOffset + size; if (end > source.length || header.dataOffset + padded > source.length) throw new RangeError("Truncated tar entry: " + header.name);
      if (special) {
        if (size > settings.maxMetadataBytes) throw new RangeError("Tar metadata entry is too large");
        var payload = source.subarray(header.dataOffset, end);
        if (header.type === "L") pendingLong = text(payload).trim();
        else if (header.type === "x") localPax = parsePax(payload);
        else merge(globalPax, parsePax(payload));
      } else {
        var chosen = string(pax.path) || pendingLong || header.name; var checked = safePath(chosen);
        var entry = Object.assign({}, header, { name: checked.path, safe: checked.safe, size: size }); entries.push(entry);
        if (!checked.safe) issues.push(issue("error", "unsafe-path", checked.path || "(empty)", "Archive entry uses an unsafe path"));
        if (!header.checksumValid) issues.push(issue("warning", "checksum", checked.path, "Tar header checksum does not match"));
        pendingLong = ""; localPax = null; if (entries.length > settings.maxEntries) throw new RangeError("Tar archive contains too many entries");
      }
      offset = header.dataOffset + padded;
    }
    return { entries: entries, issues: issues, byteLength: source.length };
  }

  async function scanTarBlob(blob, options) {
    if (!blob || typeof blob.slice !== "function" || !Number.isSafeInteger(blob.size)) throw new TypeError("Expected a Blob-like tar source");
    var settings = Object.assign({ maxEntries: 200000, maxMetadataBytes: 1024 * 1024 }, options || {}); var first = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    if (first[0] === 0x1f && first[1] === 0x8b) throw new TypeError("Gzip-wrapped archives are not supported; provide the uncompressed tar archive");
    var entries = []; var issues = []; var offset = 0; var pendingLong = ""; var localPax = null; var globalPax = Object.create(null);
    while (offset + 512 <= blob.size) {
      var headerBytes = new Uint8Array(await blob.slice(offset, offset + 512).arrayBuffer()); var header = parseHeader(headerBytes, offset); if (!header) break;
      var special = header.type === "L" || header.type === "x" || header.type === "g"; var pax = merge(Object.create(null), globalPax); merge(pax, localPax); var size = special ? header.size : effectiveSize(header, pax);
      var padded = Math.ceil(size / 512) * 512; var end = header.dataOffset + size; if (end > blob.size || header.dataOffset + padded > blob.size) throw new RangeError("Truncated tar entry: " + header.name);
      if (special) {
        if (size > settings.maxMetadataBytes) throw new RangeError("Tar metadata entry is too large");
        var payload = new Uint8Array(await blob.slice(header.dataOffset, end).arrayBuffer());
        if (header.type === "L") pendingLong = text(payload).trim(); else if (header.type === "x") localPax = parsePax(payload); else merge(globalPax, parsePax(payload));
      } else {
        var chosen = string(pax.path) || pendingLong || header.name; var checked = safePath(chosen); entries.push(Object.assign({}, header, { name: checked.path, safe: checked.safe, size: size }));
        if (!checked.safe) issues.push(issue("error", "unsafe-path", checked.path || "(empty)", "Archive entry uses an unsafe path"));
        if (!header.checksumValid) issues.push(issue("warning", "checksum", checked.path, "Tar header checksum does not match"));
        pendingLong = ""; localPax = null; if (entries.length > settings.maxEntries) throw new RangeError("Tar archive contains too many entries");
      }
      offset = header.dataOffset + padded;
    }
    return { entries: entries, issues: issues, byteLength: blob.size };
  }

  function sourceSize(source) { return source instanceof Uint8Array ? source.length : source instanceof ArrayBuffer ? source.byteLength : source.size; }
  async function readEntry(source, entry, limit) {
    var max = limit || 16 * 1024 * 1024; if (entry.size > max) throw new RangeError("Archive metadata file is too large: " + entry.name);
    if (source instanceof Uint8Array) return source.subarray(entry.dataOffset, entry.dataOffset + entry.size);
    if (source instanceof ArrayBuffer) return new Uint8Array(source, entry.dataOffset, entry.size);
    return new Uint8Array(await source.slice(entry.dataOffset, entry.dataOffset + entry.size).arrayBuffer());
  }
  async function readJson(source, entry, label) { try { return JSON.parse(decoder.decode(await readEntry(source, entry))); } catch (error) { throw new SyntaxError("Invalid " + label + " JSON in " + entry.name + ": " + error.message); } }

  function digestPath(digest) { var match = /^([A-Za-z0-9_+.-]+):([A-Fa-f0-9]+)$/.exec(string(digest)); return match ? "blobs/" + match[1] + "/" + match[2].toLowerCase() : ""; }
  function entryMap(entries, issues) {
    var map = new Map(); entries.forEach(function (entry) { if (!entry.safe) return; if (map.has(entry.name)) issues.push(issue("warning", "duplicate-entry", entry.name, "Archive contains a duplicate path; the first entry is used")); else map.set(entry.name, entry); }); return map;
  }

  function envList(config) { return array(config && config.Env).filter(function (item) { return typeof item === "string"; }).map(function (item) { var split = item.indexOf("="); return { name: split < 0 ? item : item.slice(0, split), value: split < 0 ? "" : item.slice(split + 1) }; }); }
  function historyAndLayers(config, rawLayers) {
    var layers = rawLayers.map(function (layer, index) { return Object.assign({ index: index, command: "", created: "", author: "", comment: "" }, layer); }); var layerIndex = 0;
    var history = array(config && config.history).map(function (item, index) {
      var value = isObject(item) ? item : {}; var record = { index: index, command: string(value.created_by), created: string(value.created), author: string(value.author), comment: string(value.comment), emptyLayer: Boolean(value.empty_layer), layerIndex: null };
      if (!record.emptyLayer && layerIndex < layers.length) { record.layerIndex = layerIndex; layers[layerIndex].command = record.command; layers[layerIndex].created = record.created; layers[layerIndex].author = record.author; layers[layerIndex].comment = record.comment; layerIndex += 1; } return record;
    });
    return { layers: layers, history: history };
  }

  function normalizeImage(format, id, references, manifestDigest, manifest, config, rawLayers, issues) {
    var runtime = isObject(config.config) ? config.config : isObject(config.container_config) ? config.container_config : {}; var mapped = historyAndLayers(config, rawLayers);
    var image = { id: id, format: format, references: array(references), manifestDigest: string(manifestDigest), architecture: string(config.architecture), os: string(config.os), variant: string(config.variant), created: string(config.created), author: string(config.author), user: string(runtime.User), environment: envList(runtime), labels: isObject(runtime.Labels) ? runtime.Labels : {}, entrypoint: array(runtime.Entrypoint), cmd: array(runtime.Cmd), workingDir: string(runtime.WorkingDir), exposedPorts: Object.keys(isObject(runtime.ExposedPorts) ? runtime.ExposedPorts : {}), volumes: Object.keys(isObject(runtime.Volumes) ? runtime.Volumes : {}), stopSignal: string(runtime.StopSignal), healthcheck: isObject(runtime.Healthcheck) ? runtime.Healthcheck : null, layers: mapped.layers, history: mapped.history, totalSize: mapped.layers.reduce(function (sum, layer) { return sum + layer.size; }, 0), config: config, manifest: manifest, issues: issues.slice() };
    image.findings = diagnoseImage(image); return image;
  }

  async function inspectDocker(source, map, archiveIssues) {
    var manifestEntry = map.get("manifest.json"); if (!manifestEntry) return [];
    var manifestList = await readJson(source, manifestEntry, "Docker manifest"); if (!Array.isArray(manifestList)) throw new TypeError("Docker manifest.json must be an array");
    var images = [];
    for (var index = 0; index < manifestList.length; index += 1) {
      var item = manifestList[index]; if (!isObject(item)) { archiveIssues.push(issue("error", "manifest", "manifest.json[" + index + "]", "Docker manifest item must be an object")); continue; }
      var configEntry = map.get(string(item.Config)); if (!configEntry) { archiveIssues.push(issue("error", "config-missing", string(item.Config), "Docker config entry is missing")); continue; }
      var config = await readJson(source, configEntry, "Docker config"); var rawLayers = [];
      array(item.Layers).forEach(function (path, layerIndex) { var entry = map.get(string(path)); if (!entry) archiveIssues.push(issue("error", "layer-missing", string(path), "Docker layer entry is missing")); else rawLayers.push({ path: entry.name, digest: "", diffId: string(config.rootfs && array(config.rootfs.diff_ids)[layerIndex]), size: entry.size, mediaType: "application/vnd.docker.image.rootfs.diff.tar" }); });
      images.push(normalizeImage("Docker archive", "docker-" + index, array(item.RepoTags), "", item, config, rawLayers, archiveIssues));
    }
    return images;
  }

  async function inspectOciDescriptor(source, map, descriptor, references, images, archiveIssues, depth) {
    if (depth > 3) { archiveIssues.push(issue("error", "index-depth", string(descriptor && descriptor.digest), "OCI index nesting is too deep")); return; }
    var path = digestPath(descriptor && descriptor.digest); var entry = map.get(path);
    if (!path || !entry) { archiveIssues.push(issue("error", "blob-missing", string(descriptor && descriptor.digest), "OCI descriptor blob is missing")); return; }
    var body = await readJson(source, entry, "OCI descriptor"); var mediaType = string(descriptor.mediaType || body.mediaType);
    if (mediaType.includes("image.index") || Array.isArray(body.manifests)) {
      for (var childIndex = 0; childIndex < array(body.manifests).length; childIndex += 1) await inspectOciDescriptor(source, map, body.manifests[childIndex], references, images, archiveIssues, depth + 1); return;
    }
    if (!Array.isArray(body.layers) || !isObject(body.config)) { archiveIssues.push(issue("warning", "unsupported-manifest", string(descriptor.digest), "OCI descriptor is not an image manifest")); return; }
    var configPath = digestPath(body.config.digest); var configEntry = map.get(configPath); if (!configEntry) { archiveIssues.push(issue("error", "config-missing", string(body.config.digest), "OCI image config blob is missing")); return; }
    var config = await readJson(source, configEntry, "OCI config"); var ref = string(descriptor.annotations && descriptor.annotations["org.opencontainers.image.ref.name"]); var refs = ref ? [ref] : references;
    var rawLayers = [];
    array(body.layers).forEach(function (layer, index) { var layerPath = digestPath(layer && layer.digest); var layerEntry = map.get(layerPath); if (!layerEntry) archiveIssues.push(issue("error", "layer-missing", string(layer && layer.digest), "OCI layer blob is missing")); else rawLayers.push({ path: layerPath, digest: string(layer.digest), diffId: string(config.rootfs && array(config.rootfs.diff_ids)[index]), size: layerEntry.size, mediaType: string(layer.mediaType) }); });
    images.push(normalizeImage("OCI image layout", "oci-" + images.length, refs, string(descriptor.digest), body, config, rawLayers, archiveIssues));
  }

  async function inspectOci(source, map, archiveIssues) {
    var layoutEntry = map.get("oci-layout"); var indexEntry = map.get("index.json"); if (!layoutEntry && !indexEntry) return [];
    if (!layoutEntry || !indexEntry) { archiveIssues.push(issue("error", "oci-layout", "archive", "OCI layout requires both oci-layout and index.json")); return []; }
    var layout = await readJson(source, layoutEntry, "OCI layout"); if (layout.imageLayoutVersion !== "1.0.0") archiveIssues.push(issue("warning", "layout-version", "oci-layout", "Expected OCI image layout version 1.0.0"));
    var index = await readJson(source, indexEntry, "OCI index"); var images = [];
    for (var descriptorIndex = 0; descriptorIndex < array(index.manifests).length; descriptorIndex += 1) await inspectOciDescriptor(source, map, index.manifests[descriptorIndex], [], images, archiveIssues, 0);
    return images;
  }

  async function inspectArchive(source, options) {
    var bytes = source instanceof ArrayBuffer ? new Uint8Array(source) : source; var scan = bytes instanceof Uint8Array ? scanTar(bytes, options) : await scanTarBlob(source, options); var issues = scan.issues.slice(); var map = entryMap(scan.entries, issues);
    var docker = await inspectDocker(bytes, map, issues); var oci = await inspectOci(bytes, map, issues); var images = docker.concat(oci);
    if (!images.length && !map.has("manifest.json") && !map.has("index.json")) issues.push(issue("error", "format", "archive", "Archive is neither a Docker save archive nor an OCI image layout"));
    return { format: docker.length && oci.length ? "mixed" : docker.length ? "Docker archive" : oci.length ? "OCI image layout" : "unknown", byteLength: sourceSize(bytes), entries: scan.entries, images: images, issues: issues, summary: { imageCount: images.length, layerCount: images.reduce(function (sum, image) { return sum + image.layers.length; }, 0), totalLayerBytes: images.reduce(function (sum, image) { return sum + image.totalSize; }, 0), findingCount: images.reduce(function (sum, image) { return sum + image.findings.length; }, 0), errorCount: issues.filter(function (item) { return item.severity === "error"; }).length } };
  }

  function finding(severity, code, title, detail, layerIndex) { return { severity: severity, code: code, title: title, detail: detail, layerIndex: Number.isInteger(layerIndex) ? layerIndex : null }; }
  function isRootUser(user) { var normalized = string(user).trim().toLowerCase(); return !normalized || normalized === "0" || normalized === "root" || normalized === "0:0" || normalized.startsWith("root:"); }
  function diagnoseImage(image) {
    var findings = [];
    if (isRootUser(image.user)) findings.push(finding("warning", "root-user", "Container defaults to root", image.user ? "Configured user: " + image.user : "No non-root user is configured"));
    image.environment.forEach(function (item) { if (SECRET_NAME.test("-" + item.name + "-") && item.value) findings.push(finding("error", "secret-env", "Secret-like environment variable", item.name + " is baked into the image configuration")); });
    image.history.forEach(function (item) { SECRET_ASSIGNMENT.lastIndex = 0; if (SECRET_ASSIGNMENT.test(item.command)) findings.push(finding("error", "secret-history", "Secret-like value in build history", "History item " + (item.index + 1) + " contains a credential assignment", item.layerIndex)); SECRET_ASSIGNMENT.lastIndex = 0; if (/(?:curl|wget)[^|\n]*\|\s*(?:sh|bash)\b/i.test(item.command)) findings.push(finding("warning", "remote-pipe", "Remote script piped to a shell", redactCommand(item.command), item.layerIndex)); });
    image.layers.forEach(function (layer) { if (layer.size >= 100 * 1024 * 1024) findings.push(finding("warning", "large-layer", "Large image layer", "Layer " + (layer.index + 1) + " is " + formatBytes(layer.size), layer.index)); });
    var digests = new Set(); image.layers.forEach(function (layer) { var digest = layer.digest || layer.diffId; if (digest && digests.has(digest)) findings.push(finding("warning", "duplicate-layer", "Repeated layer digest", digest, layer.index)); else if (digest) digests.add(digest); });
    if (!image.entrypoint.length && !image.cmd.length) findings.push(finding("warning", "no-command", "No default command", "Neither Entrypoint nor Cmd is configured"));
    if (image.references.some(function (ref) { return /:latest$/.test(ref) || !/[:@]/.test(ref); })) findings.push(finding("info", "floating-tag", "Floating image tag", "One or more archive references use latest or omit a tag"));
    if (!image.labels["org.opencontainers.image.source"] || !image.labels["org.opencontainers.image.revision"]) findings.push(finding("info", "provenance-labels", "Provenance labels are incomplete", "Source and revision OCI labels make an image easier to trace"));
    image.environment.forEach(function (item) { if ((item.name === "NODE_ENV" && item.value.toLowerCase() === "development") || (/^DEBUG$/i.test(item.name) && /^(?:1|true|yes|\*)$/i.test(item.value))) findings.push(finding("info", "debug-env", "Development or debug mode enabled", item.name + "=" + item.value)); });
    image.exposedPorts.forEach(function (port) { if (/^(?:22|2375|2376|9229)\/(?:tcp|udp)$/i.test(port)) findings.push(finding("info", "sensitive-port", "Sensitive service port exposed", port)); });
    var rank = { error: 0, warning: 1, info: 2 }; return findings.sort(function (a, b) { return rank[a.severity] - rank[b.severity]; });
  }

  function redactCommand(command) { return string(command).replace(SECRET_ASSIGNMENT, function (match) { return match.replace(/=.*/, "=[REDACTED]"); }); }
  function safeAnalysis(report) {
    return { format: report.format, byteLength: report.byteLength, summary: report.summary, issues: report.issues, images: report.images.map(function (image) { return { id: image.id, format: image.format, references: image.references, architecture: image.architecture, os: image.os, variant: image.variant, created: image.created, author: image.author, user: image.user, environment: image.environment.map(function (item) { return { name: item.name, value: SECRET_NAME.test("-" + item.name + "-") ? "[REDACTED]" : item.value }; }), labels: image.labels, entrypoint: image.entrypoint, cmd: image.cmd, workingDir: image.workingDir, exposedPorts: image.exposedPorts, volumes: image.volumes, stopSignal: image.stopSignal, healthcheck: image.healthcheck, totalSize: image.totalSize, layers: image.layers.map(function (layer) { return Object.assign({}, layer, { command: redactCommand(layer.command) }); }), history: image.history.map(function (item) { return Object.assign({}, item, { command: redactCommand(item.command) }); }), findings: image.findings }; }) };
  }
  function formatBytes(bytes) { var value = Math.max(0, Number(bytes) || 0); if (value < 1024) return Math.round(value) + " B"; if (value < 1024 * 1024) return (value / 1024).toFixed(value < 10 * 1024 ? 1 : 0) + " KB"; if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0) + " MB"; return (value / (1024 * 1024 * 1024)).toFixed(2) + " GB"; }

  return { scanTar: scanTar, scanTarBlob: scanTarBlob, inspectArchive: inspectArchive, diagnoseImage: diagnoseImage, redactCommand: redactCommand, safeAnalysis: safeAnalysis, formatBytes: formatBytes, digestPath: digestPath };
});
