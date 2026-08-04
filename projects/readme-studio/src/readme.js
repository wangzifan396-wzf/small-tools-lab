(function attachReadmeStudio(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ReadmeStudio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createReadmeStudio() {
  "use strict";

  const templates = {
    app: {
      template: "app", name: "Localboard", tagline: "A focused workspace that keeps project data on your device.",
      description: "Localboard is a browser-based workspace for organizing project notes and decisions without accounts, analytics, or a backend.",
      repository: "https://github.com/your-name/localboard", license: "MIT", installCommand: "npm install\nnpm run dev",
      usage: "npm run dev", language: "bash",
      features: ["Local-first data storage", "Keyboard-friendly workflows", "Responsive light and dark themes", "Import and export project data"],
      roadmap: ["Add encrypted backups", "Publish accessibility audit"], stack: ["JavaScript", "CSS", "IndexedDB"]
    },
    library: {
      template: "library", name: "Signal Kit", tagline: "Small, typed primitives for predictable event pipelines.",
      description: "Signal Kit provides composable event primitives with a compact API, deterministic behavior, and no runtime dependencies.",
      repository: "https://github.com/your-name/signal-kit", license: "MIT", installCommand: "npm install signal-kit",
      usage: "import { createSignal } from 'signal-kit';\n\nconst status = createSignal('idle');\nstatus.subscribe(console.log);\nstatus.set('ready');", language: "typescript",
      features: ["Zero runtime dependencies", "First-class TypeScript types", "Deterministic subscriptions", "ESM and CommonJS builds"],
      roadmap: ["Add async iterator helpers", "Publish performance benchmarks"], stack: ["TypeScript", "Vitest", "tsup"]
    },
    cli: {
      template: "cli", name: "Branch Note", tagline: "Turn Git history into concise release notes from the terminal.",
      description: "Branch Note groups conventional commits, creates editable release notes, and writes deterministic Markdown without contacting a remote service.",
      repository: "https://github.com/your-name/branch-note", license: "MIT", installCommand: "npm install --global branch-note",
      usage: "branch-note --from v1.4.0 --output CHANGELOG.md", language: "bash",
      features: ["Conventional commit grouping", "Deterministic Markdown output", "Dry-run and JSON modes", "No network access"],
      roadmap: ["Add custom section rules", "Support monorepo package filters"], stack: ["Node.js", "TypeScript"]
    }
  };

  const defaultToggles = { cover: true, badges: true, toc: true, contributing: true, roadmap: true, license: true };

  function template(name) {
    const selected = templates[name] || templates.app;
    return JSON.parse(JSON.stringify({ ...selected, toggles: defaultToggles, accent: "#52a58d" }));
  }

  function slugify(value) {
    return String(value || "project").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  }

  function badge(label, message, color) {
    const encode = (value) => encodeURIComponent(String(value).replaceAll("-", "--"));
    return `![${label}](https://img.shields.io/badge/${encode(label)}-${encode(message)}-${color})`;
  }

  function techBadge(name) {
    return badge("built with", name, "2f7d68");
  }

  function generateMarkdown(input) {
    const data = { ...template(input.template), ...input, toggles: { ...defaultToggles, ...(input.toggles || {}) } };
    const sections = [`# ${data.name.trim() || "Untitled project"}`, data.tagline.trim()];
    if (data.toggles.cover) sections.push(`![${data.name} cover](docs/cover.png)`);
    if (data.toggles.badges) {
      const badges = [badge("license", data.license, "d9a72f"), badge("status", "active", "2f7d68"), ...data.stack.slice(0, 2).map(techBadge)];
      sections.push(badges.join(" "));
    }
    if (data.description.trim()) sections.push(data.description.trim());

    const contentLinks = [];
    if (data.features.length) contentLinks.push("- [Features](#features)");
    if (data.installCommand.trim()) contentLinks.push("- [Quick start](#quick-start)");
    if (data.usage.trim()) contentLinks.push("- [Usage](#usage)");
    if (data.toggles.roadmap && data.roadmap.length) contentLinks.push("- [Roadmap](#roadmap)");
    if (data.toggles.contributing) contentLinks.push("- [Contributing](#contributing)");
    if (data.toggles.license) contentLinks.push("- [License](#license)");
    if (data.toggles.toc && contentLinks.length) sections.push(`## Contents\n\n${contentLinks.join("\n")}`);
    if (data.features.length) sections.push(`## Features\n\n${data.features.map((item) => `- ${item}`).join("\n")}`);
    if (data.installCommand.trim()) sections.push(`## Quick start\n\n\`\`\`bash\n${data.installCommand.trim()}\n\`\`\``);
    if (data.usage.trim()) sections.push(`## Usage\n\n\`\`\`${data.language.trim() || "text"}\n${data.usage.trim()}\n\`\`\``);
    if (data.stack.length) sections.push(`## Built with\n\n${data.stack.map((item) => `- ${item}`).join("\n")}`);
    if (data.toggles.roadmap && data.roadmap.length) sections.push(`## Roadmap\n\n${data.roadmap.map((item) => `- [ ] ${item}`).join("\n")}`);
    if (data.toggles.contributing) sections.push("## Contributing\n\nContributions are welcome. Please open an issue before starting substantial changes and include tests with behavior changes.");
    if (data.toggles.license) sections.push(`## License\n\nDistributed under the ${data.license} license. See [LICENSE](LICENSE) for details.`);
    return sections.filter(Boolean).join("\n\n") + "\n";
  }

  function sectionCount(markdown) {
    return markdown.split("\n").filter((line) => /^## /.test(line)).length;
  }

  return { badge, generateMarkdown, sectionCount, slugify, techBadge, template, templates };
});
