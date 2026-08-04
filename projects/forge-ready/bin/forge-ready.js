#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { RULES, scanRepository } = require("../src/scanner.js");
const { renderHtml, renderJson, renderMarkdown, renderPretty } = require("../src/reporters.js");

const HELP = `ForgeReady - evidence-based open-source release preflight

Usage:
  forge-ready [path] [options]

Options:
  --profile <auto|cli|library|app|general> Audit profile (default: auto)
  --format <pretty|json|markdown|html>       Output format (default: pretty)
  --output <file>                           Write output to a file
  --min-score <0-100>                       Fail below this score (default: 0)
  --config <file>                           Config path (default: .forge-ready.json)
  --list-rules                              Print the rule catalog
  --no-color                                Disable terminal color
  --version                                 Print version
  --help                                    Show help

Examples:
  forge-ready .
  forge-ready . --profile cli --min-score 80
  forge-ready . --format html --output forge-ready-report.html
`;

function parseArgs(argv) {
  const options = { root: ".", profile: "auto", format: "pretty", minScore: 0, color: true };
  let rootSet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--version" || argument === "-v") options.version = true;
    else if (argument === "--list-rules") options.listRules = true;
    else if (argument === "--no-color") options.color = false;
    else if (["--profile", "--format", "--output", "--min-score", "--config"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      const key = { "--profile": "profile", "--format": "format", "--output": "output", "--min-score": "minScore", "--config": "config" }[argument];
      options[key] = value;
      index += 1;
    } else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else if (!rootSet) { options.root = argument; rootSet = true; }
    else throw new Error(`Unexpected argument: ${argument}`);
  }
  if (!["auto", "cli", "library", "app", "general"].includes(options.profile)) throw new Error(`Unsupported profile: ${options.profile}`);
  if (!["pretty", "json", "markdown", "html"].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  options.minScore = Number(options.minScore);
  if (!Number.isFinite(options.minScore) || options.minScore < 0 || options.minScore > 100) throw new Error("--min-score must be between 0 and 100");
  return options;
}

function loadConfig(root, filename) {
  const destination = path.resolve(root, filename || ".forge-ready.json");
  try { return JSON.parse(fs.readFileSync(destination, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error(`Cannot read ${destination}: ${error.message}`);
  }
}

function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(`forge-ready: ${error.message}\n\n${HELP}`); process.exitCode = 2; return; }
  if (options.help) { process.stdout.write(HELP); return; }
  if (options.version) { process.stdout.write(`${require("../package.json").version}\n`); return; }
  if (options.listRules) {
    for (const [id, rule] of Object.entries(RULES)) process.stdout.write(`${id}\t${rule.category}\t-${rule.penalty}\t${rule.title}\n`);
    return;
  }
  const root = path.resolve(options.root);
  let report;
  try { report = scanRepository(root, options, loadConfig(root, options.config)); }
  catch (error) { console.error(`forge-ready: ${error.message}`); process.exitCode = 2; return; }
  const output = {
    pretty: () => renderPretty(report, { color: options.color && process.stdout.isTTY }),
    json: () => renderJson(report),
    markdown: () => renderMarkdown(report),
    html: () => renderHtml(report)
  }[options.format]();
  if (options.output) {
    const destination = path.resolve(process.cwd(), options.output);
    try { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, output); }
    catch (error) { console.error(`forge-ready: Cannot write output: ${error.message}`); process.exitCode = 2; return; }
  } else process.stdout.write(output);
  if (report.score < options.minScore) process.exitCode = 1;
}

main();
