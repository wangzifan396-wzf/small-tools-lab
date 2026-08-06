#!/usr/bin/env node
import { run } from '../src/cli.js';
const args = process.argv.slice(2);
if (args.length === 1 && !process.stdin.isTTY) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  args.push(input.replace(/\r?\n$/, ''));
}
const res = run(args);
if (res.out) console.log(res.out);
process.exit(res.code);
