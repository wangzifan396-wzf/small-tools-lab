# Skill Sentry

Deterministic, zero-dependency security scanning for AI agent skills. Skill Sentry examines `SKILL.md`, referenced resources, and every reviewable script in the skill package before installation—without uploading code or asking a model to judge another model.

## Usage

```sh
node bin/skill-sentry.js path/to/skill
node bin/skill-sentry.js path/to/skills --fail-on medium
node bin/skill-sentry.js skill --format sarif --output skill-sentry.sarif
node bin/skill-sentry.js skill --ignore-rule SS009
```

The input may be one skill, a `SKILL.md`, or a directory containing multiple skills. Discovery skips symlinks, `.git`, and `node_modules`; scans at most 100 skills, 500 text files per skill, and 2 MiB per file by default.

## Rules

| Rule | Severity | Signal |
| --- | --- | --- |
| SS001 | high | Unicode bidirectional controls that can disguise source |
| SS002 | high | Instructions that override policy or hide behavior from the user |
| SS003 | high | Remote downloads piped directly into a shell / interpreter |
| SS004 | high | Broad destructive filesystem or Git commands |
| SS005 | medium | Reads of credential files or secret environment variables |
| SS006 | high | Credential access and outbound network operations in one file |
| SS007 | high | Private keys or recognizable hard-coded credential formats |
| SS008 | medium | Unpinned packages or Git-based executable dependencies |
| SS009 | medium | `chmod 777` or broad privileged permission changes |
| SS010 | high | Encoded payloads decoded directly into an interpreter |
| SS100–103 | mixed | Metadata, escaping / missing references, and hidden scripts |

Findings include a rule, severity, source line, bounded masked evidence, and remediation. Output formats are terminal, JSON, Markdown, and SARIF 2.1.0.

## What makes it different

Skill Sentry is intentionally small and inspectable. It does not execute a skill, install its dependencies, follow symlinks, or send content to an LLM. That makes it suitable for a pre-install hook or a fast first CI gate. It complements broader agent / MCP configuration scanners by going deep on one skill package and its file graph.

## Library

```js
import { scanPath, renderReport } from './src/index.js';

const report = await scanPath('./my-skill');
console.log(renderReport(report, 'markdown'));
```

Node.js 20+, zero runtime dependencies, MIT licensed. Run `npm test` for the focused suite.

## Limitations

Static signatures can produce false positives and cannot prove that a skill is safe. Review high-risk code manually and run unknown skills in a constrained environment.
