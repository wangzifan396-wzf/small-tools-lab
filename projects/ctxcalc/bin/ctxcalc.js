#!/usr/bin/env node
import { run } from '../src/cli.js';

const r = run(process.argv.slice(2));
process.stdout.write(r.out + '\n');
process.exit(r.code);
