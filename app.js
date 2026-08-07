"use strict";

const TOOLS = [
  {
    id: "chromacraft",
    name: "ChromaCraft",
    category: "browser",
    label: "Color systems",
    description:
      "Extract perceptual palettes, validate contrast, lock colors, and export CSS, JSON, or Tailwind tokens.",
    tech: "Browser · OKLab · WCAG",
    live: "projects/chromacraft/",
    docs: "projects/chromacraft/README.md",
    featured: true,
  },
  {
    id: "schema-scout",
    name: "Schema Scout",
    category: "browser",
    label: "JSON discovery",
    description:
      "Inspect real JSON samples, measure field coverage, and infer JSON Schema, TypeScript, or path catalogs.",
    tech: "Browser · JSON Schema",
    live: "projects/schema-scout/",
    docs: "projects/schema-scout/README.md",
    featured: false,
  },
  {
    id: "timeweave",
    name: "TimeWeave",
    category: "browser",
    label: "Time-zone planning",
    description:
      "Compare working hours across time zones, find shared slots, and export calendar-ready events.",
    tech: "Browser · Intl API",
    live: "projects/timeweave/",
    docs: "projects/timeweave/README.md",
    featured: false,
  },
  {
    id: "readme-studio",
    name: "README Studio",
    category: "browser",
    label: "Project documentation",
    description:
      "Build a structured project README with live preview, badges, optional sections, and Markdown export.",
    tech: "Browser · Markdown",
    live: "projects/readme-studio/",
    docs: "projects/readme-studio/README.md",
    featured: false,
  },
  {
    id: "browser-todo",
    name: "Browser Todo",
    category: "browser",
    label: "Local productivity",
    description:
      "A tiny local-first task list retained from the original Small Tools Lab.",
    tech: "Browser · localStorage",
    live: "projects/browser-todo/",
    docs: "projects/browser-todo/README.md",
    featured: false,
  },
  {
    id: "harnesslint",
    name: "HarnessLint",
    category: "cli",
    label: "Agent configuration",
    description:
      "Lint agent instructions, MCP configuration, permissions, pinned dependencies, and repository harness safety.",
    tech: "Node.js CLI · SARIF",
    docs: "projects/harnesslint/README.md",
    featured: true,
  },
  {
    id: "git-risk-map",
    name: "Git Risk Map",
    category: "cli",
    label: "Review planning",
    description:
      "Turn a Git diff into a transparent, evidence-backed review order using path and change-risk signals.",
    tech: "Node.js CLI · Git",
    docs: "projects/git-risk-map/README.md",
    featured: false,
  },
  {
    id: "forge-ready",
    name: "ForgeReady",
    category: "cli",
    label: "Release readiness",
    description:
      "Audit documentation, community health, quality, security, and release engineering before going public.",
    tech: "Node.js CLI · GitHub Action",
    docs: "projects/forge-ready/README.md",
    featured: true,
  },
  {
    id: "patchbrief",
    name: "PatchBrief",
    category: "cli",
    label: "AI review context",
    description:
      "Build minimal, redacted, token-budgeted context packets around a Git change for agents and reviewers.",
    tech: "Node.js CLI · Git",
    docs: "projects/patchbrief/README.md",
    featured: true,
  },
  {
    id: "env-matrix",
    name: "Env Matrix",
    category: "cli",
    label: "Configuration contracts",
    description:
      "Map environment variables across source, examples, CI, containers, deployment files, and docs.",
    tech: "Node.js CLI · GitHub Action",
    docs: "projects/env-matrix/README.md",
    featured: true,
  },
  {
    id: "action-budget",
    name: "Action Budget",
    category: "cli",
    label: "CI cost exposure",
    description:
      "Expand GitHub Actions matrices and expose job fanout, concurrency, timeout limits, and unknown cost.",
    tech: "Node.js CLI · YAML",
    docs: "projects/action-budget/README.md",
    featured: true,
  },
  {
    id: "lockfile-lens",
    name: "Lockfile Lens",
    category: "cli",
    label: "Dependency review",
    description:
      "Explain npm lockfile risk across sources, integrity, install scripts, registry drift, and pull-request changes.",
    tech: "Node.js CLI · Supply chain",
    docs: "projects/lockfile-lens/README.md",
    featured: true,
  },
  {
    id: "log-sift",
    name: "Log Sift",
    category: "cli",
    label: "Agent-ready logs",
    description:
      "Compress noisy logs into deterministic, redacted, error-first context within an explicit token budget.",
    tech: "Node.js CLI · Redaction",
    docs: "projects/log-sift/README.md",
    featured: true,
  },
  {
    id: "ignore-doctor",
    name: "Ignore Doctor",
    category: "cli",
    label: "Repository boundaries",
    description:
      "Audit Git, Docker, npm, and formatter ignore rules for leaks, dangerous negations, and context bloat.",
    tech: "Node.js CLI · Ignore rules",
    docs: "projects/ignore-doctor/README.md",
    featured: true,
  },
  {
    id: "port-matrix",
    name: "Port Matrix",
    category: "cli",
    label: "Port contracts",
    description:
      "Map ports across code, environment files, containers, orchestration, and docs to expose drift and collisions.",
    tech: "Node.js CLI · YAML",
    docs: "projects/port-matrix/README.md",
    featured: true,
  },
  {
    id: "local-kb",
    name: "Local KB",
    category: "local-ai",
    label: "Private RAG",
    description:
      "Index local documents with Ollama embeddings and SQLite, then answer questions with a local chat model.",
    tech: "Python · Ollama · SQLite",
    docs: "projects/local-kb/README.md",
    featured: false,
  },
  {
    id: "screenshot-qa",
    name: "Screenshot QA",
    category: "local-ai",
    label: "OCR assistance",
    description:
      "Extract screenshot text locally and ask an Ollama or DeepSeek model for an actionable explanation.",
    tech: "Python · OCR · Ollama",
    docs: "projects/screenshot-qa/README.md",
    featured: false,
  },
  {
    id: "leafnote",
    name: "Leafnote",
    category: "browser",
    label: "Local Markdown notes",
    description:
      "Local-first Markdown notes & knowledge base with wiki-links, backlinks, tags, full-text search, and XSS-safe rendering. Data stays in your browser.",
    tech: "Browser · localStorage",
    live: "projects/leafnote/",
    docs: "projects/leafnote/README.md",
    featured: false,
  },
  {
    id: "sketchly",
    name: "Sketchly",
    category: "browser",
    label: "Hand-drawn whiteboard",
    description:
      "Local-first infinite-canvas whiteboard with a hand-drawn renderer, shapes, undo/redo, and PNG/JSON export. Works offline.",
    tech: "Browser · Canvas",
    live: "projects/sketchly/",
    docs: "projects/sketchly/README.md",
    featured: false,
  },
  {
    id: "subzen",
    name: "Subzen",
    category: "cli",
    label: "Subtitle toolkit",
    description:
      "Zero-dependency subtitle parser, quality linter and auto-fixer with first-class CJK typography (line width, spacing, kinsoku).",
    tech: "Node.js CLI · SRT/VTT/ASS",
    docs: "projects/subzen/README.md",
    featured: false,
  },
  {
    id: "diffwords",
    name: "Diffwords",
    category: "cli",
    label: "Word-level text diff",
    description:
      "Word-level, CJK-aware text differ that renders inline, unified, standalone HTML, and JSON — far finer than line-based diff for prose.",
    tech: "Node.js CLI · LCS",
    docs: "projects/diffwords/README.md",
    featured: false,
  },
  {
    id: "cronly",
    name: "Cronly",
    category: "cli",
    label: "Cron toolkit",
    description:
      "Parse, validate, and describe cron expressions in English or Chinese, and compute next/previous run times with timezone and DST handling.",
    tech: "Node.js CLI · Intl",
    docs: "projects/cronly/README.md",
    featured: false,
  },
  {
    id: "quanty",
    name: "Quanty",
    category: "cli",
    label: "Number & byte formatting",
    description:
      "Zero-dependency number and byte formatting: formatBytes/parseBytes, grouped numbers, SI or Chinese compact notation, and ordinals.",
    tech: "Node.js CLI · Intl",
    docs: "projects/quanty/README.md",
    featured: false,
  },
  {
    id: "hashforge",
    name: "Hashforge",
    category: "cli",
    label: "Hash · HMAC · codec",
    description:
      "Zero-dependency hashing, HMAC and codec toolkit (SHA-1/256/384/512, HMAC, base64/hex) built on Web Crypto — runs in Node and the browser.",
    tech: "Node.js · Web Crypto",
    docs: "projects/hashforge/README.md",
    featured: false,
  },
  {
    id: "jsonq",
    name: "Jsonq",
    category: "cli",
    label: "JSON query & transform",
    description:
      "Zero-dependency JSON query & transform: get by path, pick/omit keys, filter arrays, sort — for the CLI and the browser.",
    tech: "Node.js CLI · ESM",
    docs: "projects/jsonq/README.md",
    featured: false,
  },
  {
    id: "unit-convert",
    name: "Unit Convert",
    category: "cli",
    label: "Zero-dependency unit converter",
    description:
      "Convert across length, mass, temperature, speed, data (decimal + binary), time, area, volume, energy, pressure — for the CLI and the browser.",
    tech: "Node.js CLI · ESM",
    live: "projects/unit-convert/playground/",
    docs: "projects/unit-convert/README.md",
    featured: false,
  },
  {
    id: "regex-visualizer",
    name: "Regex Visualizer",
    category: "browser",
    label: "Regex explainer",
    description:
      "Explain a regular expression token by token, find every match, and render an HTML-safe highlight — pure, zero-dependency, in the CLI and the browser.",
    tech: "Browser · RegExp",
    live: "projects/regex-visualizer/",
    docs: "projects/regex-visualizer/README.md",
    featured: false,
  },
  {
    id: "password-strength",
    name: "Password Strength",
    category: "browser",
    label: "Password strength",
    description:
      "Estimate password strength from character-class entropy, with a rough offline crack-time estimate and a checklist of weaknesses. Weak = red, strong = green.",
    tech: "Browser · Entropy",
    live: "projects/password-strength/",
    docs: "projects/password-strength/README.md",
    featured: false,
  },
  {
    id: "text-forge",
    name: "Text Forge",
    category: "cli",
    label: "Text toolkit",
    description:
      "Zero-dependency text toolkit: slugify, case conversion, Unicode normalization, diacritic removal, full/half-width conversion, and whitespace cleaning — for the CLI and the browser.",
    tech: "Node.js CLI · Unicode",
    live: "projects/text-forge/",
    docs: "projects/text-forge/README.md",
    featured: false,
  },
  {
    id: "cron-describe",
    name: "Cron Describe",
    category: "browser",
    label: "Cron 解读",
    description:
      "Zero-dependency cron expression parser + humanizer: turn `分 时 日 月 周` into plain Chinese and list the next run times — in the browser, no build step.",
    tech: "Browser · Cron",
    live: "projects/cron-describe/",
    docs: "projects/cron-describe/README.md",
    featured: false,
  },
  {
    id: "ctxcalc",
    name: "CtxCalc",
    category: "browser",
    label: "上下文 / Token 估算",
    description:
      "Zero-dependency context / token estimator: estimate prompt tokens (mixed CJK + Latin), check fit against a model's context window, and preview illustrative cost — in the browser, no build step.",
    tech: "Browser · Estimator",
    live: "projects/ctxcalc/",
    docs: "projects/ctxcalc/README.md",
    featured: false,
  },
  {
    id: "jwtpeek",
    name: "JwtPeek",
    category: "browser",
    label: "JWT 解码",
    description:
      "Zero-dependency JWT decoder: decode the header and payload of a token, surface expiry / issued / not-before timing, and show a clear verdict — in the browser, no build step. Decode only, no signature verification.",
    tech: "Browser · JWT",
    live: "projects/jwtpeek/",
    docs: "projects/jwtpeek/README.md",
    featured: false,
  },
  {
    id: "radix",
    name: "Radix",
    category: "browser",
    label: "进制 / 数位转换",
    description:
      "Zero-dependency number base converter: convert across bases 2–36 with BigInt-exact math and inspect binary / octal / decimal / hex plus a bit & byte view — in the browser, no build step.",
    tech: "Browser · BigInt",
    live: "projects/radix/",
    docs: "projects/radix/README.md",
    featured: false,
  },
  {
    id: "epoch",
    name: "Epoch",
    category: "browser",
    label: "时间戳转换",
    description:
      "Zero-dependency Unix timestamp ⇄ date converter: local / UTC / ISO 8601, auto-detect seconds vs milliseconds, and show relative duration — in the browser, no build step.",
    tech: "Browser · Date",
    live: "projects/epoch/",
    docs: "projects/epoch/README.md",
    featured: false,
  },
  {
    id: "wordcount",
    name: "Word Count",
    category: "browser",
    label: "文本统计",
    description:
      "Zero-dependency text statistics for mixed CJK + Latin text: characters, words, lines, paragraphs, sentences, and an estimated reading time — in the browser, no build step.",
    tech: "Browser · Unicode",
    live: "projects/wordcount/",
    docs: "projects/wordcount/README.md",
    featured: false,
  },
  {
    id: "csvjson",
    name: "CSV ⇄ JSON",
    category: "browser",
    label: "表格转换",
    description:
      "Zero-dependency CSV ⇄ JSON converter with a correct quoted-field parser (commas / newlines / quotes), auto-detected delimiters, and RFC4180 escaping — in the browser, no build step.",
    tech: "Browser · Parser",
    live: "projects/csvjson/",
    docs: "projects/csvjson/README.md",
    featured: false,
  },
  {
    id: "uuidgen",
    name: "UUID Gen",
    category: "browser",
    label: "唯一标识生成",
    description:
      "Zero-dependency RFC4122 v4 UUID generator: batch up to 200, toggle dashes and uppercase, and require cryptographically secure randomness — in the browser, no build step.",
    tech: "Browser · Crypto",
    live: "projects/uuidgen/",
    docs: "projects/uuidgen/README.md",
    featured: false,
  },
  {
    id: "base64",
    name: "Base64 编解码",
    category: "browser",
    label: "文本编码",
    description:
      "UTF-8 安全的 Base64 编解码，用 TextEncoder/TextDecoder 正确处理中文与 emoji，支持编码、解码、互换与复制，纯浏览器零依赖。",
    tech: "Browser · Encoding",
    live: "projects/base64/",
    docs: "projects/base64/README.md",
    featured: false,
  },
  {
    id: "jsonfmt",
    name: "JSON 格式化",
    category: "browser",
    label: "数据美化",
    description:
      "JSON 美化（缩进）、压缩（单行）与仅校验三种模式，错误定位清晰，纯浏览器零依赖。",
    tech: "Browser · Format",
    live: "projects/jsonfmt/",
    docs: "projects/jsonfmt/README.md",
    featured: false,
  },
  {
    id: "colorconv",
    name: "颜色转换",
    category: "browser",
    label: "色彩工具",
    description:
      "HEX ⇄ RGB ⇄ HSL 互转，实时色块预览，支持常见格式解析，纯浏览器零依赖。",
    tech: "Browser · Color",
    live: "projects/colorconv/",
    docs: "projects/colorconv/README.md",
    featured: false,
  },
  {
    id: "agent-trace",
    name: "Agent Trace",
    category: "cli",
    label: "本地 Agent 会话分析",
    description:
      "Analyze Codex, Claude Code, and generic JSONL traces for tokens, tool latency, repeated reads, and failure loops without exposing prompt bodies.",
    tech: "Node.js · JSONL · Local-first",
    docs: "projects/agent-trace/README.md",
    featured: true,
  },
  {
    id: "skill-sentry",
    name: "Skill Sentry",
    category: "cli",
    label: "Agent Skill 安全扫描",
    description:
      "Scan SKILL.md packages for prompt injection, exfiltration, hidden Unicode, destructive commands, unsafe references, and supply-chain risk.",
    tech: "Node.js · Security · SARIF",
    docs: "projects/skill-sentry/README.md",
    featured: true,
  },
];

