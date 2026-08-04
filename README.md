# Developer Toolbox · Small Tools Lab

A practical monorepo of browser utilities, explainable developer CLIs, and local AI experiments. Each project stays independently documented, with focused tests where behavior is reusable; the root provides one catalog, one clone, and one verification path.

[![CI](https://github.com/wangzifan396-wzf/small-tools-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/wangzifan396-wzf/small-tools-lab/actions/workflows/ci.yml)
[![Pages](https://img.shields.io/badge/toolbox-live-24735c)](https://wangzifan396-wzf.github.io/small-tools-lab/)
[![license](https://img.shields.io/badge/license-MIT-24735c)](LICENSE)

**[Open the toolbox →](https://wangzifan396-wzf.github.io/small-tools-lab/)**

![Small Tools Lab toolbox catalog](docs/toolbox-preview.png)

## Why one repository

These projects share an engineering style, not one runtime. Browser tools should open immediately, developer CLIs should explain every decision, and local AI experiments should keep private data on the machine by default. A monorepo concentrates discovery and Stars while preserving a clear boundary inside every project folder.

- 13 focused tools in three categories
- 10 Node.js projects with 103 project-level tests
- Two Python local AI experiments with standard-library unit tests
- Zero-account browser tools and no telemetry
- Root catalog, cross-project verification, CI, and GitHub Pages
- Per-project README, screenshots, security guidance, and release metadata where relevant

## Catalog

### Browser tools

| Project | Purpose | Open |
| --- | --- | --- |
| [ChromaCraft](projects/chromacraft/README.md) | Perceptual palette extraction, WCAG contrast, and design-token export | [Launch](https://wangzifan396-wzf.github.io/small-tools-lab/projects/chromacraft/) |
| [Schema Scout](projects/schema-scout/README.md) | Infer JSON Schema, TypeScript, and field coverage from real samples | [Launch](https://wangzifan396-wzf.github.io/small-tools-lab/projects/schema-scout/) |
| [TimeWeave](projects/timeweave/README.md) | Find shared working hours across time zones and export events | [Launch](https://wangzifan396-wzf.github.io/small-tools-lab/projects/timeweave/) |
| [README Studio](projects/readme-studio/README.md) | Compose structured project documentation with live preview | [Launch](https://wangzifan396-wzf.github.io/small-tools-lab/projects/readme-studio/) |
| [Browser Todo](projects/browser-todo/README.md) | Tiny localStorage task list retained from the original lab | [Launch](https://wangzifan396-wzf.github.io/small-tools-lab/projects/browser-todo/) |

### Developer CLIs

| Project | Purpose |
| --- | --- |
| [HarnessLint](projects/harnesslint/README.md) | Audit agent instructions, MCP configuration, permissions, and supply-chain risks |
| [Git Risk Map](projects/git-risk-map/README.md) | Rank changed files for review using transparent Git risk signals |
| [ForgeReady](projects/forge-ready/README.md) | Measure open-source release readiness across five bounded categories |
| [PatchBrief](projects/patchbrief/README.md) | Build minimal, redacted, token-budgeted context around a Git diff |
| [Env Matrix](projects/env-matrix/README.md) | Map environment-variable contracts across source, examples, CI, containers, and docs |
| [Action Budget](projects/action-budget/README.md) | Expose GitHub Actions matrix fanout, concurrency, and timeout exposure |

### Local AI

| Project | Purpose |
| --- | --- |
| [Local KB](projects/local-kb/README.md) | Local document RAG using Ollama embeddings and SQLite |
| [Screenshot QA](projects/screenshot-qa/README.md) | Local OCR followed by Ollama or optional DeepSeek analysis |

## Verify the toolbox

Node.js 20 or newer is required for root and Node project checks. Python 3.10 or newer is enough for the included Python unit tests; runtime OCR dependencies are not needed by those tests.

```sh
git clone https://github.com/wangzifan396-wzf/small-tools-lab.git
cd small-tools-lab
npm install
npm run verify
npm run test:python
```

Run one project directly instead:

```sh
cd projects/action-budget
npm test
node bin/action-budget.js ../../
```

Every project owns its detailed usage instructions. The root package is private and exists only for workspace dependency installation and shared validation; it is not published to npm.

## Repository structure

```text
small-tools-lab/
├── index.html              # Filterable GitHub Pages catalog
├── projects/
│   ├── action-budget/      # Independent tool folders
│   ├── chromacraft/
│   └── ...
├── scripts/                # Cross-project verification
├── tests/                  # Root catalog tests
├── notes/                  # Historical automation notes
└── .github/workflows/      # CI and Pages deployment
```

## 中文说明

这是一个统一的开发者工具箱仓库。浏览器工具、Node.js CLI 和本地 AI 实验都放在 `projects/` 下，每个项目仍保留独立 README、测试和开源边界。以后新增工具继续添加新文件夹，不再为每个小工具创建一个 GitHub 仓库。

根目录负责工具导航、统一测试和 GitHub Pages 展示；项目目录负责具体实现。这样所有关注度集中在一个仓库，同时不会把不同工具的代码混在同一模块里。

See [CONTRIBUTING.md](CONTRIBUTING.md) before adding a project and [SECURITY.md](SECURITY.md) for private vulnerability reports.

## License

[MIT](LICENSE). Individual project folders may repeat the MIT text so they remain independently distributable.
