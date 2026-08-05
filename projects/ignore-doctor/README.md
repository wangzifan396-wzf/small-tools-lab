# Ignore Doctor

Audit the boundaries between `.gitignore`, `.dockerignore`, `.npmignore`, and formatter ignore files. Ignore Doctor makes accidental secret exposure, dependency-directory leaks, dangerous negations, duplicate rules, and oversized Docker contexts visible before they become a review surprise.

[![CI](https://github.com/wangzifan396-wzf/small-tools-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/wangzifan396-wzf/small-tools-lab/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-176b67)](LICENSE)

![Ignore Doctor HTML report](docs/ignore-doctor-report.png)

## Quick start

Node.js 20 or newer is required.

```sh
node bin/ignore-doctor.js .
node bin/ignore-doctor.js . --format markdown --fail-on medium
node bin/ignore-doctor.js . --format html --output ignore-doctor-report.html --fail-on none
```

After an npm release, use `npx ignore-doctor`.

## What it checks

| Rule | Severity | Signal |
| --- | --- | --- |
| `ID001` | high | Sensitive-looking content is explicitly re-included |
| `ID002` | high | A sensitive-looking file is visible to Git |
| `ID003` | medium | A dependency or generated directory is visible to Git |
| `ID004` | medium | Docker context lacks a required boundary such as `.git` or `node_modules` |
| `ID005` | low | Duplicate rule in one ignore file |
| `ID006` | low | Absolute or backslash-based non-portable rule |
| `ID007` | medium | Blanket wildcard hides the entire scope |
| `ID008` | low | Negation appears before an excluding rule |
| `ID009` | medium | Ignore file exceeds the configured rule budget |

Rules keep their source line and evidence. A score is a policy summary, not proof that a repository is safe. Ignore Doctor does not replace Git history review, secret rotation, or a container build inspection.

## Configuration

Add `.ignore-doctor.json` at the scan root:

```json
{
  "ignore": ["examples/**"],
  "maxRulesPerFile": 250,
  "requiredDockerPatterns": [".git", "node_modules", ".env"],
  "sensitivePatterns": [".env", ".env.*", "*.pem", "*.key", "credentials.json"]
}
```

Ignore patterns are repository-relative and support `*`, `?`, and `**`. Example and template files are excluded from the built-in sensitive-file gate; review them manually before publishing.

## GitHub Actions

```yaml
permissions:
  contents: read

steps:
  - uses: actions/checkout@v7
  - uses: wangzifan396-wzf/small-tools-lab/projects/ignore-doctor@main
    with:
      fail-on: high
      format: markdown
      output: ignore-doctor.md
```

The action scans local files only and does not execute project commands, contact a registry, or upload a report.

## Boundaries

Ignore Doctor implements a review-oriented subset of ignore semantics. It does not claim to fully emulate every version of Git, Docker, npm, or editor-specific matcher. Use native `git check-ignore`, `docker build`, and package dry-runs when exact publish behavior matters.

## License

[MIT](LICENSE)
