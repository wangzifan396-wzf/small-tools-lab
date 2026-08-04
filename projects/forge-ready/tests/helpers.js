"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function repository(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "forge-ready-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [relative, content] of Object.entries(files || {})) write(root, relative, content);
  return root;
}

function write(root, relative, content) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

function readyFiles() {
  const readme = `# Ready CLI\n\nA deterministic command line tool that demonstrates a complete public project with enough practical detail for a maintainer to evaluate before release. It works locally and has no network dependency.\n\n## Quick start\n\nInstall with npm and run the command:\n\n\`\`\`sh\nnpm install ready-cli\nnpx ready-cli .\n\`\`\`\n\n## Usage\n\nUse the command against a repository. The report explains every result, includes examples, and exits with documented status codes suitable for continuous integration. Contributors can run the included tests before submitting changes.\n\n![Report](docs/report.png)\n\n## Contributing\n\nSee [CONTRIBUTING.md](CONTRIBUTING.md).\n\n## Security\n\nSee [SECURITY.md](SECURITY.md).\n\n## License\n\nMIT. See [LICENSE](LICENSE).\n`;
  return {
    "README.md": readme,
    "LICENSE": "MIT License\n",
    "CONTRIBUTING.md": "# Contributing\n\nRun npm test.\n",
    "SECURITY.md": "# Security\n\nUse private vulnerability reporting.\n",
    "CODE_OF_CONDUCT.md": "# Code of conduct\n\nBe respectful.\n",
    "CHANGELOG.md": "# Changelog\n\n## 0.1.0\n\nInitial release.\n",
    ".gitignore": "node_modules/\n",
    ".github/ISSUE_TEMPLATE/bug.yml": "name: Bug\ndescription: Report a bug\nbody: []\n",
    ".github/PULL_REQUEST_TEMPLATE.md": "## Validation\n\n- [ ] npm test\n",
    ".github/workflows/ci.yml": "name: CI\non: push\npermissions:\n  contents: read\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n",
    ".github/workflows/release.yml": "name: Release\non: workflow_dispatch\npermissions:\n  contents: read\njobs:\n  pack:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm pack --dry-run\n",
    "package.json": JSON.stringify({ name: "ready-cli", version: "0.1.0", description: "Ready fixture", license: "MIT", private: false, repository: "https://github.com/example/ready-cli", bin: { "ready-cli": "bin/cli.js" }, files: ["bin/"], scripts: { test: "node --test" }, engines: { node: ">=20" } }, null, 2),
    "bin/cli.js": "#!/usr/bin/env node\nconsole.log('ready');\n",
    "src/index.js": "module.exports = {};\n",
    "tests/index.test.js": "require('node:test')('ready', () => {});\n",
    "docs/report.png": "synthetic image fixture"
  };
}

module.exports = { readyFiles, repository, write };
