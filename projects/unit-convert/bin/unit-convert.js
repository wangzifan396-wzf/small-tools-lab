#!/usr/bin/env node
import { run } from '../src/cli.js';
const res = run(process.argv.slice(2));
if (res.out) console.log(res.out);
process.exit(res.code);
