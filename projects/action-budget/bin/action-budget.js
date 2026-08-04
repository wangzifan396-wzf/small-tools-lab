#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { analyzeRepository } = require("../src/analyzer.js");
const { renderHtml, renderJson, renderMarkdown, renderPretty } = require("../src/reporters.js");

const HELP = `Action Budget - GitHub Actions fanout and timeout exposure

Usage:
  action-budget [path] [options]

Options:
  --format <pretty|json|markdown|html> Output format (default: pretty)
  --output <file>                     Write output to a file
  --fail-on <high|medium|low|none>    Failure threshold (default: high)
  --config <file>                     Config path (default: .action-budget.json)
  --max-jobs <number>                 Override maximum variants per workflow run
  --max-minutes <number>              Override timeout-minutes per workflow run
  --max-matrix <number>               Override variants per matrix job
  --default-timeout <number>          Assumed timeout when a job omits one
  --no-color                          Disable terminal color
  --version                           Print version
  --help                              Show help

Examples:
  action-budget .
  action-budget . --max-jobs 40 --fail-on medium
  action-budget . --format html --output action-budget-report.html --fail-on none
`;
const RANK = { low: 1, medium: 2, high: 3 };

function parseArgs(argv) {
  const options = { root: ".", format: "pretty", failOn: "high", color: true, overrides: {} };
  let rootSet = false;
  const valueOptions = new Set(["--format", "--output", "--fail-on", "--config", "--max-jobs", "--max-minutes", "--max-matrix", "--default-timeout"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--help", "-h"].includes(argument)) options.help = true;
    else if (["--version", "-v"].includes(argument)) options.version = true;
    else if (argument === "--no-color") options.color = false;
    else if (valueOptions.has(argument)) {
      const value = argv[index + 1]; if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`); index += 1;
      if (argument === "--format") options.format = value;
      else if (argument === "--output") options.output = value;
      else if (argument === "--fail-on") options.failOn = value;
      else if (argument === "--config") options.config = value;
      else {
        const number = Number(value); if (!Number.isFinite(number) || number <= 0) throw new Error(`${argument} requires a positive number`);
        options.overrides[{ "--max-jobs": "maxJobsPerRun", "--max-minutes": "maxTimeoutMinutesPerRun", "--max-matrix": "maxMatrixVariants", "--default-timeout": "defaultTimeoutMinutes" }[argument]] = number;
      }
    } else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else if (!rootSet) { options.root = argument; rootSet = true; } else throw new Error(`Unexpected argument: ${argument}`);
  }
  if (!["pretty", "json", "markdown", "html"].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  if (!["high", "medium", "low", "none"].includes(options.failOn)) throw new Error(`Unsupported severity: ${options.failOn}`);
  return options;
}

function loadConfig(root, filename) {
  const destination = path.resolve(root, filename || ".action-budget.json");
  try { return JSON.parse(fs.readFileSync(destination, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return {}; throw new Error(`Cannot read ${destination}: ${error.message}`); }
}

function main() {
  let options; try { options = parseArgs(process.argv.slice(2)); } catch (error) { console.error(`action-budget: ${error.message}\n\n${HELP}`); process.exitCode = 2; return; }
  if (options.help) { process.stdout.write(HELP); return; }
  if (options.version) { process.stdout.write(`${require("../package.json").version}\n`); return; }
  const root = path.resolve(options.root); let report;
  try { report = analyzeRepository(root, { ...loadConfig(root, options.config), ...options.overrides }); }
  catch (error) { console.error(`action-budget: ${error.message}`); process.exitCode = 2; return; }
  const output = { pretty: () => renderPretty(report, { color: options.color && process.stdout.isTTY }), json: () => renderJson(report), markdown: () => renderMarkdown(report), html: () => renderHtml(report) }[options.format]();
  if (options.output) {
    const destination = path.resolve(process.cwd(), options.output);
    try { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, output); }
    catch (error) { console.error(`action-budget: Cannot write output: ${error.message}`); process.exitCode = 2; return; }
  } else process.stdout.write(output);
  if (options.failOn !== "none" && report.findings.some((item) => RANK[item.severity] >= RANK[options.failOn])) process.exitCode = 1;
}

main();
