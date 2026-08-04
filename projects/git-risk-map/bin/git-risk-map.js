#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { analyzeRepository, findRepository } = require("../src/analyzer.js");
const { renderHtml, renderJson, renderMarkdown, renderPretty } = require("../src/reporters.js");

const HELP = `Git Risk Map - deterministic change-risk scoring and review order

Usage:
  git-risk-map [path] [options]

Options:
  --base <ref>                       Compare merge-base with a head ref
  --head <ref>                       Head ref used with --base (default: HEAD)
  --staged                           Analyze staged changes only
  --history-days <number>            Hotspot history window (default: 90)
  --format <pretty|json|markdown|html> Output format (default: pretty)
  --output <file>                    Write output to a file
  --fail-on <critical|high|medium|low|none>
                                     Failure threshold (default: none)
  --config <file>                    Config path (default: .git-risk-map.json)
  --no-color                         Disable terminal color
  --version                          Print version
  --help                             Show help

Examples:
  git-risk-map .
  git-risk-map . --staged --fail-on high
  git-risk-map . --base origin/main --format markdown
`;

const LEVEL_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

function parseArgs(argv) {
  const options = { root: ".", format: "pretty", failOn: "none", color: true };
  let rootSet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--version" || argument === "-v") options.version = true;
    else if (argument === "--staged") options.staged = true;
    else if (argument === "--no-color") options.color = false;
    else if (["--base", "--head", "--history-days", "--format", "--output", "--fail-on", "--config"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      const key = { "--base": "base", "--head": "head", "--history-days": "historyDays", "--format": "format", "--output": "output", "--fail-on": "failOn", "--config": "config" }[argument];
      options[key] = value;
      index += 1;
    } else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else if (!rootSet) { options.root = argument; rootSet = true; }
    else throw new Error(`Unexpected argument: ${argument}`);
  }
  if (!new Set(["pretty", "json", "markdown", "html"]).has(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  if (!new Set(["critical", "high", "medium", "low", "none"]).has(options.failOn)) throw new Error(`Unsupported risk level: ${options.failOn}`);
  if (options.head && !options.base) throw new Error("--head requires --base");
  if (options.base && options.staged) throw new Error("--base and --staged cannot be used together");
  return options;
}

function loadConfig(root, filename) {
  const destination = path.resolve(root, filename || ".git-risk-map.json");
  try { return JSON.parse(fs.readFileSync(destination, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error(`Cannot read ${destination}: ${error.message}`);
  }
}

function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(`git-risk-map: ${error.message}\n\n${HELP}`); process.exitCode = 2; return; }
  if (options.help) { process.stdout.write(HELP); return; }
  if (options.version) { process.stdout.write(`${require("../package.json").version}\n`); return; }
  let report;
  try {
    const root = findRepository(path.resolve(options.root));
    const config = loadConfig(root, options.config);
    report = analyzeRepository(root, options, config);
  } catch (error) {
    console.error(`git-risk-map: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const renderers = {
    pretty: () => renderPretty(report, { color: options.color && process.stdout.isTTY }),
    json: () => renderJson(report),
    markdown: () => renderMarkdown(report),
    html: () => renderHtml(report)
  };
  const output = renderers[options.format]();
  if (options.output) {
    const destination = path.resolve(process.cwd(), options.output);
    try {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, output);
    } catch (error) {
      console.error(`git-risk-map: Cannot write output: ${error.message}`);
      process.exitCode = 2;
      return;
    }
  } else process.stdout.write(output);
  if (report.files.length && options.failOn !== "none" && LEVEL_RANK[report.overall.level] >= LEVEL_RANK[options.failOn]) process.exitCode = 1;
}

main();
