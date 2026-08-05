"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function repository(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lockfile-lens-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [relative, content] of Object.entries(files || {})) {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`);
  }
  return root;
}

function lockfile(records, dependencies) {
  const packages = { "": { name: "fixture", version: "1.0.0", dependencies: dependencies || {} } };
  for (const record of records || []) packages[`node_modules/${record.name}`] = record;
  return { name: "fixture", version: "1.0.0", lockfileVersion: 3, requires: true, packages };
}

function registryPackage(name, version, extra) {
  return { name, version, resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`, integrity: `sha512-${name}-${version}`, ...(extra || {}) };
}

module.exports = { lockfile, registryPackage, repository };
