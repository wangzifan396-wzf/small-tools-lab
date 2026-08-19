"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { TOOLS, matchesTool, toolCard } = require("../app.js");

const root = path.resolve(__dirname, "..");

test("catalog has unique projects and valid local targets", () => {
  assert.equal(TOOLS.length, 115);
  assert.equal(new Set(TOOLS.map((tool) => tool.id)).size, TOOLS.length);
  for (const tool of TOOLS) {
    assert.equal(fs.existsSync(path.join(root, "projects", tool.id)), true, `missing project ${tool.id}`);
    assert.equal(fs.existsSync(path.join(root, tool.docs)), true, `missing docs ${tool.docs}`);
    if (tool.live) assert.equal(fs.existsSync(path.join(root, tool.live, "index.html")), true, `missing live entry ${tool.live}`);
  }
});

test("catalog covers all supported categories", () => {
  assert.deepEqual([...new Set(TOOLS.map((tool) => tool.category))].sort(), ["browser", "cli", "local-ai"]);
  assert.equal(TOOLS.filter((tool) => tool.category === "browser").length, 91);
  assert.equal(TOOLS.filter((tool) => tool.category === "cli").length, 22);
  assert.equal(TOOLS.filter((tool) => tool.category === "local-ai").length, 2);
});

test("search and category filtering are deterministic", () => {
  assert.deepEqual(TOOLS.filter((tool) => matchesTool(tool, "fanout", "all")).map((tool) => tool.id), ["action-budget"]);
  assert.equal(TOOLS.filter((tool) => matchesTool(tool, "local", "browser")).some((tool) => tool.id === "browser-todo"), true);
  assert.equal(TOOLS.filter((tool) => matchesTool(tool, "", "cli")).length, 22);
});

test("cards expose commands as links without inline handlers", () => {
  const html = toolCard(TOOLS[0]); assert.match(html, /Open tool/); assert.match(html, /href=/); assert.doesNotMatch(html, /onclick=/);
});

test("project test scripts avoid shell-dependent quoted globs", () => {
  const projectsRoot = path.join(root, "projects");
  for (const entry of fs.readdirSync(projectsRoot, { withFileTypes: true })) {
    const packagePath = path.join(projectsRoot, entry.name, "package.json");
    if (!entry.isDirectory() || !fs.existsSync(packagePath)) continue;
    const scripts = JSON.parse(fs.readFileSync(packagePath, "utf8")).scripts || {};
    for (const [name, script] of Object.entries(scripts)) {
      assert.doesNotMatch(
        script,
        /node\s+--test(?:\s+--watch)?\s+["'][^"']*[*?][^"']*["']/,
        `${entry.name} ${name} uses a quoted test glob that is not portable across shells`,
      );
    }
  }
});
