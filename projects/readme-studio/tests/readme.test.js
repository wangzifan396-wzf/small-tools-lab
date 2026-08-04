"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Studio = require("../src/readme.js");

test("returns independent project templates", () => {
  const first = Studio.template("library");
  const second = Studio.template("library");
  first.features.push("Changed");
  assert.ok(!second.features.includes("Changed"));
  assert.equal(first.template, "library");
});

test("generates a complete app README", () => {
  const data = Studio.template("app");
  const markdown = Studio.generateMarkdown(data);
  assert.ok(markdown.startsWith(`# ${data.name}\n`));
  assert.match(markdown, /!\[Localboard cover\]\(docs\/cover\.png\)/);
  assert.match(markdown, /## Contents/);
  assert.match(markdown, /## Features/);
  assert.match(markdown, /```bash\nnpm install/);
  assert.match(markdown, /## License\n\nDistributed under the MIT license/);
});

test("respects optional section toggles", () => {
  const data = Studio.template("cli");
  data.toggles = { cover: false, badges: false, toc: false, contributing: false, roadmap: false, license: false };
  const markdown = Studio.generateMarkdown(data);
  assert.doesNotMatch(markdown, /docs\/cover\.png/);
  assert.doesNotMatch(markdown, /img\.shields\.io/);
  assert.doesNotMatch(markdown, /## Contents/);
  assert.doesNotMatch(markdown, /## Roadmap/);
  assert.doesNotMatch(markdown, /## License/);
});

test("uses the selected language for usage fences", () => {
  const data = Studio.template("library");
  const markdown = Studio.generateMarkdown(data);
  assert.match(markdown, /```typescript\nimport \{ createSignal \}/);
});

test("creates stable slugs and badge URLs", () => {
  assert.equal(Studio.slugify("  README Studio 2.0 "), "readme-studio-2-0");
  assert.equal(Studio.slugify("***"), "project");
  assert.match(Studio.badge("built with", "Node.js", "green"), /img\.shields\.io\/badge\/built%20with-Node\.js-green/);
});

test("counts second-level sections", () => {
  assert.equal(Studio.sectionCount("# A\n\n## One\n\n### Detail\n\n## Two\n"), 2);
});
