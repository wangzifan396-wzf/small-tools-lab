"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const I = require("../src/core.js");

const encoder = new TextEncoder();
function write(bytes, offset, length, value) { bytes.set(encoder.encode(String(value)).subarray(0, length), offset); }
function octal(bytes, offset, length, value) { write(bytes, offset, length, Math.floor(value).toString(8).padStart(length - 1, "0") + "\0"); }
function header(name, size, type = "0") {
  const bytes = new Uint8Array(512); write(bytes, 0, 100, name); octal(bytes, 100, 8, 0o644); octal(bytes, 108, 8, 0); octal(bytes, 116, 8, 0); octal(bytes, 124, 12, size); octal(bytes, 136, 12, 0); bytes.fill(32, 148, 156); bytes[156] = type.charCodeAt(0); write(bytes, 257, 6, "ustar\0"); write(bytes, 263, 2, "00");
  let sum = 0; for (const byte of bytes) sum += byte; write(bytes, 148, 8, sum.toString(8).padStart(6, "0") + "\0 "); return bytes;
}
function entry(name, content, type = "0") { const data = content instanceof Uint8Array ? content : encoder.encode(String(content)); return { name, data, type }; }
function tar(entries) {
  const chunks = []; let total = 1024;
  for (const item of entries) { const pad = Math.ceil(item.data.length / 512) * 512; chunks.push(header(item.name, item.data.length, item.type), item.data, new Uint8Array(pad - item.data.length)); total += 512 + pad; }
  chunks.push(new Uint8Array(1024)); const output = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; } return output;
}
function jsonEntry(name, value) { return entry(name, JSON.stringify(value)); }
function dockerArchive(overrides = {}) {
  const config = Object.assign({ architecture: "amd64", os: "linux", created: "2026-08-17T00:00:00Z", author: "Builder", config: { User: "10001", Env: ["NODE_ENV=production", "PORT=3000"], Entrypoint: ["node"], Cmd: ["server.js"], WorkingDir: "/app", ExposedPorts: { "3000/tcp": {} }, Labels: { "org.opencontainers.image.source": "https://example.com/repo", "org.opencontainers.image.revision": "abc123" } }, rootfs: { type: "layers", diff_ids: ["sha256:diff1", "sha256:diff2"] }, history: [{ created_by: "COPY package.json ." }, { created_by: "RUN npm ci" }] }, overrides.config || {});
  const manifest = overrides.manifest || [{ Config: "config.json", RepoTags: ["example/app:1.0.0"], Layers: ["layer1/layer.tar", "layer2/layer.tar"] }];
  return tar([jsonEntry("manifest.json", manifest), jsonEntry("config.json", config), entry("layer1/layer.tar", new Uint8Array(10)), entry("layer2/layer.tar", new Uint8Array(20))]);
}
function ociArchive(options = {}) {
  const configDigest = "sha256:" + "a".repeat(64); const manifestDigest = "sha256:" + "b".repeat(64); const layerDigest = "sha256:" + "c".repeat(64);
  const config = Object.assign({ architecture: "arm64", os: "linux", variant: "v8", created: "2026-08-17T01:00:00Z", config: { User: "65532", Env: ["APP_ENV=production"], Entrypoint: ["/app"] }, rootfs: { type: "layers", diff_ids: ["sha256:" + "d".repeat(64)] }, history: [{ created_by: "COPY app /app" }] }, options.config || {});
  const manifest = { schemaVersion: 2, mediaType: "application/vnd.oci.image.manifest.v1+json", config: { mediaType: "application/vnd.oci.image.config.v1+json", digest: configDigest, size: JSON.stringify(config).length }, layers: [{ mediaType: "application/vnd.oci.image.layer.v1.tar", digest: layerDigest, size: 12 }] };
  const index = { schemaVersion: 2, manifests: [{ mediaType: "application/vnd.oci.image.manifest.v1+json", digest: manifestDigest, size: JSON.stringify(manifest).length, annotations: { "org.opencontainers.image.ref.name": "example/app:arm64" }, platform: { architecture: "arm64", os: "linux" } }] };
  const entries = [jsonEntry("oci-layout", { imageLayoutVersion: options.layoutVersion || "1.0.0" }), jsonEntry("index.json", options.index || index), jsonEntry(I.digestPath(manifestDigest), manifest), jsonEntry(I.digestPath(configDigest), config), entry(I.digestPath(layerDigest), new Uint8Array(12))]; return tar(entries);
}

test("scans regular tar entries without copying payloads", () => {
  const source = tar([entry("a.txt", "hello"), entry("dir/b.txt", "world")]); const scan = I.scanTar(source);
  assert.deepEqual(scan.entries.map((item) => [item.name, item.size, item.checksumValid]), [["a.txt", 5, true], ["dir/b.txt", 5, true]]);
  assert.equal(scan.byteLength, source.length);
});

