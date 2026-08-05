#!/usr/bin/env node
/**
 * cronly CLI entry point.
 * @module bin/cronly
 */

import { run } from '../src/cli.js';

const code = run(process);
if (code !== 0) {
  process.once('exit', () => {
    process.exitCode = code;
  });
}
