/**
 * jsonq command-line interface.
 *
 * Subcommands: get, pick, omit, filter, sort, select.
 *
 * @module cli
 */

import { get, pick, omit, filter, sortBy, select } from './index.js';
import { readFile } from 'node:fs/promises';

const VERSION = '0.1.0';

function usage() {
  return [
    'jsonq — zero-dependency JSON query & transform',
    '',
    'Usage:',
    '  jsonq get   <json|@file> <path>        value at dot/slash path',
    '  jsonq pick  <json|@file> <k1,k2,...>   keep listed keys',
    '  jsonq omit  <json|@file> <k1,k2,...>   drop listed keys',
    '  jsonq filter <json|@file> <key> <op> <value>   op: eq neq gt gte lt lte contains exists',
    '  jsonq sort  <json|@file> <key>          [--desc]',
    '  jsonq select <json|@file> <k1,k2,...>   map array to picked objects',
    '  jsonq --help | --version',
    '',
    'A value starting with @ is read from a file; otherwise it is parsed as JSON.',
    '',
    'Examples:',
    '  jsonq get \'{"a":{"b":[10,20]}}\' a.b.0      → 10',
    '  jsonq filter \'[{"n":3},{"n":1}]\' n gt 2     → [{"n":3}]',
    '  jsonq sort \'[{"n":3},{"n":1}]\' n --desc     → [{"n":3},{"n":1}]',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.flags.help = true;
    else if (a === '--version' || a === '-v') args.flags.version = true;
    else if (a === '--desc') args.flags.desc = true;
    else args._.push(a);
  }
  return args;
}

async function readInput(arg) {
  if (typeof arg === 'string' && arg.startsWith('@')) {
    const raw = await readFile(arg.slice(1), 'utf8');
    return JSON.parse(raw);
  }
  return JSON.parse(arg);
}

function splitKeys(s) {
  return String(s).split(',').map((k) => k.trim()).filter(Boolean);
}

function emit(value) {
  console.log(JSON.stringify(value, null, 2));
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.flags.help) { console.log(usage()); return 0; }
  if (args.flags.version) { console.log(VERSION); return 0; }

  const [cmd, value, ...rest] = args._;
  if (!cmd) { console.error(usage()); return 2; }

  try {
    switch (cmd) {
      case 'get': {
        emit(get(await readInput(value), rest[0]));
        return 0;
      }
      case 'pick': {
        emit(pick(await readInput(value), splitKeys(rest[0])));
        return 0;
      }
      case 'omit': {
        emit(omit(await readInput(value), splitKeys(rest[0])));
        return 0;
      }
      case 'filter': {
        const [key, op, val] = rest;
        emit(filter(await readInput(value), key, op, val));
        return 0;
      }
      case 'sort': {
        emit(sortBy(await readInput(value), rest[0], args.flags.desc ? 'desc' : 'asc'));
        return 0;
      }
      case 'select': {
        emit(select(await readInput(value), splitKeys(rest[0])));
        return 0;
      }
      default:
        console.error(`unknown command: ${cmd}\n`);
        console.error(usage());
        return 2;
    }
  } catch (err) {
    console.error(`jsonq: ${err.message}`);
    return 1;
  }
}
