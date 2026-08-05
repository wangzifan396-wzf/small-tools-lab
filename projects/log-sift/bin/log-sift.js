#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { siftLog } = require("../src/sifter.js");
const { renderHtml, renderJson, renderMarkdown, renderPretty } = require("../src/reporters.js");

const HELP = `Log Sift - deterministic, redacted, token-budgeted log compaction

Usage:
  log-sift <file|-> [options]
  command 2>&1 | log-sift -

Options:
  --budget <tokens>                  Approximate output token budget (default: 2000)
  --context <lines>                  Context groups around errors and warnings (default: 2)
  --format <pretty|json|markdown|html>
  --output <file>                    Write output to a file
  --config <file>                    Configuration file (default: .log-sift.json)
  --strip-time                       Remove leading timestamps from output
  --fail-on-secret                   Exit 1 if credential-like values were redacted
  --version                          Print version
  --help                             Show help
`;

function parseArgs(argv) {
  const options = { input: null, format: "pretty", failOnSecret: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--help", "-h"].includes(argument)) options.help = true;
    else if (["--version", "-v"].includes(argument)) options.version = true;
    else if (argument === "--strip-time") options.stripTimestamps = true;
    else if (argument === "--fail-on-secret") options.failOnSecret = true;
    else if (["--budget", "--context", "--format", "--output", "--config"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      const key = { "--budget": "budget", "--context": "context", "--format": "format", "--output": "output", "--config": "config" }[argument];
      options[key] = ["budget", "context"].includes(key) ? Number(value) : value;
      index += 1;
    } else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else if (options.input === null) options.input = argument;
    else throw new Error(`Unexpected argument: ${argument}`);
  }
  if (!["pretty", "json", "markdown", "html"].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  return options;
}

function loadConfig(filename) {
  const destination = path.resolve(filename || ".log-sift.json");
  try { return JSON.parse(fs.readFileSync(destination, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return {}; throw new Error(`Cannot read ${destination}: ${error.message}`); }
}

function readInput(input) {
  if (input && input !== "-") return fs.readFileSync(path.resolve(input), "utf8");
  if (process.stdin.isTTY) throw new Error("Provide a log file or pipe log text to stdin.");
  return fs.readFileSync(0, "utf8");
}

function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(`log-sift: ${error.message}\n\n${HELP}`); process.exitCode = 2; return; }
  if (options.help) { process.stdout.write(HELP); return; }
  if (options.version) { process.stdout.write(`${require("../package.json").version}\n`); return; }
  try {
    const config = { ...loadConfig(options.config), ...(Number.isFinite(options.budget) ? { budget: options.budget } : {}), ...(Number.isFinite(options.context) ? { context: options.context } : {}), ...(options.stripTimestamps ? { stripTimestamps: true } : {}) };
    const report = siftLog(readInput(options.input), config);
    const output = { pretty: () => renderPretty(report), json: () => renderJson(report), markdown: () => renderMarkdown(report), html: () => renderHtml(report, { source: options.input && options.input !== "-" ? path.basename(options.input) : "stdin" }) }[options.format]();
    if (options.output) { const destination = path.resolve(options.output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, output); }
    else process.stdout.write(output);
    if (options.failOnSecret && report.redaction.count) process.exitCode = 1;
  } catch (error) { console.error(`log-sift: ${error.message}`); process.exitCode = 2; }
}

main();
