#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildPacket, findRepository } = require("../src/builder.js");
const { renderHtml, renderJson, renderMarkdown, renderSummary, renderXml } = require("../src/reporters.js");

const HELP = `PatchBrief - minimal, redacted context around a Git diff

Usage:
  patchbrief [path] [options]

Options:
  --base <ref>                         Compare merge-base with a head ref
  --head <ref>                         Head ref used with --base (default: HEAD)
  --staged                             Analyze staged changes only
  --budget <tokens>                    Total token budget (default: 12000)
  --context-lines <number>             Lines around changed ranges (default: 20)
  --format <summary|markdown|xml|json|html>
                                       Output format (default: summary)
  --output <file>                      Write output to a file
  --config <file>                      Config path (default: .patchbrief.json)
  --no-redact                          Disable secret-like value redaction
  --fail-on-redaction                  Exit 1 when any value was redacted
  --no-color                           Disable terminal color
  --version                            Print version
  --help                               Show help

Examples:
  patchbrief .
  patchbrief . --staged --format markdown --output patchbrief.md
  patchbrief . --base origin/main --budget 16000 --format xml
`;

function parseArgs(argv) {
  const options = { root: ".", budget: 12000, contextLines: 20, format: "summary", redact: true, color: true };
  let rootSet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--version" || argument === "-v") options.version = true;
    else if (argument === "--staged") options.staged = true;
    else if (argument === "--no-redact") options.redact = false;
    else if (argument === "--fail-on-redaction") options.failOnRedaction = true;
    else if (argument === "--no-color") options.color = false;
    else if (["--base", "--head", "--budget", "--context-lines", "--format", "--output", "--config"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      const key = { "--base": "base", "--head": "head", "--budget": "budget", "--context-lines": "contextLines", "--format": "format", "--output": "output", "--config": "config" }[argument];
      options[key] = value;
      index += 1;
    } else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else if (!rootSet) { options.root = argument; rootSet = true; }
    else throw new Error(`Unexpected argument: ${argument}`);
  }
  if (!["summary", "markdown", "xml", "json", "html"].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  if (options.head && !options.base) throw new Error("--head requires --base");
  if (options.base && options.staged) throw new Error("--base and --staged cannot be used together");
  options.budget = Number(options.budget);
  options.contextLines = Number(options.contextLines);
  return options;
}

function loadConfig(root, filename) {
  const destination = path.resolve(root, filename || ".patchbrief.json");
  try { return JSON.parse(fs.readFileSync(destination, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error(`Cannot read ${destination}: ${error.message}`);
  }
}

function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(`patchbrief: ${error.message}\n\n${HELP}`); process.exitCode = 2; return; }
  if (options.help) { process.stdout.write(HELP); return; }
  if (options.version) { process.stdout.write(`${require("../package.json").version}\n`); return; }
  let packet;
  try {
    const root = findRepository(path.resolve(options.root));
    packet = buildPacket(root, options, loadConfig(root, options.config));
  } catch (error) { console.error(`patchbrief: ${error.message}`); process.exitCode = 2; return; }
  const output = {
    summary: () => renderSummary(packet, { color: options.color && process.stdout.isTTY }), markdown: () => renderMarkdown(packet),
    xml: () => renderXml(packet), json: () => renderJson(packet), html: () => renderHtml(packet)
  }[options.format]();
  if (options.output) {
    const destination = path.resolve(process.cwd(), options.output);
    try { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, output); }
    catch (error) { console.error(`patchbrief: Cannot write output: ${error.message}`); process.exitCode = 2; return; }
  } else process.stdout.write(output);
  if (options.failOnRedaction && packet.redaction.count > 0) process.exitCode = 1;
}

main();
