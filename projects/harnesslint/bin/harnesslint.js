#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { scanRepository, severityRank } = require("../src/scanner.js");
const { renderPretty, renderJson, renderSarif, renderHtml } = require("../src/reporters.js");

const HELP = `HarnessLint - deterministic checks for AI coding-agent harnesses

Usage:
  harnesslint [path] [options]

Options:
  --format <pretty|json|sarif|html>  Output format (default: pretty)
  --output <file>                    Write output to a file
  --fail-on <high|medium|low|none>   Failure threshold (default: high)
  --baseline <file>                  Ignore findings recorded in a baseline
  --write-baseline <file>            Write current finding fingerprints
  --config <file>                    Configuration file (default: .harnesslintrc.json)
  --no-color                         Disable terminal colors
  --version                          Print version
  --help                             Show help

Examples:
  harnesslint .
  harnesslint . --format sarif --output harnesslint.sarif
  harnesslint . --write-baseline .harnesslint-baseline.json
`;

function parseArgs(argv) {
  const options = { root: ".", format: "pretty", failOn: "high", color: true };
  let rootSet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--version" || argument === "-v") options.version = true;
    else if (argument === "--no-color") options.color = false;
    else if (["--format", "--output", "--fail-on", "--baseline", "--write-baseline", "--config"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      const key = { "--format": "format", "--output": "output", "--fail-on": "failOn", "--baseline": "baseline", "--write-baseline": "writeBaseline", "--config": "config" }[argument];
      options[key] = value;
      index += 1;
    } else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else if (!rootSet) { options.root = argument; rootSet = true; }
    else throw new Error(`Unexpected argument: ${argument}`);
  }
  if (!["pretty", "json", "sarif", "html"].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  if (!["high", "medium", "low", "none"].includes(options.failOn)) throw new Error(`Unsupported severity: ${options.failOn}`);
  return options;
}

function loadJson(filename, fallback) {
  try { return JSON.parse(fs.readFileSync(filename, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw new Error(`Cannot read ${filename}: ${error.message}`);
  }
}

function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(`harnesslint: ${error.message}\n\n${HELP}`); process.exitCode = 2; return; }
  if (options.help) { process.stdout.write(HELP); return; }
  if (options.version) { process.stdout.write(`${require("../package.json").version}\n`); return; }

  const root = path.resolve(options.root);
  const configPath = path.resolve(root, options.config || ".harnesslintrc.json");
  let config;
  let report;
  try {
    config = loadJson(configPath, {});
    report = scanRepository(root, config);
  }
  catch (error) { console.error(`harnesslint: ${error.message}`); process.exitCode = 2; return; }

  const baselinePath = options.baseline && path.resolve(root, options.baseline);
  if (baselinePath) {
    let baseline;
    try { baseline = loadJson(baselinePath, { fingerprints: [] }); }
    catch (error) { console.error(`harnesslint: ${error.message}`); process.exitCode = 2; return; }
    const known = new Set(Array.isArray(baseline) ? baseline : baseline.fingerprints || []);
    report.findings.forEach((finding) => { finding.baseline = known.has(finding.fingerprint); });
    report.newFindings = report.findings.filter((finding) => !finding.baseline);
  } else report.newFindings = report.findings;

  if (options.writeBaseline) {
    const destination = path.resolve(root, options.writeBaseline);
    try {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), fingerprints: report.findings.map((finding) => finding.fingerprint).sort() }, null, 2)}\n`);
    } catch (error) {
      console.error(`harnesslint: Cannot write baseline: ${error.message}`);
      process.exitCode = 2;
      return;
    }
  }

  const renderers = { pretty: () => renderPretty(report, { color: options.color && process.stdout.isTTY }), json: () => renderJson(report), sarif: () => renderSarif(report), html: () => renderHtml(report) };
  const output = renderers[options.format]();
  if (options.output) {
    const destination = path.resolve(process.cwd(), options.output);
    try {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, output);
    } catch (error) {
      console.error(`harnesslint: Cannot write output: ${error.message}`);
      process.exitCode = 2;
      return;
    }
    if (options.format === "pretty") process.stdout.write(`Wrote ${destination}\n`);
  } else process.stdout.write(output);

  if (options.writeBaseline && options.format === "pretty") process.stdout.write(`Baseline written to ${path.resolve(root, options.writeBaseline)}\n`);
  if (options.failOn !== "none") {
    const threshold = severityRank(options.failOn);
    if (report.newFindings.some((finding) => severityRank(finding.severity) >= threshold)) process.exitCode = 1;
  }
}

main();