test("supports Blob-based sparse scanning", async () => {
  const source = dockerArchive(); const scan = await I.scanTarBlob(new Blob([source]));
  assert.equal(scan.entries.length, 4); assert.equal(scan.entries[3].name, "layer2/layer.tar");
});

test("reports unsafe absolute and parent-traversal paths", () => {
  const scan = I.scanTar(tar([entry("../secret", "x"), entry("/absolute", "x")]));
  assert.equal(scan.issues.filter((item) => item.code === "unsafe-path").length, 2);
  assert.equal(scan.entries.every((item) => !item.safe), true);
});

test("reports invalid checksums but continues scanning", () => {
  const source = tar([entry("a.txt", "hello")]); source[0] ^= 1;
  assert.equal(I.scanTar(source).issues[0].code, "checksum");
});

test("rejects gzip wrappers and truncated entries", () => {
  assert.throws(() => I.scanTar(Uint8Array.from([0x1f, 0x8b])), /Gzip/);
  const source = tar([entry("a.txt", "hello")]); assert.throws(() => I.scanTar(source.subarray(0, 516)), /Truncated/);
});

test("honors GNU long-name metadata", () => {
  const long = "very/" + "long/".repeat(20) + "file.json"; const source = tar([entry("././@LongLink", long + "\0", "L"), entry("placeholder", "{}")]);
  assert.equal(I.scanTar(source).entries[0].name, long);
});

test("honors PAX path metadata", () => {
  const path = "metadata/long-config.json"; let record = ` path=${path}\n`; let length = record.length + 2; while (`${length}`.length + record.length !== length) length = `${length}`.length + record.length; record = `${length}${record}`;
  const source = tar([entry("PaxHeader", record, "x"), entry("short", "{}")]); assert.equal(I.scanTar(source).entries[0].name, path);
});

test("limits entry counts and oversized tar metadata", () => {
  assert.throws(() => I.scanTar(tar([entry("a", "1"), entry("b", "2")]), { maxEntries: 1 }), /too many/);
  assert.throws(() => I.scanTar(tar([entry("Long", "12345", "L")]), { maxMetadataBytes: 4 }), /metadata entry/);
});

test("inspects Docker save manifests, configs, tags, platform, and layers", async () => {
  const report = await I.inspectArchive(dockerArchive()); const image = report.images[0];
  assert.equal(report.format, "Docker archive"); assert.equal(report.summary.imageCount, 1); assert.deepEqual(image.references, ["example/app:1.0.0"]); assert.equal(image.architecture, "amd64"); assert.equal(image.os, "linux"); assert.equal(image.totalSize, 30); assert.equal(image.layers[1].diffId, "sha256:diff2");
});

test("maps non-empty build history entries onto layers", async () => {
  const config = { architecture: "amd64", os: "linux", config: {}, rootfs: { diff_ids: ["a", "b"] }, history: [{ created_by: "ENV A=1", empty_layer: true }, { created_by: "COPY a /a" }, { created_by: "RUN build" }] };
  const image = (await I.inspectArchive(dockerArchive({ config }))).images[0];
  assert.equal(image.history[0].layerIndex, null); assert.equal(image.layers[0].command, "COPY a /a"); assert.equal(image.layers[1].command, "RUN build");
});

test("inspects OCI image layouts and descriptor blobs", async () => {
  const report = await I.inspectArchive(ociArchive()); const image = report.images[0];
  assert.equal(report.format, "OCI image layout"); assert.equal(image.architecture, "arm64"); assert.equal(image.variant, "v8"); assert.deepEqual(image.references, ["example/app:arm64"]); assert.equal(image.layers[0].digest, "sha256:" + "c".repeat(64));
});

test("warns about incompatible OCI layout versions", async () => {
  const report = await I.inspectArchive(ociArchive({ layoutVersion: "2.0.0" })); assert.ok(report.issues.some((item) => item.code === "layout-version"));
});

test("reports unknown archive formats", async () => {
  const report = await I.inspectArchive(tar([entry("hello.txt", "world")])); assert.equal(report.format, "unknown"); assert.ok(report.issues.some((item) => item.code === "format"));
});

test("reports Docker configs and layers missing from the archive", async () => {
  const noConfig = tar([jsonEntry("manifest.json", [{ Config: "missing.json", RepoTags: [], Layers: [] }])]); assert.ok((await I.inspectArchive(noConfig)).issues.some((item) => item.code === "config-missing"));
  const missingLayer = tar([jsonEntry("manifest.json", [{ Config: "config.json", RepoTags: [], Layers: ["missing.tar"] }]), jsonEntry("config.json", { config: {}, rootfs: {}, history: [] })]); assert.ok((await I.inspectArchive(missingLayer)).issues.some((item) => item.code === "layer-missing"));
});

