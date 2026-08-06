#!/usr/bin/env node
import { run } from '../src/cli.js';
const args = process.argv.slice(2);
if (args[0] === '--stdin') {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  args.splice(0, 1, input.replace(/\r?\n$/, ''));
}
const res = run(args);
if (res.out) console.log(res.out);
process.exit(res.code);
