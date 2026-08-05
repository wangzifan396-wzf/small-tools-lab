#!/usr/bin/env node
/**
 * diffwords CLI entry point.
 * @module bin/diffwords
 */

import { run } from '../src/cli.js';

const code = run(process);
if (code !== 0) {
  // Mirror the conventional diff exit code (1 = differences, 2 = usage error),
  // but never throw on a broken pipe when output is being paged away.
  process.once('exit', () => process.exitCode = code);
}