test("reports missing OCI descriptor blobs", async () => {
  const digest = "sha256:" + "f".repeat(64); const source = tar([jsonEntry("oci-layout", { imageLayoutVersion: "1.0.0" }), jsonEntry("index.json", { manifests: [{ digest, mediaType: "application/vnd.oci.image.manifest.v1+json" }] })]);
  assert.ok((await I.inspectArchive(source)).issues.some((item) => item.code === "blob-missing"));
});

test("recognizes and rejects malformed digest paths", () => {
  assert.equal(I.digestPath("sha256:ABC123"), "blobs/sha256/abc123"); assert.equal(I.digestPath("../../bad"), "");
});

test("diagnoses root users and absent commands", () => {
  const findings = I.diagnoseImage({ user: "", environment: [], history: [], layers: [], entrypoint: [], cmd: [], references: [], labels: {}, exposedPorts: [] });
  assert.ok(findings.some((item) => item.code === "root-user")); assert.ok(findings.some((item) => item.code === "no-command"));
});

test("diagnoses secret-like environment variables without exposing values", () => {
  const findings = I.diagnoseImage({ user: "1000", environment: [{ name: "API_TOKEN", value: "super-secret" }], history: [], layers: [], entrypoint: ["app"], cmd: [], references: [], labels: { "org.opencontainers.image.source": "x", "org.opencontainers.image.revision": "y" }, exposedPorts: [] });
  assert.equal(findings[0].code, "secret-env"); assert.doesNotMatch(findings[0].detail, /super-secret/);
});

test("diagnoses and redacts secrets in build history", () => {
  const command = "/bin/sh -c TOKEN=abc123 npm run build"; const findings = I.diagnoseImage({ user: "1000", environment: [], history: [{ index: 0, command, layerIndex: 0 }], layers: [{ index: 0, size: 1 }], entrypoint: ["app"], cmd: [], references: [], labels: { "org.opencontainers.image.source": "x", "org.opencontainers.image.revision": "y" }, exposedPorts: [] });
  assert.ok(findings.some((item) => item.code === "secret-history")); assert.equal(I.redactCommand(command), "/bin/sh -c TOKEN=[REDACTED] npm run build");
});

test("diagnoses remote shell pipes, large layers, and repeated digests", () => {
  const image = { user: "1000", environment: [], history: [{ index: 0, command: "curl https://example.com/install | sh", layerIndex: 0 }], layers: [{ index: 0, size: 101 * 1024 * 1024, digest: "sha256:x" }, { index: 1, size: 1, digest: "sha256:x" }], entrypoint: ["app"], cmd: [], references: [], labels: { "org.opencontainers.image.source": "x", "org.opencontainers.image.revision": "y" }, exposedPorts: [] };
  const codes = I.diagnoseImage(image).map((item) => item.code); assert.ok(codes.includes("remote-pipe")); assert.ok(codes.includes("large-layer")); assert.ok(codes.includes("duplicate-layer"));
});

test("diagnoses floating tags, missing provenance, debug mode, and sensitive ports", () => {
  const image = { user: "1000", environment: [{ name: "DEBUG", value: "true" }], history: [], layers: [], entrypoint: ["app"], cmd: [], references: ["example/app:latest"], labels: {}, exposedPorts: ["22/tcp", "9229/tcp"] };
  const codes = I.diagnoseImage(image).map((item) => item.code); for (const code of ["floating-tag", "provenance-labels", "debug-env", "sensitive-port"]) assert.ok(codes.includes(code));
});

test("privacy-safe analysis redacts environment and history secrets", async () => {
  const config = { architecture: "amd64", os: "linux", config: { User: "1000", Env: ["PASSWORD=hunter2"], Entrypoint: ["app"] }, rootfs: { diff_ids: ["a", "b"] }, history: [{ created_by: "RUN TOKEN=abc build" }, { created_by: "COPY app /app" }] };
  const safe = I.safeAnalysis(await I.inspectArchive(dockerArchive({ config }))); assert.equal(safe.images[0].environment[0].value, "[REDACTED]"); assert.match(safe.images[0].history[0].command, /\[REDACTED\]/); assert.equal("config" in safe.images[0], false);
});

test("formats byte sizes at useful boundaries", () => {
  assert.equal(I.formatBytes(0), "0 B"); assert.equal(I.formatBytes(1536), "1.5 KB"); assert.equal(I.formatBytes(2 * 1024 * 1024), "2.0 MB"); assert.equal(I.formatBytes(2 * 1024 * 1024 * 1024), "2.00 GB");
});