const CATEGORY_NAMES = {
  all: "All",
  browser: "Browser",
  cli: "CLI",
  "local-ai": "Local AI",
};

function matchesTool(tool, query, category) {
  const categoryMatch = category === "all" || tool.category === category;
  const haystack =
    `${tool.name} ${tool.label} ${tool.description} ${tool.tech}`.toLowerCase();
  return categoryMatch && (!query || haystack.includes(query.toLowerCase()));
}

function toolCard(tool) {
  const primary = tool.live
    ? `<a class="button primary" href="${tool.live}">Open tool <span aria-hidden="true">↗</span></a>`
    : `<a class="button primary" href="${tool.docs}">Read docs <span aria-hidden="true">→</span></a>`;
  const secondary = tool.live
    ? `<a class="button ghost" href="${tool.docs}">Docs</a>`
    : `<a class="button ghost" href="${tool.docs.replace("README.md", "")}">Source</a>`;
  return `<article class="tool-card${tool.featured ? " featured" : ""}" data-category="${tool.category}">
    <div class="card-top"><span class="category">${CATEGORY_NAMES[tool.category]}</span>${tool.featured ? '<span class="signal">Featured</span>' : ""}</div>
    <h2>${tool.name}</h2><p class="label">${tool.label}</p><p class="description">${tool.description}</p>
    <div class="tech">${tool.tech}</div><div class="actions">${primary}${secondary}</div>
  </article>`;
}

function startPortal(documentObject) {
  const grid = documentObject.querySelector("#tool-grid");
  const search = documentObject.querySelector("#search");
  const count = documentObject.querySelector("#visible-count");
  let category = "all";
  function render() {
    const visible = TOOLS.filter((tool) =>
      matchesTool(tool, search.value.trim(), category),
    );
    grid.innerHTML =
      visible.map(toolCard).join("") ||
      '<div class="empty">No tool matches this filter.</div>';
    count.textContent = String(visible.length);
  }
  search.addEventListener("input", render);
  documentObject.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      category = button.dataset.filter;
      documentObject
        .querySelectorAll("[data-filter]")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      render();
    }),
  );
  render();
}

if (typeof document !== "undefined") startPortal(document);
if (typeof module !== "undefined")
  module.exports = { CATEGORY_NAMES, TOOLS, matchesTool, toolCard };
