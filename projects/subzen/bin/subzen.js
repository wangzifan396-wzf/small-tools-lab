#!/usr/bin/env node
/**
 * subzen CLI entry point.
 */
import process from 'node:process';
import { run } from '../src/cli.js';

// Broken pipes (`subzen stats big.srt | head`) are normal, not crashes.
process.stdout.on('error', (error) => {
  if (/** @type {NodeJS.ErrnoException} */ (error).code === 'EPIPE') process.exit(0);
});

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`subzen: ${error?.stack ?? error}\n`);
    process.exitCode = 2;
  });
