"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
function repository(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "action-budget-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [relative, content] of Object.entries(files || {})) {
    const destination = path.join(root, relative); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, content);
  }
  return root;
}
module.exports = { repository };
